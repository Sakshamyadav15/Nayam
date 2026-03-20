"""
NAYAM (नयम्) — Prediction Router
==================================
File:   app/api/v1/prediction.py
Route:  GET /api/v1/prediction   (already registered in main.py)

All values confirmed against actual DB logs:
  - issues.status stored as:   'OPEN' | 'IN_PROGRESS' | 'CLOSED'  (uppercase)
  - issues.priority stored as: 'HIGH' | 'MEDIUM' | 'LOW'           (uppercase)
  - citizens.ward:             ward lives here, joined via citizen_id
  - RiskLevel enum:            'low' | 'medium' | 'high' | 'critical'
  - AnomalySeverity enum:      'warning' | 'alert' | 'critical'
  - trend_direction values:    'increasing' | 'stable' | 'decreasing'
  - IDs:                       uuid.uuid4() as Uuid type
"""

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.predictive.models import RiskScore, RiskLevel
from app.predictive.anomaly_model import AnomalyLog, AnomalySeverity

router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────

REAL_WARDS = [
    "Dwarka",
    "Rohini",
    "Karol Bagh",
    "Lajpat Nagar",
    "Saket",
    "Janakpuri",
    "Pitampura",
    "Mayur Vihar"
]

ANOMALY_THRESHOLD = 1.5
N_WEEKS           = 5
MODEL_VERSION     = "wma-v1"


# ═══════════════════════════════════════════════════════════════
# WMA MODEL
# ═══════════════════════════════════════════════════════════════

def weighted_moving_average(series: list[float], steps: int = 1) -> list[float]:
    """
    Recency-weighted moving average with dampened trend.
    Exponential weights — recent weeks matter more.
    Predictions floored to 0.
    """
    if not series:
        return [0.0] * steps
    if len(series) == 1:
        return [max(0.0, series[0])] * steps

    n        = min(len(series), 4)
    recent   = np.array(series[-n:], dtype=float)
    weights  = np.exp(np.arange(n, dtype=float))
    weights  = weights / weights.sum()
    baseline = float(np.dot(weights, recent))
    trend    = (series[-1] - series[-2]) * 0.5 if len(series) >= 2 else 0.0

    results, val = [], baseline
    for _ in range(steps):
        val = max(0.0, val + trend)
        trend *= 0.5
        results.append(round(val, 2))
    return results


def fitted_values(series: list[float]) -> list[float]:
    """Walk-forward WMA fitted values for plotting actual vs predicted."""
    fitted = []
    for i in range(len(series)):
        if i < 2:
            fitted.append(round(float(series[i]), 2))
        else:
            fitted.append(weighted_moving_average(series[:i], steps=1)[0])
    return fitted


def trend_slope(series: list[float]) -> float:
    if len(series) < 2:
        return 0.0
    x = np.arange(len(series), dtype=float)
    return round(float(np.polyfit(x, series, 1)[0]), 3)


def consecutive_rising_weeks(series: list[float]) -> int:
    count = 0
    for i in range(len(series) - 1, 0, -1):
        if series[i] > series[i - 1]:
            count += 1
        else:
            break
    return count


def compute_risk_score(total_issues: int, total_high: int, max_total: int) -> int:
    volume   = (total_issues / max(max_total, 1)) * 50
    severity = (total_high   / max(total_issues, 1)) * 50
    return min(100, round(volume + severity))


def score_to_risk_level(score: int) -> RiskLevel:
    """Lowercase enum values as defined in RiskLevel ORM model."""
    if score >= 80: return RiskLevel.CRITICAL  # "critical"
    if score >= 60: return RiskLevel.HIGH       # "high"
    if score >= 30: return RiskLevel.MEDIUM     # "medium"
    return RiskLevel.LOW                        # "low"


def score_to_anomaly_severity(score: int) -> AnomalySeverity:
    """Values: 'warning' | 'alert' | 'critical' as defined in AnomalySeverity ORM."""
    if score >= 80: return AnomalySeverity.CRITICAL  # "critical"
    if score >= 50: return AnomalySeverity.ALERT      # "alert"
    return AnomalySeverity.WARNING                    # "warning"


def slope_to_trend_direction(slope: float) -> str:
    """Values match trend_direction VARCHAR(20) in risk_scores table."""
    if slope > 0.5:  return "increasing"
    if slope < -0.5: return "decreasing"
    return "stable"


def build_anomaly_reason(actual: int, predicted: float,
                          high_pri: int, slope: float, n_rising: int) -> str:
    parts = [
        f"{actual} complaints vs {round(predicted)} predicted",
        f"{high_pri} of {actual} marked High priority",
    ]
    if n_rising >= 2:
        parts.append(f"Trending upward for {n_rising} consecutive weeks")
    elif slope > 1.0:
        parts.append("Sharp upward trend detected")
    elif slope < -1.0:
        parts.append("Declining trend but current spike is anomalous")
    return ". ".join(parts) + "."


# ═══════════════════════════════════════════════════════════════
# DATA LAYER
# ═══════════════════════════════════════════════════════════════

def fetch_ward_weekly_data(db: Session) -> dict[str, dict[int, dict]]:
    """
    JOIN issues → citizens to get ward.
    Confirmed from DB logs:
      - status stored as 'OPEN', 'IN_PROGRESS', 'CLOSED'  (uppercase)
      - priority stored as 'HIGH', 'MEDIUM', 'LOW'         (uppercase)
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    rows = db.execute(text("""
        SELECT c.ward, i.created_at, i.priority
        FROM issues i
        JOIN citizens c ON i.citizen_id = c.id
        WHERE i.created_at >= :cutoff
          AND i.status != 'CLOSED'
          AND c.ward IS NOT NULL
    """), {"cutoff": cutoff}).fetchall()

    ward_weeks: dict[str, dict[int, dict]] = defaultdict(
        lambda: defaultdict(lambda: {"count": 0, "high_priority": 0})
    )

    for ward, created_at_raw, priority in rows:
        if not ward or not created_at_raw:
            continue
        # SQLite returns datetime as string
        if isinstance(created_at_raw, str):
            raw = created_at_raw.replace("T", " ").split("+")[0].split(".")[0]
            try:
                dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
        else:
            dt = created_at_raw

        wk = dt.isocalendar()[1]
        ward_weeks[ward][wk]["count"] += 1
        if priority == "HIGH":          # confirmed uppercase from DB logs
            ward_weeks[ward][wk]["high_priority"] += 1

    return ward_weeks


def upsert_risk_score(db: Session, ward: str, score: int,
                       issue_count: int, slope: float) -> None:
    """Delete existing + insert fresh RiskScore using ORM model."""
    db.query(RiskScore).filter(RiskScore.ward == ward).delete()
    db.add(RiskScore(
        id                = uuid.uuid4(),
        ward              = ward,
        department        = "All Departments",
        score             = float(score),
        risk_level        = score_to_risk_level(score),
        issue_count       = issue_count,
        trend_direction   = slope_to_trend_direction(slope),
        prediction_window = "next_7_days",
        model_version     = MODEL_VERSION,
        computed_at       = datetime.now(timezone.utc),
    ))


def insert_anomaly_log(db: Session, ward: str, actual: float,
                        predicted: float, description: str, score: int) -> None:
    """Insert anomaly detection event using ORM model."""
    deviation = round(((actual - predicted) / max(predicted, 1)) * 100, 1)
    db.add(AnomalyLog(
        id                = uuid.uuid4(),
        ward              = ward,
        department        = "All Departments",
        anomaly_type      = "spike",
        severity          = score_to_anomaly_severity(score),
        expected_value    = round(predicted, 2),
        actual_value      = float(actual),
        deviation_percent = deviation,
        description       = description,
        detected_at       = datetime.now(timezone.utc),
        resolved          = 0,
    ))


# ═══════════════════════════════════════════════════════════════
# ENDPOINT
# ═══════════════════════════════════════════════════════════════

@router.get("")
def get_predictive_analytics(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    GET /api/v1/prediction

    Response:
    {
      "wards": [
        {
          "ward":                "Karol Bagh",
          "weekly_actual":      [5, 8, 14, 9, 6],
          "weekly_predicted":   [5.0, 6.5, 9.2, 11.8, 9.4],
          "next_week_forecast": 7.2,
          "trend_slope":        -0.3,
          "anomaly":            true,
          "anomaly_reason":     "14 complaints vs 9 predicted, ...",
          "high_priority_count": 6,
          "risk":               74
        }, ...
      ],
      "generated_at":      "2026-03-19T10:30:00+00:00",
      "model":             "Weighted Moving Average",
      "anomaly_threshold": 1.5
    }
    """

    ward_weeks = fetch_ward_weekly_data(db)

    # Last N_WEEKS ISO week numbers oldest → newest
    now          = datetime.now(timezone.utc)
    recent_weeks = [
        (now - timedelta(weeks=i)).isocalendar()[1]
        for i in range(N_WEEKS - 1, -1, -1)
    ]

    # Max total issues across all wards for risk normalisation
    max_total = max(
        (
            sum(ward_weeks.get(w, {}).get(wk, {}).get("count", 0)
                for wk in recent_weeks)
            for w in REAL_WARDS
        ),
        default=1,
    )

    results = []

    for ward in REAL_WARDS:
        wdata = ward_weeks.get(ward, {})

        actual_counts   = [wdata.get(wk, {}).get("count", 0)         for wk in recent_weeks]
        high_pri_counts = [wdata.get(wk, {}).get("high_priority", 0) for wk in recent_weeks]

        predicted_counts = fitted_values(actual_counts)
        next_forecast    = weighted_moving_average(actual_counts, steps=1)[0]
        slope            = trend_slope(actual_counts)

        current_actual    = actual_counts[-1]
        current_predicted = predicted_counts[-1]
        current_high_pri  = high_pri_counts[-1]

        # Anomaly: current week actual > 1.5 × predicted baseline
        is_anomaly = (
            current_predicted > 0 and
            current_actual > ANOMALY_THRESHOLD * current_predicted
        )

        n_rising = consecutive_rising_weeks(actual_counts)
        reason   = ""
        if is_anomaly:
            reason = build_anomaly_reason(
                current_actual, current_predicted,
                current_high_pri, slope, n_rising,
            )

        total_issues = sum(actual_counts)
        total_high   = sum(high_pri_counts)
        r_score      = compute_risk_score(total_issues, total_high, max_total)

        # Persist to risk_scores table
        try:
            upsert_risk_score(db, ward, r_score, total_issues, slope)
        except Exception:
            pass

        # Persist to anomaly_logs if anomaly detected
        if is_anomaly:
            try:
                insert_anomaly_log(
                    db, ward,
                    float(current_actual), current_predicted,
                    reason, r_score,
                )
            except Exception:
                pass

        results.append({
            "ward":                ward,
            "weekly_actual":       actual_counts,
            "weekly_predicted":    predicted_counts,
            "next_week_forecast":  next_forecast,
            "trend_slope":         slope,
            "anomaly":             is_anomaly,
            "anomaly_reason":      reason,
            "high_priority_count": current_high_pri,
            "risk":                r_score,
        })

    # Commit all DB writes in one transaction
    try:
        db.commit()
    except Exception:
        db.rollback()

    results.sort(key=lambda x: x["risk"], reverse=True)

    return {
        "wards":             results,
        "generated_at":      now.isoformat(),
        "model":             "Weighted Moving Average",
        "anomaly_threshold": ANOMALY_THRESHOLD,
    }