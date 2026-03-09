"""
NAYAM (नयम्) — Seed Extras Script

Directly manipulates the database via SQLAlchemy to:
  1. Spread issue created_at dates across the past 30 days
  2. Insert realistic action_requests for the Approvals page

Run: python seed_extras.py
Does NOT require the backend to be running.
"""

import uuid
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Direct DB connection (SQLite) ────────────────────────────────────
DB_URL = "sqlite:///./nayam_dev.db"
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)


def spread_issue_dates():
    """Spread all issue created_at dates across the past 30 days."""
    print("[1/2] Spreading issue dates across past 30 days...")
    db = Session()
    try:
        rows = db.execute(text("SELECT id FROM issues")).fetchall()
        if not rows:
            print("  ⚠  No issues found in DB. Run seed_database.py first.")
            return

        now = datetime.now(timezone.utc)
        total = len(rows)
        for idx, (issue_id,) in enumerate(rows):
            # Spread across 30 days: earlier issues get older dates
            days_ago = int((1 - idx / total) * 30)
            hours_offset = random.randint(0, 23)
            minutes_offset = random.randint(0, 59)
            new_date = now - timedelta(days=days_ago, hours=hours_offset, minutes=minutes_offset)
            db.execute(
                text("UPDATE issues SET created_at = :dt WHERE id = :id"),
                {"dt": new_date.isoformat(), "id": str(issue_id)},
            )
        db.commit()
        print(f"  ✓ Updated {total} issues with varied dates (past 30 days)")
    finally:
        db.close()


def seed_action_requests():
    """Insert realistic action_requests into the DB."""
    print("[2/2] Seeding action requests for Approvals page...")
    db = Session()
    try:
        # Get the admin user ID
        user_row = db.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
        if not user_row:
            print("  ⚠  No users found. Run seed_database.py first.")
            return
        user_id = str(user_row[0])

        # Get some issue IDs for linking
        issue_rows = db.execute(text("SELECT id, description, department FROM issues LIMIT 20")).fetchall()
        issue_ids = [(str(r[0]), r[1], r[2]) for r in issue_rows]

        # Check if action_requests table exists
        try:
            db.execute(text("SELECT COUNT(*) FROM action_requests")).fetchone()
        except Exception:
            print("  ⚠  action_requests table doesn't exist. Start the backend first to create tables.")
            return

        # Clear existing action_requests
        db.execute(text("DELETE FROM action_requests"))

        now = datetime.now(timezone.utc)
        requests_data = [
            # ── Pending approvals (8) ────────────────────────────
            # NOTE: status must be UPPERCASE to match SQLAlchemy Enum names
            {
                "agent_name": "PolicyAgent",
                "action_type": "escalate_priority",
                "description": f"ISS-{issue_ids[0][0][:8]}: Escalate priority of water contamination issue in Ward-1 to Critical — multiple citizen complaints received. {issue_ids[0][1][:60]}",
                "status": "PENDING",
                "hours_ago": 2,
            },
            {
                "agent_name": "CitizenAgent",
                "action_type": "assign_department",
                "description": f"ISS-{issue_ids[1][0][:8]}: Reassign road pothole issue from Roads & Infrastructure to Emergency Services — structural risk detected. {issue_ids[1][1][:60]}",
                "status": "PENDING",
                "hours_ago": 4,
            },
            {
                "agent_name": "OperationsAgent",
                "action_type": "allocate_resources",
                "description": f"ISS-{issue_ids[2][0][:8]}: Allocate 3 additional water tankers to Ward-3 — supply deficit detected by AI analysis. Estimated cost: Rs. 15,000/day.",
                "status": "PENDING",
                "hours_ago": 5,
            },
            {
                "agent_name": "PolicyAgent",
                "action_type": "issue_advisory",
                "description": f"ISS-{issue_ids[3][0][:8]}: Issue public health advisory for Ward-7 — dengue case clustering detected. Recommend fogging operation within 24 hours.",
                "status": "PENDING",
                "hours_ago": 6,
            },
            {
                "agent_name": "OperationsAgent",
                "action_type": "schedule_maintenance",
                "description": f"ISS-{issue_ids[4][0][:8]}: Schedule emergency road repair on Highway-12 near school zone — AI risk assessment: 87% accident probability if unaddressed.",
                "status": "PENDING",
                "hours_ago": 8,
            },
            {
                "agent_name": "CitizenAgent",
                "action_type": "send_notification",
                "description": f"ISS-{issue_ids[5][0][:8]}: Send SMS alert to 340 affected residents in Ward-5 about scheduled water supply interruption (maintenance). Duration: 8 hours.",
                "status": "PENDING",
                "hours_ago": 10,
            },
            {
                "agent_name": "PolicyAgent",
                "action_type": "update_policy",
                "description": f"ISS-{issue_ids[6][0][:8]}: Update sanitation collection schedule for Ward-2 — AI detected 3-day gap in waste pickup causing complaints spike.",
                "status": "PENDING",
                "hours_ago": 12,
            },
            {
                "agent_name": "OperationsAgent",
                "action_type": "deploy_team",
                "description": f"ISS-{issue_ids[7][0][:8]}: Deploy vector control team to Ward-6 — predictive model forecasts 40% increase in mosquito-borne illness within 2 weeks.",
                "status": "PENDING",
                "hours_ago": 14,
            },
            # ── Approved (5) ─────────────────────────────────────
            {
                "agent_name": "PolicyAgent",
                "action_type": "escalate_priority",
                "description": f"ISS-{issue_ids[8][0][:8]}: Escalated streetlight outage in Ward-4 from Medium to High — safety concern near school. Approved by admin.",
                "status": "APPROVED",
                "hours_ago": 24,
            },
            {
                "agent_name": "OperationsAgent",
                "action_type": "allocate_resources",
                "description": f"ISS-{issue_ids[9][0][:8]}: Allocated emergency repair crew for burst water main in Ward-1. 4 workers deployed within 2 hours.",
                "status": "APPROVED",
                "hours_ago": 36,
            },
            {
                "agent_name": "CitizenAgent",
                "action_type": "send_notification",
                "description": f"ISS-{issue_ids[10][0][:8]}: Sent automated status update to 12 complainants about road repair progress in Ward-3. Estimated completion: 5 days.",
                "status": "APPROVED",
                "hours_ago": 48,
            },
            {
                "agent_name": "PolicyAgent",
                "action_type": "close_issue",
                "description": f"ISS-{issue_ids[11][0][:8]}: Auto-closed resolved garbage collection issue in Ward-8 — no complaints for 7 days. AI confidence: 94%.",
                "status": "APPROVED",
                "hours_ago": 72,
            },
            {
                "agent_name": "OperationsAgent",
                "action_type": "schedule_maintenance",
                "description": f"ISS-{issue_ids[12][0][:8]}: Scheduled transformer inspection in Ward-2 after AI detected voltage fluctuation pattern. Maintenance window: Sunday 6AM-12PM.",
                "status": "APPROVED",
                "hours_ago": 96,
            },
            # ── Rejected (3) ─────────────────────────────────────
            {
                "agent_name": "PolicyAgent",
                "action_type": "reallocate_budget",
                "description": f"ISS-{issue_ids[13][0][:8]}: AI suggested reallocating Rs. 5 lakhs from Education budget to Emergency Road Repair. Rejected — education funds are ring-fenced.",
                "status": "REJECTED",
                "hours_ago": 50,
            },
            {
                "agent_name": "CitizenAgent",
                "action_type": "auto_close_issue",
                "description": f"ISS-{issue_ids[14][0][:8]}: AI suggested auto-closing pension delay complaint. Rejected — issue still active, citizen confirmed non-resolution.",
                "status": "REJECTED",
                "hours_ago": 60,
            },
            {
                "agent_name": "OperationsAgent",
                "action_type": "reduce_frequency",
                "description": f"ISS-{issue_ids[15][0][:8]}: AI suggested reducing fogging frequency in Ward-5 from daily to weekly. Rejected — dengue cases still rising.",
                "status": "REJECTED",
                "hours_ago": 80,
            },
        ]

        created = 0
        for req in requests_data:
            action_id = uuid.uuid4().hex
            session_id = uuid.uuid4().hex
            created_at = now - timedelta(hours=req["hours_ago"])
            reviewed_at = None
            reviewed_by = None
            review_note = None

            if req["status"] == "APPROVED":
                reviewed_at = (created_at + timedelta(hours=random.randint(1, 4))).isoformat()
                reviewed_by = user_id
                review_note = "Approved via dashboard review"
            elif req["status"] == "REJECTED":
                reviewed_at = (created_at + timedelta(hours=random.randint(1, 6))).isoformat()
                reviewed_by = user_id
                review_note = "Rejected — requires further review"

            db.execute(
                text("""
                    INSERT INTO action_requests
                    (id, session_id, agent_name, action_type, description, payload, status,
                     requested_by, reviewed_by, review_note, created_at, reviewed_at)
                    VALUES
                    (:id, :session_id, :agent_name, :action_type, :description, :payload, :status,
                     :requested_by, :reviewed_by, :review_note, :created_at, :reviewed_at)
                """),
                {
                    "id": action_id,
                    "session_id": session_id,
                    "agent_name": req["agent_name"],
                    "action_type": req["action_type"],
                    "description": req["description"],
                    "payload": "{}",
                    "status": req["status"],
                    "requested_by": user_id,
                    "reviewed_by": reviewed_by,
                    "review_note": review_note,
                    "created_at": created_at.isoformat(),
                    "reviewed_at": reviewed_at,
                },
            )
            created += 1

        db.commit()
        pending = sum(1 for r in requests_data if r["status"] == "PENDING")
        approved = sum(1 for r in requests_data if r["status"] == "APPROVED")
        rejected = sum(1 for r in requests_data if r["status"] == "REJECTED")
        print(f"  ✓ Created {created} action requests:")
        print(f"    Pending:  {pending}")
        print(f"    Approved: {approved}")
        print(f"    Rejected: {rejected}")
    finally:
        db.close()


def main():
    print("=" * 60)
    print("  NAYAM — Seed Extras (Dates + Approvals)")
    print("=" * 60)
    print()
    spread_issue_dates()
    print()
    seed_action_requests()
    print()
    print("=" * 60)
    print("  ✓ Done! Restart the backend and refresh the frontend.")
    print("=" * 60)


if __name__ == "__main__":
    main()
