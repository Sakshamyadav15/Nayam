"""
NAYAM (नयम्) — Phase 2 Model Unit Tests.

Covers:
  • Conversation model — CRUD, session grouping, role enum
  • Embedding model    — CRUD, JSON vector storage, content hash
  • ActionRequest model — CRUD, lifecycle states, reviewer FK
  • Issue geo-metadata  — nullable lat/lon, location_description
"""

import hashlib
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.orm import Session

from app.models.conversation import Conversation, MessageRole
from app.models.embedding import Embedding
from app.models.action_request import ActionRequest, ActionStatus
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.user import User
from app.models.citizen import Citizen


# ══════════════════════════════════════════════════════════════════════
#  CONVERSATION MODEL
# ══════════════════════════════════════════════════════════════════════

class TestConversationModel:
    """Tests for the Conversation ORM model."""

    def test_create_conversation_message(self, db_session: Session, leader_user: User):
        """A basic user message can be stored and retrieved."""
        session_id = uuid.uuid4()
        msg = Conversation(
            session_id=session_id,
            user_id=leader_user.id,
            role=MessageRole.USER,
            content="What is the status of Saket water supply?",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.id is not None
        assert msg.session_id == session_id
        assert msg.role == MessageRole.USER
        assert msg.agent_name is None
        assert msg.created_at is not None

    def test_assistant_message_with_agent(self, db_session: Session, leader_user: User):
        """An assistant response stores the agent name."""
        session_id = uuid.uuid4()
        msg = Conversation(
            session_id=session_id,
            user_id=leader_user.id,
            role=MessageRole.ASSISTANT,
            content="Saket has 3 open water supply issues.",
            agent_name="CitizenAgent",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.role == MessageRole.ASSISTANT
        assert msg.agent_name == "CitizenAgent"

    def test_session_groups_messages(self, db_session: Session, leader_user: User):
        """Multiple messages share the same session_id."""
        session_id = uuid.uuid4()
        msgs = [
            Conversation(session_id=session_id, user_id=leader_user.id, role=MessageRole.USER, content="Hello"),
            Conversation(session_id=session_id, user_id=leader_user.id, role=MessageRole.ASSISTANT, content="Hi!"),
        ]
        db_session.add_all(msgs)
        db_session.commit()

        results = (
            db_session.query(Conversation)
            .filter(Conversation.session_id == session_id)
            .order_by(Conversation.created_at)
            .all()
        )
        assert len(results) == 2
        assert results[0].role == MessageRole.USER
        assert results[1].role == MessageRole.ASSISTANT

    def test_conversation_requires_content(self, db_session: Session, leader_user: User):
        """Content column is non-nullable."""
        msg = Conversation(
            session_id=uuid.uuid4(),
            user_id=leader_user.id,
            role=MessageRole.USER,
            content=None,  # type: ignore[arg-type]
        )
        db_session.add(msg)
        with pytest.raises(Exception):
            db_session.commit()

    def test_conversation_repr(self, db_session: Session, leader_user: User):
        """__repr__ returns a useful string."""
        msg = Conversation(
            id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            user_id=leader_user.id,
            role=MessageRole.SYSTEM,
            content="System prompt",
            agent_name="Router",
        )
        assert "Conversation" in repr(msg)
        assert "Router" in repr(msg)


# ══════════════════════════════════════════════════════════════════════
#  EMBEDDING MODEL
# ══════════════════════════════════════════════════════════════════════

class TestEmbeddingModel:
    """Tests for the Embedding ORM model."""

    @staticmethod
    def _make_embedding(source_id: uuid.UUID, text: str = "sample text") -> Embedding:
        """Helper to create a valid Embedding instance."""
        vector = [0.01] * 1536
        return Embedding(
            source_type="conversation",
            source_id=source_id,
            content_hash=hashlib.sha256(text.encode()).hexdigest(),
            chunk_index=0,
            chunk_text=text,
            embedding=vector,
            dimensions=len(vector),
            model_name="text-embedding-3-small",
        )

    def test_create_embedding(self, db_session: Session):
        """A basic embedding record can be created and retrieved."""
        source_id = uuid.uuid4()
        emb = self._make_embedding(source_id)
        db_session.add(emb)
        db_session.commit()
        db_session.refresh(emb)

        assert emb.id is not None
        assert emb.source_type == "conversation"
        assert emb.dimensions == 1536
        assert len(emb.embedding) == 1536
        assert emb.created_at is not None

    def test_embedding_content_hash(self, db_session: Session):
        """Content hash is stored as a 64-char hex string."""
        emb = self._make_embedding(uuid.uuid4(), "unique text")
        db_session.add(emb)
        db_session.commit()
        db_session.refresh(emb)

        expected_hash = hashlib.sha256("unique text".encode()).hexdigest()
        assert emb.content_hash == expected_hash
        assert len(emb.content_hash) == 64

    def test_embedding_multiple_chunks(self, db_session: Session):
        """Multiple chunks for the same source are stored independently."""
        source_id = uuid.uuid4()
        chunks = []
        for i in range(3):
            e = self._make_embedding(source_id, f"chunk {i}")
            e.chunk_index = i
            chunks.append(e)

        db_session.add_all(chunks)
        db_session.commit()

        results = (
            db_session.query(Embedding)
            .filter(Embedding.source_id == source_id)
            .order_by(Embedding.chunk_index)
            .all()
        )
        assert len(results) == 3
        assert [r.chunk_index for r in results] == [0, 1, 2]

    def test_embedding_repr(self, db_session: Session):
        """__repr__ returns a useful string."""
        emb = self._make_embedding(uuid.uuid4())
        assert "Embedding" in repr(emb)


# ══════════════════════════════════════════════════════════════════════
#  ACTION REQUEST MODEL
# ══════════════════════════════════════════════════════════════════════

class TestActionRequestModel:
    """Tests for the ActionRequest ORM model."""

    def test_create_pending_action(self, db_session: Session, leader_user: User):
        """A new action request defaults to PENDING status."""
        action = ActionRequest(
            session_id=uuid.uuid4(),
            agent_name="PolicyAgent",
            action_type="update_issue_status",
            description="Change issue #42 from Open to In Progress",
            payload={"issue_id": str(uuid.uuid4()), "new_status": "In Progress"},
            requested_by=leader_user.id,
        )
        db_session.add(action)
        db_session.commit()
        db_session.refresh(action)

        assert action.id is not None
        assert action.status == ActionStatus.PENDING
        assert action.reviewed_by is None
        assert action.reviewed_at is None
        assert action.created_at is not None

    def test_approve_action(self, db_session: Session, leader_user: User, staff_user: User):
        """An action can be approved by a different user."""
        action = ActionRequest(
            session_id=uuid.uuid4(),
            agent_name="OperationsAgent",
            action_type="assign_department",
            description="Assign issue to Water Supply dept",
            payload={"department": "Water Supply"},
            requested_by=leader_user.id,
        )
        db_session.add(action)
        db_session.commit()

        # Approve
        action.status = ActionStatus.APPROVED
        action.reviewed_by = staff_user.id
        action.reviewed_at = datetime.now(timezone.utc)
        action.review_note = "Looks correct."
        db_session.commit()
        db_session.refresh(action)

        assert action.status == ActionStatus.APPROVED
        assert action.reviewed_by == staff_user.id
        assert action.review_note == "Looks correct."

    def test_reject_action(self, db_session: Session, leader_user: User, staff_user: User):
        """An action can be rejected with a note."""
        action = ActionRequest(
            session_id=uuid.uuid4(),
            agent_name="CitizenAgent",
            action_type="send_notification",
            description="Send SMS to citizen about resolution",
            payload={"citizen_id": str(uuid.uuid4())},
            requested_by=leader_user.id,
        )
        db_session.add(action)
        db_session.commit()

        action.status = ActionStatus.REJECTED
        action.reviewed_by = staff_user.id
        action.reviewed_at = datetime.now(timezone.utc)
        action.review_note = "Premature — issue not yet resolved."
        db_session.commit()
        db_session.refresh(action)

        assert action.status == ActionStatus.REJECTED

    def test_filter_pending_actions(self, db_session: Session, leader_user: User):
        """We can query for only PENDING action requests."""
        for i in range(3):
            a = ActionRequest(
                session_id=uuid.uuid4(),
                agent_name="PolicyAgent",
                action_type=f"action_{i}",
                description=f"Action description {i}",
                payload={},
                requested_by=leader_user.id,
                status=ActionStatus.PENDING if i < 2 else ActionStatus.APPROVED,
            )
            db_session.add(a)
        db_session.commit()

        pending = (
            db_session.query(ActionRequest)
            .filter(ActionRequest.status == ActionStatus.PENDING)
            .all()
        )
        assert len(pending) == 2

    def test_action_request_repr(self, db_session: Session, leader_user: User):
        """__repr__ returns a useful string."""
        action = ActionRequest(
            id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            agent_name="PolicyAgent",
            action_type="test",
            description="Test action",
            payload={},
            requested_by=leader_user.id,
        )
        assert "ActionRequest" in repr(action)
        assert "PolicyAgent" in repr(action)


# ══════════════════════════════════════════════════════════════════════
#  ISSUE GEO-METADATA EXTENSION
# ══════════════════════════════════════════════════════════════════════

class TestIssueGeoMetadata:
    """Tests for the Phase 2 geo-spatial fields on the Issue model."""

    def test_issue_without_geo(self, db_session: Session, sample_citizen: Citizen):
        """Issues created without geo fields still work (nullable)."""
        issue = Issue(
            citizen_id=sample_citizen.id,
            department="Roads",
            description="Pothole on main road near the market area",
            status=IssueStatus.OPEN,
            priority=IssuePriority.HIGH,
        )
        db_session.add(issue)
        db_session.commit()
        db_session.refresh(issue)

        assert issue.latitude is None
        assert issue.longitude is None
        assert issue.location_description is None

    def test_issue_with_geo(self, db_session: Session, sample_citizen: Citizen):
        """Issues can store latitude, longitude, and location description."""
        issue = Issue(
            citizen_id=sample_citizen.id,
            department="Water Supply",
            description="No water supply in Saket since Monday morning",
            status=IssueStatus.OPEN,
            priority=IssuePriority.HIGH,
            latitude=28.6139,
            longitude=77.2090,
            location_description="Near Gandhi Chowk, Saket",
        )
        db_session.add(issue)
        db_session.commit()
        db_session.refresh(issue)

        assert issue.latitude == pytest.approx(28.6139)
        assert issue.longitude == pytest.approx(77.2090)
        assert issue.location_description == "Near Gandhi Chowk, Saket"

    def test_update_geo_on_existing_issue(self, db_session: Session, sample_issue: Issue):
        """Geo fields can be added to an existing issue via update."""
        sample_issue.latitude = 19.0760
        sample_issue.longitude = 72.8777
        sample_issue.location_description = "Bandra West water main"
        db_session.commit()
        db_session.refresh(sample_issue)

        assert sample_issue.latitude == pytest.approx(19.0760)
        assert sample_issue.longitude == pytest.approx(72.8777)

    def test_filter_issues_with_geo(self, db_session: Session, sample_citizen: Citizen):
        """We can filter for issues that have geo data attached."""
        # One with geo, one without
        db_session.add(
            Issue(
                citizen_id=sample_citizen.id, department="Sanitation",
                description="Garbage not collected for three days in row",
                latitude=28.5, longitude=77.1,
            )
        )
        db_session.add(
            Issue(
                citizen_id=sample_citizen.id, department="Electricity",
                description="Frequent power cuts every evening in the area",
            )
        )
        db_session.commit()

        geo_issues = (
            db_session.query(Issue)
            .filter(Issue.latitude.isnot(None), Issue.longitude.isnot(None))
            .all()
        )
        assert len(geo_issues) == 1
        assert geo_issues[0].department == "Sanitation"
