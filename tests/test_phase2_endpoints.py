"""
NAYAM (नयम्) — Phase 2 Step 4: API Endpoint Tests.

Covers:
  • /api/v1/agent/query          — POST  (agent query pipeline)
  • /api/v1/agent/agents         — GET   (list agents)
  • /api/v1/agent/sessions/{id}  — GET   (session history)
  • /api/v1/actions/             — GET   (list actions)
  • /api/v1/actions/pending      — GET   (pending actions)
  • /api/v1/actions/{id}         — GET   (action detail)
  • /api/v1/actions/{id}/review  — POST  (approve / reject)
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.action_request import ActionRequest, ActionStatus
from app.models.user import User, UserRole


# ═════════════════════════════════════════════════════════════════
# Helpers
# ═════════════════════════════════════════════════════════════════

def _seed_action(db: Session, user: User) -> ActionRequest:
    """Create a pending action request directly in the DB."""
    action = ActionRequest(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_name="PolicyAgent",
        action_type="policy_recommendation",
        description="Test action",
        payload={"key": "value"},
        status=ActionStatus.PENDING,
        requested_by=user.id,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


# ═════════════════════════════════════════════════════════════════
# 1. Agent Query Endpoint
# ═════════════════════════════════════════════════════════════════

class TestAgentQueryEndpoint:

    def test_query_success(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": "What is the latest government policy?"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["agent_name"] == "PolicyAgent"
        assert len(data["response"]) > 0
        assert data["confidence"] > 0

    def test_query_routes_to_citizen_agent(
        self, client: TestClient, auth_headers_staff: dict,
    ) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": "Show citizen complaints in Saket"},
            headers=auth_headers_staff,
        )
        assert resp.status_code == 200
        assert resp.json()["agent_name"] == "CitizenAgent"

    def test_query_routes_to_operations_agent(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": "Allocate staff to the sanitation department"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        assert resp.json()["agent_name"] == "OperationsAgent"

    def test_query_forced_agent(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": "anything", "agent_name": "CitizenAgent"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        assert resp.json()["agent_name"] == "CitizenAgent"

    def test_query_unknown_agent(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": "anything", "agent_name": "UnknownAgent"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 400

    def test_query_creates_pending_actions(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": "Update the water policy notification immediately"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        data = resp.json()
        # "update" + "notification" trigger PolicyAgent actions
        assert len(data["pending_actions"]) >= 1
        assert data["pending_actions"][0]["status"] == "pending"

    def test_query_with_existing_session(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        # First query — creates session
        r1 = client.post(
            "/api/v1/agent/query",
            json={"query": "Tell me about water policy"},
            headers=auth_headers_leader,
        )
        sid = r1.json()["session_id"]

        # Second query — same session
        r2 = client.post(
            "/api/v1/agent/query",
            json={"query": "Any citizen complaints?", "session_id": sid},
            headers=auth_headers_leader,
        )
        assert r2.status_code == 200
        assert r2.json()["session_id"] == sid

    def test_query_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": "test"},
        )
        assert resp.status_code == 401

    def test_query_empty_body(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.post(
            "/api/v1/agent/query",
            json={"query": ""},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 422  # Pydantic validation: min_length=1


# ═════════════════════════════════════════════════════════════════
# 2. Agent Listing Endpoint
# ═════════════════════════════════════════════════════════════════

class TestAgentListEndpoint:

    def test_list_agents(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.get("/api/v1/agent/agents", headers=auth_headers_leader)
        assert resp.status_code == 200
        data = resp.json()
        names = {a["name"] for a in data["agents"]}
        assert names == {"PolicyAgent", "CitizenAgent", "OperationsAgent"}

    def test_list_agents_unauthenticated(self, client: TestClient) -> None:
        resp = client.get("/api/v1/agent/agents")
        assert resp.status_code == 401


# ═════════════════════════════════════════════════════════════════
# 3. Session History Endpoint
# ═════════════════════════════════════════════════════════════════

class TestSessionHistoryEndpoint:

    def test_session_history_after_query(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        # Create a session via query
        r1 = client.post(
            "/api/v1/agent/query",
            json={"query": "What policies exist?"},
            headers=auth_headers_leader,
        )
        sid = r1.json()["session_id"]

        # Fetch history
        resp = client.get(
            f"/api/v1/agent/sessions/{sid}/history",
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == sid
        assert data["total"] == 2  # user + assistant
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"

    def test_session_history_empty_session(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        fake_sid = str(uuid.uuid4())
        resp = client.get(
            f"/api/v1/agent/sessions/{fake_sid}/history",
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_session_history_unauthenticated(self, client: TestClient) -> None:
        resp = client.get(f"/api/v1/agent/sessions/{uuid.uuid4()}/history")
        assert resp.status_code == 401


# ═════════════════════════════════════════════════════════════════
# 4. Actions — List Endpoints
# ═════════════════════════════════════════════════════════════════

class TestActionsListEndpoint:

    def test_list_all_empty(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.get("/api/v1/actions/", headers=auth_headers_leader)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["actions"] == []

    def test_list_all_with_data(
        self, client: TestClient, auth_headers_leader: dict,
        db_session: Session, leader_user: User,
    ) -> None:
        _seed_action(db_session, leader_user)
        _seed_action(db_session, leader_user)

        resp = client.get("/api/v1/actions/", headers=auth_headers_leader)
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    def test_list_pending(
        self, client: TestClient, auth_headers_leader: dict,
        db_session: Session, leader_user: User,
    ) -> None:
        _seed_action(db_session, leader_user)
        resp = client.get("/api/v1/actions/pending", headers=auth_headers_leader)
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_list_actions_unauthenticated(self, client: TestClient) -> None:
        resp = client.get("/api/v1/actions/")
        assert resp.status_code == 401


# ═════════════════════════════════════════════════════════════════
# 5. Actions — Detail Endpoint
# ═════════════════════════════════════════════════════════════════

class TestActionDetailEndpoint:

    def test_get_action_success(
        self, client: TestClient, auth_headers_leader: dict,
        db_session: Session, leader_user: User,
    ) -> None:
        action = _seed_action(db_session, leader_user)
        resp = client.get(
            f"/api/v1/actions/{action.id}",
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(action.id)
        assert data["status"] == "pending"
        assert data["agent_name"] == "PolicyAgent"

    def test_get_action_not_found(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.get(
            f"/api/v1/actions/{uuid.uuid4()}",
            headers=auth_headers_leader,
        )
        assert resp.status_code == 404


# ═════════════════════════════════════════════════════════════════
# 6. Actions — Review Endpoint
# ═════════════════════════════════════════════════════════════════

class TestActionReviewEndpoint:

    def test_approve_action(
        self, client: TestClient, auth_headers_leader: dict,
        db_session: Session, leader_user: User,
    ) -> None:
        action = _seed_action(db_session, leader_user)
        resp = client.post(
            f"/api/v1/actions/{action.id}/review",
            json={"status": "approved", "review_note": "Approved by leader"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "approved"
        assert data["reviewed_by"] == str(leader_user.id)
        assert data["review_note"] == "Approved by leader"

    def test_reject_action(
        self, client: TestClient, auth_headers_leader: dict,
        db_session: Session, leader_user: User,
    ) -> None:
        action = _seed_action(db_session, leader_user)
        resp = client.post(
            f"/api/v1/actions/{action.id}/review",
            json={"status": "rejected", "review_note": "Needs revision"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    def test_approve_by_staff(
        self, client: TestClient, auth_headers_staff: dict,
        db_session: Session, staff_user: User,
    ) -> None:
        action = _seed_action(db_session, staff_user)
        resp = client.post(
            f"/api/v1/actions/{action.id}/review",
            json={"status": "approved"},
            headers=auth_headers_staff,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    def test_analyst_cannot_review(
        self, client: TestClient, auth_headers_analyst: dict,
        db_session: Session, analyst_user: User,
    ) -> None:
        action = _seed_action(db_session, analyst_user)
        resp = client.post(
            f"/api/v1/actions/{action.id}/review",
            json={"status": "approved"},
            headers=auth_headers_analyst,
        )
        assert resp.status_code == 403

    def test_cannot_review_already_reviewed(
        self, client: TestClient, auth_headers_leader: dict,
        db_session: Session, leader_user: User,
    ) -> None:
        action = _seed_action(db_session, leader_user)

        # First review — approve
        client.post(
            f"/api/v1/actions/{action.id}/review",
            json={"status": "approved"},
            headers=auth_headers_leader,
        )
        # Second review — should fail
        resp = client.post(
            f"/api/v1/actions/{action.id}/review",
            json={"status": "rejected"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 400

    def test_review_nonexistent_action(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        resp = client.post(
            f"/api/v1/actions/{uuid.uuid4()}/review",
            json={"status": "approved"},
            headers=auth_headers_leader,
        )
        assert resp.status_code == 404

    def test_review_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(
            f"/api/v1/actions/{uuid.uuid4()}/review",
            json={"status": "approved"},
        )
        assert resp.status_code == 401


# ═════════════════════════════════════════════════════════════════
# 7. End-to-End: Query → Actions → Review
# ═════════════════════════════════════════════════════════════════

class TestE2EAgentToApproval:

    def test_query_produces_actions_and_leader_approves(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        # 1) Query that triggers an action
        r1 = client.post(
            "/api/v1/agent/query",
            json={"query": "Update the electricity subsidy policy notification"},
            headers=auth_headers_leader,
        )
        assert r1.status_code == 200
        pending = r1.json()["pending_actions"]
        assert len(pending) >= 1

        # 2) Verify it shows in the pending list
        r2 = client.get("/api/v1/actions/pending", headers=auth_headers_leader)
        assert r2.json()["total"] >= 1

        # 3) Approve the first pending action
        aid = pending[0]["id"]
        r3 = client.post(
            f"/api/v1/actions/{aid}/review",
            json={"status": "approved", "review_note": "LGTM"},
            headers=auth_headers_leader,
        )
        assert r3.status_code == 200
        assert r3.json()["status"] == "approved"

        # 4) The action should no longer be in the pending list
        r4 = client.get("/api/v1/actions/pending", headers=auth_headers_leader)
        pending_ids = [a["id"] for a in r4.json()["actions"]]
        assert aid not in pending_ids

    def test_multi_turn_then_history(
        self, client: TestClient, auth_headers_leader: dict,
    ) -> None:
        # Turn 1
        r1 = client.post(
            "/api/v1/agent/query",
            json={"query": "water policy details"},
            headers=auth_headers_leader,
        )
        sid = r1.json()["session_id"]

        # Turn 2 — same session
        client.post(
            "/api/v1/agent/query",
            json={"query": "citizen complaints in Saket", "session_id": sid},
            headers=auth_headers_leader,
        )

        # Verify history has 4 messages
        r3 = client.get(
            f"/api/v1/agent/sessions/{sid}/history",
            headers=auth_headers_leader,
        )
        assert r3.json()["total"] == 4
