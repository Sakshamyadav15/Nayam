"""
NAYAM (नयम्) — Integration & System (End-to-End) Tests.

Validates cross-module workflows per the Testing Document:
§3 — Integration Testing
§4 — System Testing (End-to-End)
"""

import io
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.citizen import Citizen
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.document import Document


# ═══════════════════════════════════════════════════════════════════════
# §3 — INTEGRATION TESTING
# ═══════════════════════════════════════════════════════════════════════


class TestIntegrationAuthAndData:
    """
    §3.1 — Login user and create citizen + issue in same session.
    §3.3 — Ensure role-based restriction works across endpoints.
    """

    def test_login_then_create_citizen_and_issue(self, client: TestClient, leader_user: User) -> None:
        """Login as Leader, create citizen, then create issue linked to citizen."""
        # Step 1: Login
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "leader@nayam.dev", "password": "LeaderPass123"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Step 2: Create citizen
        citizen_resp = client.post(
            "/api/v1/citizens/",
            json={"name": "Integration Citizen", "contact_number": "9988776655", "ward": "Pitampura"},
            headers=headers,
        )
        assert citizen_resp.status_code == 201
        citizen_id = citizen_resp.json()["id"]

        # Step 3: Create issue linked to citizen
        issue_resp = client.post(
            "/api/v1/issues/",
            json={
                "citizen_id": citizen_id,
                "department": "Health",
                "description": "Integration test: health clinic needs supplies urgently.",
                "priority": "High",
            },
            headers=headers,
        )
        assert issue_resp.status_code == 201
        assert issue_resp.json()["citizen_id"] == citizen_id
        assert issue_resp.json()["status"] == "Open"

    def test_role_restriction_across_endpoints(self, client: TestClient, analyst_user: User) -> None:
        """Analyst can read data but cannot create/delete across endpoints."""
        # Login as Analyst
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "analyst@nayam.dev", "password": "AnalystPass123"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Can read citizens
        assert client.get("/api/v1/citizens/", headers=headers).status_code == 200

        # Can read issues
        assert client.get("/api/v1/issues/", headers=headers).status_code == 200

        # Can read dashboard
        assert client.get("/api/v1/dashboard/", headers=headers).status_code == 200

        # Cannot create citizen
        assert client.post(
            "/api/v1/citizens/",
            json={"name": "Should Fail", "contact_number": "0000000000", "ward": "Dwarka"},
            headers=headers,
        ).status_code == 403

        # Cannot upload document
        assert client.post(
            "/api/v1/documents/upload",
            data={"title": "Should Fail"},
            files={"file": ("test.pdf", io.BytesIO(b"content"), "application/pdf")},
            headers=headers,
        ).status_code == 403


class TestIntegrationDocumentDashboard:
    """
    §3.2 — Upload document and verify summary appears in dashboard.
    """

    def test_upload_document_and_verify_in_dashboard(
        self, client: TestClient, leader_user: User
    ) -> None:
        """Upload a document and verify it appears in dashboard recent_documents."""
        # Login
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "leader@nayam.dev", "password": "LeaderPass123"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Upload document
        file_content = b"%PDF-1.4 Integration test document content"
        upload_resp = client.post(
            "/api/v1/documents/upload",
            data={"title": "Integration Report"},
            files={"file": ("integration.pdf", io.BytesIO(file_content), "application/pdf")},
            headers=headers,
        )
        assert upload_resp.status_code == 201
        doc_data = upload_resp.json()
        assert doc_data["summary"] is not None
        assert doc_data["extracted_text"] is not None

        # Verify document appears in dashboard
        dash_resp = client.get("/api/v1/dashboard/", headers=headers)
        assert dash_resp.status_code == 200
        dash_data = dash_resp.json()
        assert dash_data["total_documents"] == 1
        assert dash_data["recent_documents"][0]["title"] == "Integration Report"


class TestIntegrationTransactionRollback:
    """
    §3.4 — Verify database transactions rollback on failure.
    """

    def test_invalid_issue_does_not_persist(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Creating an issue with invalid citizen FK should not persist any data."""
        fake_citizen = uuid.uuid4()
        response = client.post(
            "/api/v1/issues/",
            json={
                "citizen_id": str(fake_citizen),
                "department": "Education",
                "description": "This issue should not be created because citizen is invalid.",
            },
            headers=auth_headers_leader,
        )
        assert response.status_code == 404

        # Verify no issues were persisted
        list_resp = client.get("/api/v1/issues/", headers=auth_headers_leader)
        assert list_resp.json()["total"] == 0


# ═══════════════════════════════════════════════════════════════════════
# §4 — SYSTEM TESTING (END-TO-END)
# ═══════════════════════════════════════════════════════════════════════


class TestFullGovernanceWorkflow:
    """
    §4.1 — Full Governance Workflow Test.

    Register and login as Leader → Create citizen profile →
    Create issue linked to citizen → Upload related document →
    Verify document summary generation → Confirm issue and summary
    visible on dashboard.
    """

    def test_full_e2e_workflow(self, client: TestClient) -> None:
        """Complete end-to-end governance workflow."""

        # ── Step 1: Register as Leader ───────────────────────────
        reg_resp = client.post(
            "/api/v1/auth/register",
            json={
                "name": "E2E Leader",
                "email": "e2e-leader@nayam.dev",
                "password": "E2ELeaderPass123",
                "role": "Leader",
            },
        )
        assert reg_resp.status_code == 201
        token = reg_resp.json()["access_token"]
        assert reg_resp.json()["user"]["role"] == "Leader"
        headers = {"Authorization": f"Bearer {token}"}

        # ── Step 2: Create citizen profile ───────────────────────
        citizen_resp = client.post(
            "/api/v1/citizens/",
            json={
                "name": "E2E Citizen Ravi",
                "contact_number": "9112233445",
                "ward": "Vikaspuri",
            },
            headers=headers,
        )
        assert citizen_resp.status_code == 201
        citizen_id = citizen_resp.json()["id"]
        assert citizen_resp.json()["name"] == "E2E Citizen Ravi"

        # ── Step 3: Create issue linked to citizen ───────────────
        issue_resp = client.post(
            "/api/v1/issues/",
            json={
                "citizen_id": citizen_id,
                "department": "Sanitation",
                "description": "E2E test: garbage collection has not occurred for two weeks.",
                "priority": "High",
            },
            headers=headers,
        )
        assert issue_resp.status_code == 201
        issue_data = issue_resp.json()
        assert issue_data["citizen_id"] == citizen_id
        assert issue_data["status"] == "Open"
        assert issue_data["priority"] == "High"

        # ── Step 4: Upload related document ──────────────────────
        file_content = b"%PDF-1.4 E2E Sanitation Report Content"
        doc_resp = client.post(
            "/api/v1/documents/upload",
            data={"title": "Sanitation Inspection Report"},
            files={"file": ("sanitation_report.pdf", io.BytesIO(file_content), "application/pdf")},
            headers=headers,
        )
        assert doc_resp.status_code == 201
        doc_data = doc_resp.json()
        assert doc_data["title"] == "Sanitation Inspection Report"

        # ── Step 5: Verify document summary generation ───────────
        assert doc_data["extracted_text"] is not None
        assert len(doc_data["extracted_text"]) > 0
        assert doc_data["summary"] is not None
        assert len(doc_data["summary"]) > 0

        # ── Step 6: Confirm issue and summary visible on dashboard
        dash_resp = client.get("/api/v1/dashboard/", headers=headers)
        assert dash_resp.status_code == 200
        dash = dash_resp.json()

        # Issue visible
        assert dash["total_issues"] == 1
        dept_names = [d["department"] for d in dash["issues_by_department"]]
        assert "Sanitation" in dept_names

        # Document visible
        assert dash["total_documents"] == 1
        assert dash["recent_documents"][0]["title"] == "Sanitation Inspection Report"


class TestSecurityValidation:
    """
    §4.2 — Security Validation.
    """

    def test_access_protected_without_token(self, client: TestClient) -> None:
        """Accessing protected endpoints without token should return 401."""
        assert client.get("/api/v1/citizens/").status_code == 401
        assert client.get("/api/v1/issues/").status_code == 401
        assert client.get("/api/v1/documents/").status_code == 401
        assert client.get("/api/v1/dashboard/").status_code == 401

    def test_privilege_escalation_staff_to_leader(
        self, client: TestClient, auth_headers_staff: dict, sample_citizen: Citizen
    ) -> None:
        """Staff should not be able to perform Leader-only actions."""
        # Staff cannot delete citizen
        response = client.delete(
            f"/api/v1/citizens/{sample_citizen.id}",
            headers=auth_headers_staff,
        )
        assert response.status_code == 403

    def test_invalid_jwt_rejected_across_endpoints(self, client: TestClient) -> None:
        """Invalid JWT tokens should be rejected on all protected endpoints."""
        bad_headers = {"Authorization": "Bearer forged.jwt.token"}
        assert client.get("/api/v1/citizens/", headers=bad_headers).status_code == 401
        assert client.get("/api/v1/issues/", headers=bad_headers).status_code == 401
        assert client.get("/api/v1/documents/", headers=bad_headers).status_code == 401
        assert client.get("/api/v1/dashboard/", headers=bad_headers).status_code == 401

    def test_password_hashing_strength(self) -> None:
        """Password hashes should use bcrypt (starts with $2b$)."""
        from app.core.security import hash_password
        hashed = hash_password("TestPassword123")
        assert hashed.startswith("$2b$")
