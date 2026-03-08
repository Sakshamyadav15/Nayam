"""
NAYAM (नयम्) — Agent Orchestration Service (Phase 2).

Central service that ties together routing, context retrieval,
agent execution, memory storage, and action-approval creation.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.agents.base import AgentContext, AgentResponse
from app.agents.router import AgentRouter
from app.core.config import get_settings
from app.models.user import User
from app.services.memory import MemoryService
from app.services.approval import ApprovalService

logger = logging.getLogger(__name__)


class AgentService:
    """
    Orchestrates the full request → response lifecycle:
      1. Retrieve conversation context  (MemoryService)
      2. Retrieve RAG context            (MemoryService embeddings)
      3. Route query to agent            (AgentRouter)
      4. Execute agent                   (BaseAgent.execute)
      5. Persist conversation turn        (MemoryService)
      6. Create action requests if any    (ApprovalService)
    """

    def __init__(self, db: Session) -> None:
        self._db = db
        self._settings = get_settings()
        self._memory = MemoryService(db)
        self._approval = ApprovalService(db)
        self._router = AgentRouter()

    # ── Public API ────────────────────────────────────────────────

    def process_query(
        self,
        user_id: int,
        query: str,
        session_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        End-to-end query processing.

        Args:
            user_id:     ID of the authenticated user.
            query:       Natural-language question or command.
            session_id:  Existing session or None to create new.
            agent_name:  Force a specific agent (bypasses router).
            metadata:    Extra context hints (e.g. geo coords).

        Returns:
            Dict with keys: session_id, agent_name, response,
            confidence, suggested_actions, pending_actions.
        """
        # 1. Session
        if session_id is None:
            sid = uuid.uuid4()
        else:
            sid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id

        # 2. Conversation history — convert ORM objects to dicts
        history_records = self._memory.get_session_context(sid)
        history: List[Dict[str, str]] = [
            {"role": msg.role.value, "content": msg.content}
            for msg in history_records
        ]

        # 3. RAG context — FAISS + sentence-transformer semantic search
        rag_context: List[str] = []
        try:
            embedding_results = self._memory.search_by_text(
                query=query,
                top_k=5,
            )
            rag_context = [r["chunk_text"] for r in embedding_results]
        except Exception:
            # RAG is best-effort; continue without it
            logger.warning("RAG retrieval failed, proceeding without context")

        # 4. Route to agent
        if agent_name:
            agent = self._router.get_agent(agent_name)
            if agent is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown agent: {agent_name}",
                )
            confidence = 1.0
            intent = agent_name
        else:
            agent, intent, confidence = self._router.route(query)

        # 5. Build context & execute
        context = AgentContext(
            session_id=sid,
            user_id=user_id,
            query=query,
            conversation_history=history,
            rag_context=rag_context,
            metadata=metadata or {},
        )

        try:
            response: AgentResponse = agent.execute(context)
        except Exception as exc:
            logger.error("Agent %s failed: %s", agent.name, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Agent execution failed. Please try again.",
            )

        # 6. Persist conversation turn
        self._memory.store_turn(
            session_id=sid,
            user_id=user_id,
            user_message=query,
            assistant_response=response.message,
            agent_name=response.agent_name,
        )

        # 7. Create action requests for any suggested actions
        pending_actions: List[Dict[str, Any]] = []
        for action in response.suggested_actions:
            action_req = self._approval.create_action_request(
                session_id=sid,
                agent_name=response.agent_name,
                action_type=action.get("action_type", action.get("type", "general")),
                description=action.get("description", ""),
                payload=action,
                requested_by=user_id,
            )
            pending_actions.append({
                "id": action_req.id,
                "action_type": action_req.action_type,
                "description": action_req.description,
                "status": action_req.status.value,
            })

        return {
            "session_id": str(sid),
            "agent_name": response.agent_name,
            "response": response.message,
            "confidence": response.confidence,
            "suggested_actions": response.suggested_actions,
            "pending_actions": pending_actions,
            "metadata": response.metadata,
        }

    def get_session_history(
        self, session_id: str, limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Return formatted conversation history for a session.
        """
        sid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
        records = self._memory.get_session_context(sid, max_messages=limit)
        return [
            {
                "role": msg.role.value,
                "content": msg.content,
                "agent_name": msg.agent_name,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            }
            for msg in records
        ]

    def get_available_agents(self) -> List[Dict[str, str]]:
        """
        List all registered agents with descriptions.
        """
        result = []
        for name in self._router.available_agents:
            agent = self._router.get_agent(name)
            if agent:
                result.append({
                    "name": agent.name,
                    "description": agent.description,
                })
        return result

    def get_pending_actions(
        self, agent_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve pending action requests, optionally filtered by agent.
        """
        if agent_name:
            actions, _total = self._approval.list_all(
                status_filter=None, agent_name=agent_name,
            )
            actions = [a for a in actions if a.status.value == "pending"]
        else:
            actions, _total = self._approval.list_pending()

        return [
            {
                "id": a.id,
                "session_id": a.session_id,
                "agent_name": a.agent_name,
                "action_type": a.action_type,
                "description": a.description,
                "status": a.status.value,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in actions
        ]

    def review_action(
        self,
        action_id: int,
        reviewer: User,
        approve: bool,
        note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Approve or reject a pending action request.

        Args:
            action_id: ID of the action.
            reviewer: The User ORM object performing the review.
            approve: True to approve, False to reject.
            note: Optional review note.
        """
        if approve:
            action = self._approval.approve(action_id, reviewer, note)
        else:
            action = self._approval.reject(action_id, reviewer, note)
        return {
            "id": action.id,
            "status": action.status.value,
            "reviewed_by": action.reviewed_by,
            "review_note": action.review_note,
        }
