"""
NAYAM (नयम्) — Citizen Module Tests.

Tests for citizen CRUD operations, pagination, filtering,
and access control.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.citizen import Citizen
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.user import User


# ═══════════════════════════════════════════════════════════════════════
# CREATE CITIZEN TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestCreateCitizen:
    """Tests for POST /api/v1/citizens/."""

    def test_create_citizen_as_leader(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Leader should be able to create a citizen."""
        response = client.post(
            "/api/v1/citizens/",
            json={
                "name": "Suresh Patel",
                "contact_number": "9876543210",
                "ward": "Karol Bagh",
            },
            headers=auth_headers_leader,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Suresh Patel"
        assert data["ward"] == "Karol Bagh"
        assert "id" in data

    def test_create_citizen_as_staff(
        self, client: TestClient, auth_headers_staff: dict
    ) -> None:
        """Staff should be able to create a citizen."""
        response = client.post(
            "/api/v1/citizens/",
            json={
                "name": "Meena Sharma",
                "contact_number": "8765432109",
                "ward": "Dwarka",
            },
            headers=auth_headers_staff,
        )
        assert response.status_code == 201

    def test_create_citizen_missing_name(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Missing required field should return 422."""
        response = client.post(
            "/api/v1/citizens/",
            json={
                "contact_number": "9876543210",
                "ward": "Karol Bagh",
            },
            headers=auth_headers_leader,
        )
        assert response.status_code == 422

    def test_create_citizen_short_name(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Name shorter than 2 chars should return 422."""
        response = client.post(
            "/api/v1/citizens/",
            json={
                "name": "A",
                "contact_number": "9876543210",
                "ward": "Karol Bagh",
            },
            headers=auth_headers_leader,
        )
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# READ / LIST CITIZEN TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestListCitizens:
    """Tests for GET /api/v1/citizens/."""

    def test_list_citizens_empty(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Empty citizen list should return total=0."""
        response = client.get("/api/v1/citizens/", headers=auth_headers_leader)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["citizens"] == []

    def test_list_citizens_with_data(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """List should include existing citizens."""
        response = client.get("/api/v1/citizens/", headers=auth_headers_leader)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["citizens"][0]["name"] == sample_citizen.name

    def test_list_citizens_filter_by_ward(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Filter by ward should return matching citizens."""
        response = client.get(
            f"/api/v1/citizens/?ward={sample_citizen.ward}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_list_citizens_filter_no_match(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Filter with non-matching ward should return 0."""
        response = client.get(
            "/api/v1/citizens/?ward=NonExistentWard",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0

    def test_list_citizens_search_by_name(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Search by name substring should find matching citizens."""
        response = client.get(
            "/api/v1/citizens/?search=Ramesh",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_list_citizens_pagination(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Pagination should respect skip and limit."""
        response = client.get(
            "/api/v1/citizens/?skip=0&limit=1",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert len(response.json()["citizens"]) <= 1


class TestGetCitizen:
    """Tests for GET /api/v1/citizens/{citizen_id}."""

    def test_get_citizen_success(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Get citizen by valid ID should return the citizen."""
        response = client.get(
            f"/api/v1/citizens/{sample_citizen.id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert response.json()["name"] == sample_citizen.name

    def test_get_citizen_not_found(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Get citizen with non-existent ID should return 404."""
        fake_id = uuid.uuid4()
        response = client.get(
            f"/api/v1/citizens/{fake_id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]


# ═══════════════════════════════════════════════════════════════════════
# UPDATE CITIZEN TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestUpdateCitizen:
    """Tests for PUT /api/v1/citizens/{citizen_id}."""

    def test_update_citizen_success(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Updating a citizen should reflect the changes."""
        response = client.put(
            f"/api/v1/citizens/{sample_citizen.id}",
            json={"name": "Updated Name", "ward": "Vikaspuri"},
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["ward"] == "Vikaspuri"

    def test_partial_update_citizen(
        self, client: TestClient, auth_headers_staff: dict, sample_citizen: Citizen
    ) -> None:
        """Partial update (only ward) should work."""
        response = client.put(
            f"/api/v1/citizens/{sample_citizen.id}",
            json={"ward": "Model Town"},
            headers=auth_headers_staff,
        )
        assert response.status_code == 200
        assert response.json()["ward"] == "Model Town"
        assert response.json()["name"] == sample_citizen.name  # unchanged

    def test_update_nonexistent_citizen(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Updating non-existent citizen should return 404."""
        fake_id = uuid.uuid4()
        response = client.put(
            f"/api/v1/citizens/{fake_id}",
            json={"name": "Ghost"},
            headers=auth_headers_leader,
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# DELETE CITIZEN TESTS
# ═══════════════════════════════════════════════════════════════════════


class TestDeleteCitizen:
    """Tests for DELETE /api/v1/citizens/{citizen_id}."""

    def test_delete_citizen_as_leader(
        self, client: TestClient, auth_headers_leader: dict, sample_citizen: Citizen
    ) -> None:
        """Leader should be able to delete a citizen."""
        response = client.delete(
            f"/api/v1/citizens/{sample_citizen.id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    def test_delete_nonexistent_citizen(
        self, client: TestClient, auth_headers_leader: dict
    ) -> None:
        """Deleting non-existent citizen should return 404."""
        fake_id = uuid.uuid4()
        response = client.delete(
            f"/api/v1/citizens/{fake_id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 404

    def test_delete_citizen_cascades_issues(
        self,
        client: TestClient,
        auth_headers_leader: dict,
        db_session,
        sample_citizen: Citizen,
    ) -> None:
        """Deleting a citizen should cascade-delete their linked issues."""
        # Create an issue linked to the citizen
        issue = Issue(
            citizen_id=sample_citizen.id,
            department="Water Supply",
            description="Cascade test: water issue linked to citizen.",
            status=IssueStatus.OPEN,
            priority=IssuePriority.HIGH,
        )
        db_session.add(issue)
        db_session.commit()
        issue_id = issue.id

        # Verify issue exists
        response = client.get(
            f"/api/v1/issues/{issue_id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200

        # Delete the citizen
        response = client.delete(
            f"/api/v1/citizens/{sample_citizen.id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 200

        # Verify issue was cascade-deleted
        response = client.get(
            f"/api/v1/issues/{issue_id}",
            headers=auth_headers_leader,
        )
        assert response.status_code == 404
