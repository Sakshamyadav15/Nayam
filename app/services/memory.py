"""
NAYAM (नयम्) — Memory Service (Phase 2).

Business logic for the Context Memory Engine:
  • Store conversation turns
  • Generate & store embeddings (with pluggable provider)
  • Retrieve conversation context for a session
  • Retrieve semantically similar past context via FAISS + sentence embeddings
"""

import hashlib
import logging
from typing import List, Optional
from uuid import UUID

import faiss
import numpy as np
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.conversation import Conversation, MessageRole
from app.models.embedding import Embedding
from app.repositories.conversation import ConversationRepository
from app.repositories.embedding import EmbeddingRepository

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Lazy-loaded Sentence Transformer ─────────────────────────────
_sentence_model = None
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 dimension


def _get_sentence_model():
    """Lazy-load the sentence-transformers model (one-time ~90 MB download)."""
    global _sentence_model
    if _sentence_model is None:
        from sentence_transformers import SentenceTransformer
        _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Loaded sentence-transformers model: all-MiniLM-L6-v2")
    return _sentence_model


def generate_embedding(text: str) -> List[float]:
    """Generate a 384-dim dense embedding for the given text."""
    model = _get_sentence_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a batch of texts (more efficient than one-by-one)."""
    if not texts:
        return []
    model = _get_sentence_model()
    vecs = model.encode(texts, normalize_embeddings=True, batch_size=64)
    return [v.tolist() for v in vecs]


class MemoryService:
    """
    Service layer for conversation memory and embedding management.

    Args:
        db: SQLAlchemy database session.
    """

    def __init__(self, db: Session) -> None:
        self.conversation_repo = ConversationRepository(db)
        self.embedding_repo = EmbeddingRepository(db)

    # ── Conversation Storage ─────────────────────────────────────

    def store_message(
        self,
        session_id: UUID,
        user_id: UUID,
        role: MessageRole,
        content: str,
        agent_name: Optional[str] = None,
    ) -> Conversation:
        """
        Store a single conversation message.

        Args:
            session_id: Conversation session UUID.
            user_id: UUID of the user.
            role: Message sender role.
            content: Message text.
            agent_name: Agent that handled this turn (if assistant).

        Returns:
            The persisted Conversation record.
        """
        message = Conversation(
            session_id=session_id,
            user_id=user_id,
            role=role,
            content=content,
            agent_name=agent_name,
        )
        return self.conversation_repo.create(message)

    def store_turn(
        self,
        session_id: UUID,
        user_id: UUID,
        user_message: str,
        assistant_response: str,
        agent_name: Optional[str] = None,
    ) -> List[Conversation]:
        """
        Store a complete user → assistant turn pair.

        Args:
            session_id: Conversation session UUID.
            user_id: UUID of the user.
            user_message: The user's query.
            assistant_response: The AI's response.
            agent_name: Agent that produced the response.

        Returns:
            List of both persisted Conversation records.
        """
        messages = [
            Conversation(
                session_id=session_id,
                user_id=user_id,
                role=MessageRole.USER,
                content=user_message,
            ),
            Conversation(
                session_id=session_id,
                user_id=user_id,
                role=MessageRole.ASSISTANT,
                content=assistant_response,
                agent_name=agent_name,
            ),
        ]
        return self.conversation_repo.create_many(messages)

    # ── Context Retrieval ────────────────────────────────────────

    def get_session_context(
        self,
        session_id: UUID,
        max_messages: Optional[int] = None,
    ) -> List[Conversation]:
        """
        Retrieve conversation history for a session.

        Uses the configured limit if none specified.

        Args:
            session_id: UUID of the conversation session.
            max_messages: Optional override for max messages.

        Returns:
            Ordered list of Conversation objects.
        """
        limit = max_messages or settings.AGENT_MAX_CONTEXT_MESSAGES
        return self.conversation_repo.get_session_history(
            session_id, limit=limit,
        )

    def get_user_sessions(self, user_id: UUID, limit: int = 20) -> List[UUID]:
        """
        Get recent session IDs for a user.

        Args:
            user_id: UUID of the user.
            limit: Max sessions.

        Returns:
            List of session UUIDs, most recent first.
        """
        return self.conversation_repo.get_user_sessions(user_id, limit=limit)

    # ── Embedding Storage ────────────────────────────────────────

    def store_embedding(
        self,
        source_type: str,
        source_id: UUID,
        text: str,
        embedding_vector: List[float],
        chunk_index: int = 0,
        model_name: Optional[str] = None,
    ) -> Embedding:
        """
        Store a pre-computed embedding vector.

        Performs content-hash deduplication: skips if already stored.

        Args:
            source_type: e.g. "conversation", "document".
            source_id: UUID of the source record.
            text: Original text that was embedded.
            embedding_vector: The vector as list of floats.
            chunk_index: Chunk order within the source.
            model_name: Name of the embedding model used.

        Returns:
            The persisted (or existing) Embedding record.
        """
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        # Dedup guard
        if self.embedding_repo.exists_by_content_hash(content_hash):
            logger.debug("Embedding already exists for hash %s, skipping", content_hash[:12])
            # Return existing
            existing = (
                self.embedding_repo.db.query(Embedding)
                .filter(Embedding.content_hash == content_hash)
                .first()
            )
            return existing  # type: ignore[return-value]

        embedding = Embedding(
            source_type=source_type,
            source_id=source_id,
            content_hash=content_hash,
            chunk_index=chunk_index,
            chunk_text=text,
            embedding=embedding_vector,
            dimensions=len(embedding_vector),
            model_name=model_name or settings.EMBEDDING_MODEL,
        )
        return self.embedding_repo.create(embedding)

    # ── Semantic Search ──────────────────────────────────────────

    def search_similar_context(
        self,
        query_embedding: List[float],
        source_type: Optional[str] = None,
        top_k: int = 5,
    ) -> List[dict]:
        """
        Search for semantically similar stored content.

        Args:
            query_embedding: The query vector.
            source_type: Optional filter.
            top_k: Number of results.

        Returns:
            List of dicts with keys: embedding_id, source_type,
            source_id, chunk_text, score.
        """
        results = self.embedding_repo.search_similar(
            query_embedding=query_embedding,
            source_type=source_type,
            top_k=top_k,
        )
        return [
            {
                "embedding_id": emb.id,
                "source_type": emb.source_type,
                "source_id": emb.source_id,
                "chunk_text": emb.chunk_text,
                "score": score,
            }
            for emb, score in results
        ]

    def search_by_text(
        self,
        query: str,
        source_type: Optional[str] = None,
        top_k: int = 5,
    ) -> List[dict]:
        """
        Semantic search using FAISS + sentence-transformer dense embeddings.

        Builds a FAISS flat-IP index over all stored embedding vectors
        and returns the top-k most similar chunks to the query.

        Args:
            query: The natural language query text.
            source_type: Optional filter (e.g. 'document', 'knowledge_base').
            top_k: Number of results.

        Returns:
            List of dicts with keys: embedding_id, source_type,
            source_id, chunk_text, score.
        """
        db_query = self.embedding_repo.db.query(Embedding)
        if source_type:
            db_query = db_query.filter(Embedding.source_type == source_type)

        all_embeddings = db_query.all()

        if not all_embeddings:
            return []

        try:
            # Generate query embedding
            query_vec = np.array(generate_embedding(query), dtype=np.float32).reshape(1, -1)

            # Build FAISS index from stored embeddings
            # Filter to only embeddings with real vectors (dim > 1)
            valid = [(i, e) for i, e in enumerate(all_embeddings) if e.dimensions > 1]
            if not valid:
                # Fallback: no real embeddings, return empty
                return []

            dim = valid[0][1].dimensions
            index = faiss.IndexFlatIP(dim)  # inner-product (embeddings are L2-normalized)

            vectors = np.array(
                [e.embedding for _, e in valid],
                dtype=np.float32,
            )
            index.add(vectors)

            k = min(top_k, len(valid))
            scores, indices = index.search(query_vec, k)

            results = []
            for rank in range(k):
                idx = int(indices[0][rank])
                score = float(scores[0][rank])
                if idx < 0 or score < 0.15:  # relevance threshold
                    continue
                emb = valid[idx][1]
                results.append({
                    "embedding_id": emb.id,
                    "source_type": emb.source_type,
                    "source_id": emb.source_id,
                    "chunk_text": emb.chunk_text,
                    "score": score,
                })

            return results
        except Exception as exc:
            logger.warning("FAISS search failed: %s", exc)
            return []

    # ── Cleanup ──────────────────────────────────────────────────

    def delete_session(self, session_id: UUID) -> int:
        """
        Delete all conversation messages in a session.

        Args:
            session_id: UUID of the session.

        Returns:
            Number of deleted messages.
        """
        return self.conversation_repo.delete_session(session_id)
