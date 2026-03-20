"""
NAYAM (नयम्) — Phase 2 Step 3: Service Layer & Agent Framework Tests.

Covers:
  • MemoryService        – conversation & embedding operations
  • ApprovalService      – action lifecycle, RBAC, expiry
  • PolicyAgent          – execute, action detection, system prompt
  • CitizenAgent         – execute, action detection, system prompt
  • OperationsAgent      – execute, action detection, system prompt
  • AgentRouter          – keyword scoring, routing, default fallback
  • AgentService         – end-to-end orchestration
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from app.agents.base import AgentContext, AgentResponse, BaseAgent
from app.agents.citizen import CitizenAgent
from app.agents.operations import OperationsAgent
from app.agents.policy import PolicyAgent
from app.agents.router import AgentRouter
from app.models.action_request import ActionRequest, ActionStatus
from app.models.conversation import Conversation, MessageRole
from app.models.embedding import Embedding
from app.models.user import User, UserRole
from app.services.agent import AgentService
from app.services.approval import ApprovalService
from app.services.memory import MemoryService


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def _make_user(db: Session, role: UserRole = UserRole.LEADER) -> User:
    """Quick user factory."""
    from app.core.security import hash_password

    user = User(
        id=uuid.uuid4(),
        name=f"Test {role.value.title()}",
        email=f"{role.value}_{uuid.uuid4().hex[:6]}@nayam.dev",
        password_hash=hash_password("TestPass123"),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ═════════════════════════════════════════════════════════════════
# 1. MemoryService
# ═════════════════════════════════════════════════════════════════

class TestMemoryService:
    """Tests for app.services.memory.MemoryService."""

    def test_store_single_message(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        sid = uuid.uuid4()
        uid = uuid.uuid4()

        msg = svc.store_message(sid, uid, MessageRole.USER, "hello")
        assert msg.id is not None
        assert msg.session_id == sid
        assert msg.role == MessageRole.USER
        assert msg.content == "hello"

    def test_store_turn_creates_two_messages(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        sid = uuid.uuid4()
        uid = uuid.uuid4()

        msgs = svc.store_turn(sid, uid, "question?", "answer!", "PolicyAgent")
        assert len(msgs) == 2
        assert msgs[0].role == MessageRole.USER
        assert msgs[1].role == MessageRole.ASSISTANT
        assert msgs[1].agent_name == "PolicyAgent"

    def test_get_session_context_returns_ordered(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        sid = uuid.uuid4()
        uid = uuid.uuid4()

        svc.store_message(sid, uid, MessageRole.USER, "first")
        svc.store_message(sid, uid, MessageRole.ASSISTANT, "second")
        svc.store_message(sid, uid, MessageRole.USER, "third")

        history = svc.get_session_context(sid)
        assert len(history) == 3
        assert history[0].content == "first"
        assert history[2].content == "third"

    def test_get_session_context_respects_limit(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        sid = uuid.uuid4()
        uid = uuid.uuid4()

        for i in range(10):
            svc.store_message(sid, uid, MessageRole.USER, f"msg-{i}")

        history = svc.get_session_context(sid, max_messages=3)
        assert len(history) == 3
        # Should be the LAST 3 messages in chronological order
        assert history[0].content == "msg-7"

    def test_get_user_sessions(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        uid = uuid.uuid4()
        s1, s2 = uuid.uuid4(), uuid.uuid4()

        svc.store_message(s1, uid, MessageRole.USER, "a")
        svc.store_message(s2, uid, MessageRole.USER, "b")

        sessions = svc.get_user_sessions(uid)
        assert len(sessions) >= 2

    def test_store_embedding_and_search(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        src_id = uuid.uuid4()
        vec = [1.0, 0.0, 0.0]

        emb = svc.store_embedding("doc", src_id, "test content", vec, chunk_index=0)
        assert emb.id is not None
        assert emb.dimensions == 3

        results = svc.search_similar_context([1.0, 0.0, 0.0], source_type="doc")
        assert len(results) >= 1
        assert results[0]["chunk_text"] == "test content"

    def test_store_embedding_dedup(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        src_id = uuid.uuid4()
        vec = [0.5, 0.5, 0.5]

        e1 = svc.store_embedding("doc", src_id, "duplicate text", vec)
        e2 = svc.store_embedding("doc", src_id, "duplicate text", vec)
        assert e1.id == e2.id  # dedup

    def test_delete_session(self, db_session: Session) -> None:
        svc = MemoryService(db_session)
        sid = uuid.uuid4()
        uid = uuid.uuid4()
        svc.store_message(sid, uid, MessageRole.USER, "bye")
        deleted = svc.delete_session(sid)
        assert deleted == 1
        assert svc.get_session_context(sid) == []


# ═════════════════════════════════════════════════════════════════
# 2. ApprovalService
# ═════════════════════════════════════════════════════════════════

class TestApprovalService:
    """Tests for app.services.approval.ApprovalService."""

    def test_create_action_request(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        uid = uuid.uuid4()
        action = svc.create_action_request(
            session_id=uuid.uuid4(),
            agent_name="PolicyAgent",
            action_type="policy_recommendation",
            description="Update water policy",
            payload={"key": "value"},
            requested_by=uid,
        )
        assert action.id is not None
        assert action.status == ActionStatus.PENDING
        assert action.agent_name == "PolicyAgent"

    def test_approve_action(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        leader = _make_user(db_session, UserRole.LEADER)

        action = svc.create_action_request(
            session_id=uuid.uuid4(),
            agent_name="CitizenAgent",
            action_type="citizen_action",
            description="Send notification",
            payload={},
            requested_by=leader.id,
        )
        approved = svc.approve(action.id, leader, "Looks good")
        assert approved.status == ActionStatus.APPROVED
        assert approved.reviewed_by == leader.id
        assert approved.review_note == "Looks good"

    def test_reject_action(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        staff = _make_user(db_session, UserRole.STAFF)

        action = svc.create_action_request(
            session_id=uuid.uuid4(),
            agent_name="OperationsAgent",
            action_type="ops_action",
            description="Reassign staff",
            payload={},
            requested_by=staff.id,
        )
        rejected = svc.reject(action.id, staff, "Needs more info")
        assert rejected.status == ActionStatus.REJECTED

    def test_cannot_review_nonpending(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        leader = _make_user(db_session, UserRole.LEADER)

        action = svc.create_action_request(
            session_id=uuid.uuid4(),
            agent_name="PolicyAgent",
            action_type="test",
            description="desc",
            payload={},
            requested_by=leader.id,
        )
        svc.approve(action.id, leader)

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            svc.reject(action.id, leader)
        assert exc_info.value.status_code == 400

    def test_analyst_cannot_review(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        analyst = _make_user(db_session, UserRole.ANALYST)
        leader = _make_user(db_session, UserRole.LEADER)

        action = svc.create_action_request(
            session_id=uuid.uuid4(),
            agent_name="PolicyAgent",
            action_type="test",
            description="desc",
            payload={},
            requested_by=leader.id,
        )

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            svc.approve(action.id, analyst)
        assert exc_info.value.status_code == 403

    def test_expired_action_cannot_be_reviewed(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        leader = _make_user(db_session, UserRole.LEADER)

        action = svc.create_action_request(
            session_id=uuid.uuid4(),
            agent_name="PolicyAgent",
            action_type="test",
            description="desc",
            payload={},
            requested_by=leader.id,
        )
        # Backdate created_at to force expiry
        action.created_at = datetime.now(timezone.utc) - timedelta(hours=48)
        db_session.commit()

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            svc.approve(action.id, leader)
        assert exc_info.value.status_code == 400
        assert "expired" in exc_info.value.detail.lower()

    def test_list_pending(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        uid = uuid.uuid4()

        for i in range(3):
            svc.create_action_request(
                session_id=uuid.uuid4(),
                agent_name="PolicyAgent",
                action_type=f"type-{i}",
                description=f"desc-{i}",
                payload={},
                requested_by=uid,
            )

        pending, count = svc.list_pending()
        assert count == 3
        assert len(pending) == 3

    def test_get_action_not_found(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            svc.get_action(uuid.uuid4())
        assert exc_info.value.status_code == 404

    def test_pending_count(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        uid = uuid.uuid4()
        leader = _make_user(db_session, UserRole.LEADER)

        a1 = svc.create_action_request(
            session_id=uuid.uuid4(), agent_name="X",
            action_type="t", description="d", payload={}, requested_by=uid,
        )
        svc.create_action_request(
            session_id=uuid.uuid4(), agent_name="X",
            action_type="t", description="d", payload={}, requested_by=uid,
        )

        assert svc.pending_count() == 2

        svc.approve(a1.id, leader)
        assert svc.pending_count() == 1

    def test_get_session_actions(self, db_session: Session) -> None:
        svc = ApprovalService(db_session)
        uid = uuid.uuid4()
        sid = uuid.uuid4()

        svc.create_action_request(
            session_id=sid, agent_name="A",
            action_type="t", description="d", payload={}, requested_by=uid,
        )
        svc.create_action_request(
            session_id=sid, agent_name="B",
            action_type="t", description="d", payload={}, requested_by=uid,
        )

        actions = svc.get_session_actions(sid)
        assert len(actions) == 2


# ═════════════════════════════════════════════════════════════════
# 3. Agent Framework — BaseAgent / AgentContext / AgentResponse
# ═════════════════════════════════════════════════════════════════

class TestAgentBase:
    """Tests for base framework data classes."""

    def test_agent_context_defaults(self) -> None:
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="hello",
        )
        assert ctx.conversation_history == []
        assert ctx.rag_context == []
        assert ctx.metadata == {}

    def test_agent_response_defaults(self) -> None:
        resp = AgentResponse(agent_name="Test", message="hi")
        assert resp.confidence == 1.0
        assert resp.suggested_actions == []
        assert resp.metadata == {}

    def test_base_agent_is_abstract(self) -> None:
        with pytest.raises(TypeError):
            BaseAgent()  # type: ignore[abstract]


# ═════════════════════════════════════════════════════════════════
# 4. PolicyAgent
# ═════════════════════════════════════════════════════════════════

class TestPolicyAgent:

    def test_name_and_description(self) -> None:
        agent = PolicyAgent()
        assert agent.name == "PolicyAgent"
        assert "polic" in agent.description.lower()

    def test_execute_basic(self) -> None:
        agent = PolicyAgent()
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="What is the latest water policy?",
        )
        resp = agent.execute(ctx)
        assert resp.agent_name == "PolicyAgent"
        assert "PolicyAgent" in resp.message
        assert resp.suggested_actions == []

    def test_execute_with_rag(self) -> None:
        agent = PolicyAgent()
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="water policy",
            rag_context=["Clean Water Act 2020 Section 4"],
        )
        resp = agent.execute(ctx)
        assert "Clean Water Act" in resp.message

    def test_execute_triggers_action(self) -> None:
        agent = PolicyAgent()
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="Update the water quality notification",
        )
        resp = agent.execute(ctx)
        assert len(resp.suggested_actions) == 1
        assert resp.suggested_actions[0]["action_type"] == "policy_recommendation"

    def test_system_prompt(self) -> None:
        agent = PolicyAgent()
        prompt = agent._system_prompt()
        assert "PolicyAgent" in prompt


# ═════════════════════════════════════════════════════════════════
# 5. CitizenAgent
# ═════════════════════════════════════════════════════════════════

class TestCitizenAgent:

    def test_name_and_description(self) -> None:
        agent = CitizenAgent()
        assert agent.name == "CitizenAgent"
        assert "citizen" in agent.description.lower()

    def test_execute_basic(self) -> None:
        agent = CitizenAgent()
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="How many complaints in Saket?",
        )
        resp = agent.execute(ctx)
        assert resp.agent_name == "CitizenAgent"
        assert resp.suggested_actions == []

    def test_execute_triggers_action(self) -> None:
        agent = CitizenAgent()
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="Escalate this issue to the collector",
        )
        resp = agent.execute(ctx)
        assert len(resp.suggested_actions) == 1
        assert resp.suggested_actions[0]["action_type"] == "citizen_action"

    def test_system_prompt(self) -> None:
        agent = CitizenAgent()
        assert "CitizenAgent" in agent._system_prompt()


# ═════════════════════════════════════════════════════════════════
# 6. OperationsAgent
# ═════════════════════════════════════════════════════════════════

class TestOperationsAgent:

    def test_name_and_description(self) -> None:
        agent = OperationsAgent()
        assert agent.name == "OperationsAgent"
        assert "operations" in agent.description.lower()

    def test_execute_basic(self) -> None:
        agent = OperationsAgent()
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="What is the department workload?",
        )
        resp = agent.execute(ctx)
        assert resp.agent_name == "OperationsAgent"
        assert resp.suggested_actions == []

    def test_execute_triggers_action(self) -> None:
        agent = OperationsAgent()
        ctx = AgentContext(
            session_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            query="Reassign the sanitation team to Pitampura",
        )
        resp = agent.execute(ctx)
        assert len(resp.suggested_actions) == 1
        assert resp.suggested_actions[0]["action_type"] == "operations_action"

    def test_system_prompt(self) -> None:
        agent = OperationsAgent()
        assert "OperationsAgent" in agent._system_prompt()


# ═════════════════════════════════════════════════════════════════
# 7. AgentRouter
# ═════════════════════════════════════════════════════════════════

class TestAgentRouter:

    def test_available_agents(self) -> None:
        router = AgentRouter()
        names = router.available_agents
        assert "PolicyAgent" in names
        assert "CitizenAgent" in names
        assert "OperationsAgent" in names

    def test_get_agent(self) -> None:
        router = AgentRouter()
        assert isinstance(router.get_agent("PolicyAgent"), PolicyAgent)
        assert router.get_agent("UnknownAgent") is None

    def test_route_policy_query(self) -> None:
        router = AgentRouter()
        agent, intent, conf = router.route(
            "What is the latest government policy on clean water regulation?"
        )
        assert agent.name == "PolicyAgent"
        assert conf > 0

    def test_route_citizen_query(self) -> None:
        router = AgentRouter()
        agent, intent, conf = router.route(
            "Show me all citizen complaints about water supply in Saket"
        )
        assert agent.name == "CitizenAgent"

    def test_route_operations_query(self) -> None:
        router = AgentRouter()
        agent, intent, conf = router.route(
            "Allocate more staff to the sanitation department for task scheduling"
        )
        assert agent.name == "OperationsAgent"

    def test_route_ambiguous_defaults_to_citizen(self) -> None:
        router = AgentRouter()
        agent, intent, conf = router.route("xyz abc 123")
        assert agent.name == "CitizenAgent"  # default fallback
        assert conf == 0.5

    def test_register_agent(self) -> None:
        router = AgentRouter()

        class DummyAgent(BaseAgent):
            @property
            def name(self) -> str:
                return "DummyAgent"

            @property
            def description(self) -> str:
                return "dummy"

            def execute(self, context: AgentContext) -> AgentResponse:
                return AgentResponse(agent_name=self.name, message="ok")

        router.register_agent(DummyAgent())
        assert router.get_agent("DummyAgent") is not None

    def test_score_intents_returns_sorted(self) -> None:
        router = AgentRouter()
        scores = router._score_intents("policy regulation law")
        assert scores[0][0] == "PolicyAgent"
        assert scores[0][1] >= 3

    def test_repr(self) -> None:
        router = AgentRouter()
        assert "AgentRouter" in repr(router)


# ═════════════════════════════════════════════════════════════════
# 8. AgentService — end-to-end orchestration
# ═════════════════════════════════════════════════════════════════

class TestAgentService:
    """Integration-style tests for AgentService."""

    def test_process_query_basic(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        user = _make_user(db_session, UserRole.LEADER)

        result = svc.process_query(
            user_id=user.id,
            query="What is the latest government policy?",
        )
        assert "session_id" in result
        assert result["agent_name"] == "PolicyAgent"
        assert "response" in result
        assert result["confidence"] > 0

    def test_process_query_creates_session(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        user = _make_user(db_session, UserRole.STAFF)

        result = svc.process_query(user_id=user.id, query="citizen complaints?")
        sid = result["session_id"]
        assert sid is not None

        # History should contain the turn
        history = svc.get_session_history(sid)
        assert len(history) == 2  # user + assistant

    def test_process_query_forced_agent(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        user = _make_user(db_session, UserRole.LEADER)

        result = svc.process_query(
            user_id=user.id,
            query="anything",
            agent_name="OperationsAgent",
        )
        assert result["agent_name"] == "OperationsAgent"
        assert result["confidence"] > 0  # agent's own confidence

    def test_process_query_unknown_agent_raises(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        user = _make_user(db_session, UserRole.LEADER)

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            svc.process_query(
                user_id=user.id, query="test", agent_name="NonExistent",
            )
        assert exc_info.value.status_code == 400

    def test_process_query_with_actions(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        user = _make_user(db_session, UserRole.LEADER)

        result = svc.process_query(
            user_id=user.id,
            query="Update the water quality policy notification",
        )
        # "update" + "notification" → PolicyAgent triggers action
        assert len(result["pending_actions"]) >= 1
        assert result["pending_actions"][0]["status"] == "pending"

    def test_get_available_agents(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        agents = svc.get_available_agents()
        assert len(agents) == 3
        names = {a["name"] for a in agents}
        assert names == {"PolicyAgent", "CitizenAgent", "OperationsAgent"}

    def test_get_pending_actions(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        user = _make_user(db_session, UserRole.LEADER)

        # Create an action by processing a query that triggers one
        svc.process_query(
            user_id=user.id,
            query="Update the electricity subsidy policy",
        )
        pending = svc.get_pending_actions()
        assert len(pending) >= 1

    def test_review_action_approve(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        leader = _make_user(db_session, UserRole.LEADER)

        result = svc.process_query(
            user_id=leader.id,
            query="Change the department allocation schedule",
        )

        if result["pending_actions"]:
            aid = result["pending_actions"][0]["id"]
            review = svc.review_action(aid, leader, approve=True, note="Approved")
            assert review["status"] == "approved"

    def test_multi_turn_conversation(self, db_session: Session) -> None:
        svc = AgentService(db_session)
        user = _make_user(db_session, UserRole.STAFF)

        r1 = svc.process_query(user_id=user.id, query="Tell me about water policy")
        sid = r1["session_id"]

        r2 = svc.process_query(
            user_id=user.id, query="Any citizen complaints?", session_id=sid,
        )
        assert r2["session_id"] == sid

        # Should have 4 messages: user+assistant + user+assistant
        history = svc.get_session_history(sid)
        assert len(history) == 4
