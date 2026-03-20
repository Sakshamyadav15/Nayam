"""
NAYAM (नयम्) — Issue Module Tests.

Tests for issue CRUD, FK integrity, filtering, status/priority handling.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.models.citizen import Citizen
from app.models.issue import Issue, IssueStatus, IssuePriority


# ═══════════════════════════════════════════════════════════════════════
# CREATE ISSUE TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestCreateIssue:
    """Tests for POST /api/v1/issues/."""

    def test_create_issue_success(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Creating an issue linked to a valid citizen should succeed."""
        response = client.post(
            "/api/v1/issues/",
            json={
                "citizen_id": str(sample_citizen.id),
                "department": "Road & Transport",
                "description": "Pothole on main road near Saket bus stop causing accidents.",
                "priority": "High",
            },
            headers=auth_headers_leader,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["department"] == "Road & Transport"
        assert data["status"] == "Open"
        assert data["priority"] == "High"
        assert data["citizen_id"] == str(sample_citizen.id)

    def test_create_issue_invalid_citizen(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Creating an issue with non-existent citizen should return 404."""
        fake_citizen_id = uuid.uuid4()
        response = client.post(
            "/api/v1/issues/",
            json={
                "citizen_id": str(fake_citizen_id),
                "department": "Water Supply",
                "description": "No water in the area for three days straight.",
            },
            headers=auth_headers_leader,
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_create_issue_short_description(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Description shorter than 10 chars should return 422."""
        response = client.post(
            "/api/v1/issues/",
            json={
                "citizen_id": str(sample_citizen.id),
                "department": "Health",
                "description": "Short",
            },
            headers=auth_headers_leader,
        )
        assert response.status_code == 422

    def test_create_issue_default_status_and_priority(
        self, client: TestClient, auth_headers_staff: dict, sample_citizen: Citizen
    ) -> None:
        """Issue without explicit status/priority should default to Open/Medium."""
        response = client.post(
            "/api/v1/issues/",
            json={
                "citizen_id": str(sample_citizen.id),
                "department": "Education",
                "description": "School building needs repair in Saket area urgently.",
            },
            headers=auth_headers_staff,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "Open"
        assert data["priority"] == "Medium"


# ═══════════════════════════════════════════════════════════════════════
# LIST / FILTER ISSUE TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestListIssues:
    """Tests for GET /api/v1/issues/ with filtering."""

    def test_list_issues_empty(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Empty issue list should return total=0."""
        response = client.get("/api/v1/issues/", headers=auth_headers_leader)
        assert response.status_code == 200
        assert response.json()["total"] == 0

    def test_list_issues_with_data(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """List should include existing issues."""
        response = client.get("/api/v1/issues/", headers=auth_headers_leader)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["issues"][0]["department"] == "Water Supply"

    def test_filter_by_status(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """Filter by status should return matching issues."""
        response = client.get(
            "/api/v1/issues/?status=Open",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_filter_by_status_no_match(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """Filter by non-matching status should return 0."""
        response = client.get(
            "/api/v1/issues/?status=Closed",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0

    def test_filter_by_priority(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """Filter by priority should work."""
        response = client.get(
            "/api/v1/issues/?priority=High",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_filter_by_department(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """Filter by department should work."""
        response = client.get(
            "/api/v1/issues/?department=Water+Supply",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_filter_by_citizen_id(
        self,
        client: TestClient,
        auth_headers_leader: dict,
        sample_issue: Issue,
        sample_citizen: Citizen,
    ) -> None:
        """Filter by citizen_id should return their issues."""
        response = client.get(
            f"/api/v1/issues/?citizen_id={sample_citizen.id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_filter_by_ward(
        self,
        client: TestClient,
        auth_headers_leader: dict,
        sample_issue: Issue,
        sample_citizen: Citizen,
    ) -> None:
        """Filter by ward should return issues from citizens in that ward."""
        response = client.get(
            f"/api/v1/issues/?ward={sample_citizen.ward}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_filter_by_ward_no_match(
        self,
        client: TestClient,
        auth_headers_leader: dict,
        sample_issue: Issue,
    ) -> None:
        """Filter with non-matching ward should return 0."""
        response = client.get(
            "/api/v1/issues/?ward=NonExistentWard",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0


# ═══════════════════════════════════════════════════════════════════════
# GET SINGLE ISSUE TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestGetIssue:
    """Tests for GET /api/v1/issues/{issue_id}."""

    def test_get_issue_success(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """Get issue by valid ID should return the issue."""
        response = client.get(
            f"/api/v1/issues/{sample_issue.id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["department"] == "Water Supply"

    def test_get_issue_not_found(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Get issue with non-existent ID should return 404."""
        fake_id = uuid.uuid4()
        response = client.get(
            f"/api/v1/issues/{fake_id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# UPDATE ISSUE TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestUpdateIssue:
    """Tests for PUT /api/v1/issues/{issue_id}."""

    def test_update_issue_status(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """Updating issue status should reflect the change."""
        response = client.put(
            f"/api/v1/issues/{sample_issue.id}",
            json={"status": "In Progress"},
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "In Progress"

    def test_update_issue_priority(
        self, client: TestClient, auth_headers_staff: dict, sample_issue: Issue
    ) -> None:
        """Updating issue priority should reflect the change."""
        response = client.put(
            f"/api/v1/issues/{sample_issue.id}",
            json={"priority": "Low"},
            headers=auth_headers_staff,
        )
        assert response.status_code == 200
        assert response.json()["priority"] == "Low"

    def test_update_issue_not_found(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Updating non-existent issue should return 404."""
        fake_id = uuid.uuid4()
        response = client.put(
            f"/api/v1/issues/{fake_id}",
            json={"status": "Closed"},
            headers=auth_headers_leader,
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# DELETE ISSUE TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestDeleteIssue:
    """Tests for DELETE /api/v1/issues/{issue_id}."""

    def test_delete_issue_as_leader(
        self, client: TestClient, auth_headers_leader: dict, sample_issue: Issue
    ) -> None:
        """Leader should be able to delete an issue."""
        response = client.delete(
            f"/api/v1/issues/{sample_issue.id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    def test_delete_issue_as_staff_denied(
        self, client: TestClient, auth_headers_staff: dict, sample_issue: Issue
    ) -> None:
        """Staff should not be able to delete issues (Leader only)."""
        response = client.delete(
            f"/api/v1/issues/{sample_issue.id}",
            headers=auth_headers_staff,
        )
        assert response.status_code == 403

    def test_delete_nonexistent_issue(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Deleting non-existent issue should return 404."""
        fake_id = uuid.uuid4()
        response = client.delete(
            f"/api/v1/issues/{fake_id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 404
