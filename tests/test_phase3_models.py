"""
NAYAM (नयम्) — Phase 3 Model Tests.

Comprehensive tests for all Phase 3 ORM models:
  • RiskScore (predictive)
  • AnomalyLog (predictive)
  • GeoCluster (geospatial)
  • TaskRecommendation (recommendations)
  • ExecutionFeedback (recommendations)
  • AuditLog (observability)
  • EncryptedFieldRegistry (privacy)
"""

import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy.orm import Session

from app.predictive.models import RiskScore, RiskLevel
from app.predictive.anomaly_model import AnomalyLog, AnomalySeverity
from app.geospatial.models import GeoCluster
from app.recommendations.models import (
    TaskRecommendation,
    RecommendationStatus,
    ExecutionFeedback,
    FeedbackOutcome,
)
from app.observability.models import AuditLog, AuditAction
from app.privacy.models import EncryptedFieldRegistry, EncryptionAlgorithm


# ═══════════════════════════════════════════════════════════════════
# RiskScore Tests
# ═══════════════════════════════════════════════════════════════════


class TestRiskScoreModel:
    """Tests for the RiskScore ORM model."""

    def test_create_risk_score_defaults(self, db_session: Session) -> None:
        """Creating a RiskScore with required fields populates defaults."""
        rs = RiskScore(ward="Dwarka")
        db_session.add(rs)
        db_session.commit()
        db_session.refresh(rs)

        assert rs.id is not None
        assert rs.ward == "Dwarka"
        assert rs.score == 0.0
        assert rs.risk_level == RiskLevel.LOW
        assert rs.issue_count == 0
        assert rs.trend_direction == "stable"
        assert rs.prediction_window == "next_7_days"
        assert rs.model_version == "v1.0"
        assert rs.computed_at is not None

    def test_create_risk_score_full(self, db_session: Session) -> None:
        """Creating a RiskScore with all fields set."""
        now = datetime.now(timezone.utc)
        rs = RiskScore(
            ward="Saket",
            department="Water Supply",
            score=78.5,
            risk_level=RiskLevel.HIGH,
            issue_count=42,
            trend_direction="increasing",
            prediction_window="next_30_days",
            model_version="v2.1",
            computed_at=now,
        )
        db_session.add(rs)
        db_session.commit()
        db_session.refresh(rs)

        assert rs.ward == "Saket"
        assert rs.department == "Water Supply"
        assert rs.score == 78.5
        assert rs.risk_level == RiskLevel.HIGH
        assert rs.issue_count == 42
        assert rs.trend_direction == "increasing"

    def test_risk_level_enum_values(self) -> None:
        """RiskLevel enum has all expected members."""
        assert set(RiskLevel) == {
            RiskLevel.LOW,
            RiskLevel.MEDIUM,
            RiskLevel.HIGH,
            RiskLevel.CRITICAL,
        }

    def test_risk_score_repr(self, db_session: Session) -> None:
        rs = RiskScore(ward="Dwarka", score=50.0, risk_level=RiskLevel.MEDIUM)
        db_session.add(rs)
        db_session.commit()
        db_session.refresh(rs)
        repr_str = repr(rs)
        assert "RiskScore" in repr_str
        assert "Dwarka" in repr_str

    def test_multiple_risk_scores_per_ward(self, db_session: Session) -> None:
        """Multiple risk scores can exist for the same ward (time-series)."""
        for i in range(3):
            db_session.add(RiskScore(ward="Karol Bagh", score=float(i * 10)))
        db_session.commit()

        results = db_session.query(RiskScore).filter_by(ward="Karol Bagh").all()
        assert len(results) == 3

    def test_risk_score_critical_level(self, db_session: Session) -> None:
        rs = RiskScore(ward="Model Town", score=95.0, risk_level=RiskLevel.CRITICAL)
        db_session.add(rs)
        db_session.commit()
        db_session.refresh(rs)
        assert rs.risk_level == RiskLevel.CRITICAL


# ═══════════════════════════════════════════════════════════════════
# AnomalyLog Tests
# ═══════════════════════════════════════════════════════════════════


class TestAnomalyLogModel:
    """Tests for the AnomalyLog ORM model."""

    def test_create_anomaly_log_defaults(self, db_session: Session) -> None:
        al = AnomalyLog(ward="Rohini")
        db_session.add(al)
        db_session.commit()
        db_session.refresh(al)

        assert al.id is not None
        assert al.ward == "Rohini"
        assert al.anomaly_type == "spike"
        assert al.severity == AnomalySeverity.WARNING
        assert al.expected_value == 0.0
        assert al.actual_value == 0.0
        assert al.deviation_percent == 0.0
        assert al.resolved == 0
        assert al.detected_at is not None

    def test_create_anomaly_log_full(self, db_session: Session) -> None:
        al = AnomalyLog(
            ward="Vikaspuri",
            department="Sanitation",
            anomaly_type="pattern_shift",
            severity=AnomalySeverity.CRITICAL,
            expected_value=15.0,
            actual_value=45.0,
            deviation_percent=200.0,
            description="Sudden tripling of complaints in sanitation sector.",
            resolved=0,
        )
        db_session.add(al)
        db_session.commit()
        db_session.refresh(al)

        assert al.severity == AnomalySeverity.CRITICAL
        assert al.deviation_percent == 200.0
        assert al.description is not None

    def test_anomaly_severity_enum(self) -> None:
        assert set(AnomalySeverity) == {
            AnomalySeverity.WARNING,
            AnomalySeverity.ALERT,
            AnomalySeverity.CRITICAL,
        }

    def test_anomaly_log_repr(self, db_session: Session) -> None:
        al = AnomalyLog(ward="Rohini", anomaly_type="spike")
        db_session.add(al)
        db_session.commit()
        db_session.refresh(al)
        assert "AnomalyLog" in repr(al)

    def test_anomaly_resolved_toggle(self, db_session: Session) -> None:
        al = AnomalyLog(ward="Lajpat Nagar", resolved=0)
        db_session.add(al)
        db_session.commit()

        al.resolved = 1
        db_session.commit()
        db_session.refresh(al)
        assert al.resolved == 1

    def test_filter_unresolved_anomalies(self, db_session: Session) -> None:
        db_session.add(AnomalyLog(ward="W1", resolved=0))
        db_session.add(AnomalyLog(ward="W1", resolved=1))
        db_session.add(AnomalyLog(ward="W1", resolved=0))
        db_session.commit()

        unresolved = db_session.query(AnomalyLog).filter_by(resolved=0).all()
        assert len(unresolved) == 2


# ═══════════════════════════════════════════════════════════════════
# GeoCluster Tests
# ═══════════════════════════════════════════════════════════════════


class TestGeoClusterModel:
    """Tests for the GeoCluster ORM model."""

    def test_create_geo_cluster_defaults(self, db_session: Session) -> None:
        gc = GeoCluster(ward="Pitampura", center_lat=28.6139, center_lng=77.2090)
        db_session.add(gc)
        db_session.commit()
        db_session.refresh(gc)

        assert gc.id is not None
        assert gc.ward == "Pitampura"
        assert gc.center_lat == pytest.approx(28.6139)
        assert gc.center_lng == pytest.approx(77.2090)
        assert gc.radius_meters == 500.0
        assert gc.issue_count == 0
        assert gc.density_score == 0.0

    def test_create_geo_cluster_with_boundary(self, db_session: Session) -> None:
        boundary = {
            "type": "Polygon",
            "coordinates": [[[77.0, 28.0], [77.1, 28.0], [77.1, 28.1], [77.0, 28.1], [77.0, 28.0]]],
        }
        gc = GeoCluster(
            ward="Mayur Vihar",
            center_lat=28.05,
            center_lng=77.05,
            radius_meters=1200.0,
            issue_count=25,
            density_score=0.85,
            dominant_department="Roads",
            boundary=boundary,
        )
        db_session.add(gc)
        db_session.commit()
        db_session.refresh(gc)

        assert gc.boundary is not None
        assert gc.boundary["type"] == "Polygon"
        assert gc.dominant_department == "Roads"
        assert gc.density_score == pytest.approx(0.85)

    def test_geo_cluster_repr(self, db_session: Session) -> None:
        gc = GeoCluster(ward="Dwarka", center_lat=0.0, center_lng=0.0)
        db_session.add(gc)
        db_session.commit()
        db_session.refresh(gc)
        assert "GeoCluster" in repr(gc)

    def test_multiple_clusters_per_ward(self, db_session: Session) -> None:
        for i in range(4):
            db_session.add(
                GeoCluster(
                    ward="Sadar Bazar",
                    center_lat=28.0 + i * 0.01,
                    center_lng=77.0 + i * 0.01,
                )
            )
        db_session.commit()
        results = db_session.query(GeoCluster).filter_by(ward="Sadar Bazar").all()
        assert len(results) == 4


# ═══════════════════════════════════════════════════════════════════
# TaskRecommendation Tests
# ═══════════════════════════════════════════════════════════════════


class TestTaskRecommendationModel:
    """Tests for the TaskRecommendation ORM model."""

    def test_create_recommendation_defaults(self, db_session: Session) -> None:
        tr = TaskRecommendation(
            ward="Karol Bagh",
            department="Electricity",
            title="Deploy additional transformer",
        )
        db_session.add(tr)
        db_session.commit()
        db_session.refresh(tr)

        assert tr.id is not None
        assert tr.status == RecommendationStatus.PROPOSED
        assert tr.priority_score == 0.0
        assert tr.created_at is not None
        assert tr.reviewed_at is None

    def test_create_recommendation_full(self, db_session: Session) -> None:
        tr = TaskRecommendation(
            ward="Tilak Nagar",
            department="Water Supply",
            title="Schedule pipe replacement",
            description="Aging infrastructure in sector B; leak frequency up 40%.",
            priority_score=88.0,
            status=RecommendationStatus.APPROVED,
            source_agent="operations",
            rationale={"leak_increase": 0.40, "pipe_age_years": 22},
            reviewed_at=datetime.now(timezone.utc),
        )
        db_session.add(tr)
        db_session.commit()
        db_session.refresh(tr)

        assert tr.status == RecommendationStatus.APPROVED
        assert tr.rationale["pipe_age_years"] == 22
        assert tr.reviewed_at is not None

    def test_recommendation_status_enum(self) -> None:
        assert set(RecommendationStatus) == {
            RecommendationStatus.PROPOSED,
            RecommendationStatus.APPROVED,
            RecommendationStatus.REJECTED,
            RecommendationStatus.EXECUTED,
            RecommendationStatus.EXPIRED,
        }

    def test_recommendation_repr(self, db_session: Session) -> None:
        tr = TaskRecommendation(
            ward="W", department="D", title="T",
        )
        db_session.add(tr)
        db_session.commit()
        db_session.refresh(tr)
        assert "TaskRecommendation" in repr(tr)

    def test_filter_by_status(self, db_session: Session) -> None:
        db_session.add(TaskRecommendation(ward="W1", department="D1", title="A", status=RecommendationStatus.PROPOSED))
        db_session.add(TaskRecommendation(ward="W1", department="D1", title="B", status=RecommendationStatus.APPROVED))
        db_session.add(TaskRecommendation(ward="W1", department="D1", title="C", status=RecommendationStatus.PROPOSED))
        db_session.commit()

        proposed = (
            db_session.query(TaskRecommendation)
            .filter_by(status=RecommendationStatus.PROPOSED)
            .all()
        )
        assert len(proposed) == 2


# ═══════════════════════════════════════════════════════════════════
# ExecutionFeedback Tests
# ═══════════════════════════════════════════════════════════════════


class TestExecutionFeedbackModel:
    """Tests for the ExecutionFeedback ORM model."""

    def _make_recommendation(self, db_session: Session) -> TaskRecommendation:
        tr = TaskRecommendation(
            ward="Dwarka",
            department="Sanitation",
            title="Deploy additional crew",
            status=RecommendationStatus.EXECUTED,
        )
        db_session.add(tr)
        db_session.commit()
        db_session.refresh(tr)
        return tr

    def test_create_feedback_defaults(self, db_session: Session) -> None:
        tr = self._make_recommendation(db_session)
        ef = ExecutionFeedback(recommendation_id=tr.id)
        db_session.add(ef)
        db_session.commit()
        db_session.refresh(ef)

        assert ef.id is not None
        assert ef.recommendation_id == tr.id
        assert ef.outcome == FeedbackOutcome.SUCCESS
        assert ef.executed_at is not None

    def test_create_feedback_full(self, db_session: Session) -> None:
        tr = self._make_recommendation(db_session)
        user_id = uuid.uuid4()
        ef = ExecutionFeedback(
            recommendation_id=tr.id,
            outcome=FeedbackOutcome.PARTIAL,
            outcome_detail="Crew deployed but vehicle breakdown delayed start.",
            impact_score=65.0,
            executed_by=user_id,
        )
        db_session.add(ef)
        db_session.commit()
        db_session.refresh(ef)

        assert ef.outcome == FeedbackOutcome.PARTIAL
        assert ef.impact_score == 65.0
        assert ef.executed_by == user_id

    def test_feedback_outcome_enum(self) -> None:
        assert set(FeedbackOutcome) == {
            FeedbackOutcome.SUCCESS,
            FeedbackOutcome.PARTIAL,
            FeedbackOutcome.FAILURE,
            FeedbackOutcome.CANCELLED,
        }

    def test_feedback_repr(self, db_session: Session) -> None:
        tr = self._make_recommendation(db_session)
        ef = ExecutionFeedback(recommendation_id=tr.id)
        db_session.add(ef)
        db_session.commit()
        db_session.refresh(ef)
        assert "ExecutionFeedback" in repr(ef)

    def test_cascade_delete(self, db_session: Session) -> None:
        """Deleting a TaskRecommendation cascades to its feedback."""
        tr = self._make_recommendation(db_session)
        ef = ExecutionFeedback(recommendation_id=tr.id, outcome=FeedbackOutcome.SUCCESS)
        db_session.add(ef)
        db_session.commit()

        db_session.delete(tr)
        db_session.commit()

        remaining = db_session.query(ExecutionFeedback).all()
        assert len(remaining) == 0

    def test_relationship_navigation(self, db_session: Session) -> None:
        """Can navigate from recommendation → feedback and back."""
        tr = self._make_recommendation(db_session)
        ef = ExecutionFeedback(recommendation_id=tr.id)
        db_session.add(ef)
        db_session.commit()
        db_session.refresh(tr)

        assert len(tr.feedback) == 1
        assert tr.feedback[0].recommendation.id == tr.id


# ═══════════════════════════════════════════════════════════════════
# AuditLog Tests
# ═══════════════════════════════════════════════════════════════════


class TestAuditLogModel:
    """Tests for the AuditLog ORM model."""

    def test_create_audit_log_minimal(self, db_session: Session) -> None:
        al = AuditLog(
            action=AuditAction.READ,
            resource_type="citizen",
        )
        db_session.add(al)
        db_session.commit()
        db_session.refresh(al)

        assert al.id is not None
        assert al.action == AuditAction.READ
        assert al.resource_type == "citizen"
        assert al.created_at is not None

    def test_create_audit_log_full(self, db_session: Session) -> None:
        user_id = uuid.uuid4()
        resource_id = uuid.uuid4()
        al = AuditLog(
            user_id=user_id,
            action=AuditAction.DECRYPT,
            resource_type="citizen",
            resource_id=str(resource_id),
            description="Decrypted contact_number field.",
            ip_address="192.168.1.42",
            user_agent="Mozilla/5.0",
            metadata_json={"reason": "verification", "field": "contact_number"},
        )
        db_session.add(al)
        db_session.commit()
        db_session.refresh(al)

        assert al.user_id == user_id
        assert al.action == AuditAction.DECRYPT
        assert al.ip_address == "192.168.1.42"
        assert al.metadata_json["field"] == "contact_number"

    def test_audit_action_enum_members(self) -> None:
        expected = {
            "CREATE", "READ", "UPDATE", "DELETE",
            "LOGIN", "LOGOUT", "DECRYPT", "EXPORT",
            "APPROVE", "REJECT",
        }
        assert {a.name for a in AuditAction} == expected

    def test_audit_log_repr(self, db_session: Session) -> None:
        al = AuditLog(action=AuditAction.LOGIN, resource_type="session")
        db_session.add(al)
        db_session.commit()
        db_session.refresh(al)
        assert "AuditLog" in repr(al)

    def test_audit_log_immutability_concept(self, db_session: Session) -> None:
        """Audit logs are append-only by design; verify insert works."""
        for action in [AuditAction.CREATE, AuditAction.READ, AuditAction.UPDATE]:
            db_session.add(AuditLog(action=action, resource_type="issue"))
        db_session.commit()
        all_logs = db_session.query(AuditLog).all()
        assert len(all_logs) == 3

    def test_filter_by_action(self, db_session: Session) -> None:
        db_session.add(AuditLog(action=AuditAction.LOGIN, resource_type="session"))
        db_session.add(AuditLog(action=AuditAction.LOGOUT, resource_type="session"))
        db_session.add(AuditLog(action=AuditAction.LOGIN, resource_type="session"))
        db_session.commit()

        logins = db_session.query(AuditLog).filter_by(action=AuditAction.LOGIN).all()
        assert len(logins) == 2

    def test_filter_by_resource_type(self, db_session: Session) -> None:
        db_session.add(AuditLog(action=AuditAction.READ, resource_type="citizen"))
        db_session.add(AuditLog(action=AuditAction.READ, resource_type="issue"))
        db_session.add(AuditLog(action=AuditAction.READ, resource_type="citizen"))
        db_session.commit()

        citizen_logs = db_session.query(AuditLog).filter_by(resource_type="citizen").all()
        assert len(citizen_logs) == 2


# ═══════════════════════════════════════════════════════════════════
# EncryptedFieldRegistry Tests
# ═══════════════════════════════════════════════════════════════════


class TestEncryptedFieldRegistryModel:
    """Tests for the EncryptedFieldRegistry ORM model."""

    def test_create_registry_entry_defaults(self, db_session: Session) -> None:
        entity_id = uuid.uuid4()
        efr = EncryptedFieldRegistry(
            entity_type="citizen",
            entity_id=entity_id,
            field_name="contact_number",
            key_reference="key-ref-001",
        )
        db_session.add(efr)
        db_session.commit()
        db_session.refresh(efr)

        assert efr.id is not None
        assert efr.entity_type == "citizen"
        assert efr.entity_id == entity_id
        assert efr.algorithm == EncryptionAlgorithm.FERNET
        assert efr.encrypted_at is not None

    def test_create_registry_entry_aes(self, db_session: Session) -> None:
        efr = EncryptedFieldRegistry(
            entity_type="citizen",
            entity_id=uuid.uuid4(),
            field_name="email",
            algorithm=EncryptionAlgorithm.AES_256_GCM,
            key_reference="key-ref-aes-001",
        )
        db_session.add(efr)
        db_session.commit()
        db_session.refresh(efr)

        assert efr.algorithm == EncryptionAlgorithm.AES_256_GCM

    def test_encryption_algo_enum(self) -> None:
        assert set(EncryptionAlgorithm) == {
            EncryptionAlgorithm.AES_256_GCM,
            EncryptionAlgorithm.FERNET,
        }

    def test_registry_repr(self, db_session: Session) -> None:
        efr = EncryptedFieldRegistry(
            entity_type="citizen",
            entity_id=uuid.uuid4(),
            field_name="contact_number",
            key_reference="k",
        )
        db_session.add(efr)
        db_session.commit()
        db_session.refresh(efr)
        assert "EncryptedFieldRegistry" in repr(efr)

    def test_multiple_fields_per_entity(self, db_session: Session) -> None:
        entity_id = uuid.uuid4()
        for field in ["contact_number", "email", "name"]:
            db_session.add(
                EncryptedFieldRegistry(
                    entity_type="citizen",
                    entity_id=entity_id,
                    field_name=field,
                    key_reference=f"key-{field}",
                )
            )
        db_session.commit()

        results = (
            db_session.query(EncryptedFieldRegistry)
            .filter_by(entity_id=entity_id)
            .all()
        )
        assert len(results) == 3

    def test_filter_by_entity_type(self, db_session: Session) -> None:
        db_session.add(EncryptedFieldRegistry(entity_type="citizen", entity_id=uuid.uuid4(), field_name="f1", key_reference="k"))
        db_session.add(EncryptedFieldRegistry(entity_type="issue", entity_id=uuid.uuid4(), field_name="f2", key_reference="k"))
        db_session.add(EncryptedFieldRegistry(entity_type="citizen", entity_id=uuid.uuid4(), field_name="f3", key_reference="k"))
        db_session.commit()

        citizen_entries = db_session.query(EncryptedFieldRegistry).filter_by(entity_type="citizen").all()
        assert len(citizen_entries) == 2


# ═══════════════════════════════════════════════════════════════════
# Cross-Model & Config Tests
# ═══════════════════════════════════════════════════════════════════


class TestPhase3Config:
    """Verify Phase 3 configuration settings exist."""

    def test_config_has_phase3_predictive_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert hasattr(s, "RISK_COMPUTATION_INTERVAL_HOURS")
        assert hasattr(s, "ANOMALY_DEVIATION_THRESHOLD")
        assert hasattr(s, "PREDICTION_WINDOW_DAYS")
        assert s.RISK_MODEL_VERSION == "v1.0"

    def test_config_has_phase3_geo_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert hasattr(s, "POSTGIS_ENABLED")
        assert s.POSTGIS_ENABLED is False
        assert s.GEO_CLUSTER_RADIUS_METERS == 500.0

    def test_config_has_phase3_privacy_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert hasattr(s, "ENCRYPTION_KEY")
        assert hasattr(s, "PII_FIELDS")

    def test_config_has_phase3_recommendation_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert s.RECOMMENDATION_EXPIRY_HOURS == 72
        assert s.MAX_RECOMMENDATIONS_PER_WARD == 10

    def test_config_has_phase3_observability_settings(self) -> None:
        from app.core.config import Settings
        s = Settings()
        assert s.AUDIT_LOG_RETENTION_DAYS == 365
        assert s.ENABLE_AUDIT_LOGGING is True


class TestPhase3ModelImports:
    """Verify Phase 3 models are exported from the models package."""

    def test_all_phase3_models_importable(self) -> None:
        from app.models import (
            RiskScore,
            AnomalyLog,
            GeoCluster,
            TaskRecommendation,
            ExecutionFeedback,
            AuditLog,
            EncryptedFieldRegistry,
        )
        assert RiskScore is not None
        assert AnomalyLog is not None
        assert GeoCluster is not None
        assert TaskRecommendation is not None
        assert ExecutionFeedback is not None
        assert AuditLog is not None
        assert EncryptedFieldRegistry is not None
