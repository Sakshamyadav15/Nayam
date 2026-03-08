"""
NAYAM (नयम्) — Speech-to-Text (STT) Service.

Real implementation of the full STT pipeline:
  1. Audio transcription:
       • LOCAL faster-whisper "small" model (PRIMARY — free, offline, fast)
       • Groq Whisper API (fallback #1)
       • OpenAI Whisper API (fallback #2)
  2. LLM-based content classification (policy draft vs citizen issue vs ...)
  3. Intelligent routing — auto-create Document or Issue based on classification
  4. RAG ingestion — chunk + store embeddings for all transcripts
"""

import json
import logging
import os
import uuid
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.repositories.document import DocumentRepository
from app.schemas.stt import (
    ClassificationResult,
    ContentCategory,
    IngestResult,
)

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Audio file validation ────────────────────────────────────────────
ALLOWED_AUDIO_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac", ".aac", ".mp4",
}

ALLOWED_AUDIO_CONTENT_TYPES = {
    "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mpeg", "audio/mp3",
    "audio/mp4", "audio/m4a", "audio/x-m4a",
    "audio/ogg", "audio/webm",
    "audio/flac", "audio/aac",
    "video/webm",  # MediaRecorder sometimes uses video/webm for audio
}


def _validate_audio(file: UploadFile) -> None:
    """Validate that the uploaded file is an audio file."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required.",
        )
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio type '{ext}' not supported. Supported: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}",
        )


async def _save_audio(file: UploadFile) -> Tuple[str, bytes]:
    """Save audio file to uploads dir and return (path, raw_bytes)."""
    _, ext = os.path.splitext(file.filename or "audio.wav")
    safe_name = f"audio_{uuid.uuid4().hex}{ext.lower()}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_name)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:  # 25 MB limit for Whisper
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio file exceeds 25 MB limit.",
        )

    with open(file_path, "wb") as f:
        f.write(content)

    logger.info("Audio saved: %s (%d bytes)", file_path, len(content))
    return file_path, content


# ═════════════════════════════════════════════════════════════════════
# 1. TRANSCRIPTION — Convert audio to text
# ═════════════════════════════════════════════════════════════════════

# ── Local Whisper (faster-whisper, small model) ──────────────────────

import threading

_whisper_model = None
_whisper_lock = threading.Lock()


def _get_whisper_model():
    """
    Lazy-load the faster-whisper "small" model as a singleton.

    The model is downloaded once from HuggingFace (~461 MB) and cached
    locally in ~/.cache/huggingface/. Subsequent calls reuse the loaded
    model in memory.

    Uses CPU + int8 quantisation for maximum compatibility and speed
    on machines without a GPU.
    """
    global _whisper_model
    if _whisper_model is None:
        with _whisper_lock:
            if _whisper_model is None:  # double-check inside lock
                from faster_whisper import WhisperModel

                logger.info("Loading local Whisper model (small, int8, CPU) ...")
                _whisper_model = WhisperModel(
                    "small",
                    device="cpu",
                    compute_type="int8",
                )
                logger.info("Local Whisper model loaded successfully.")
    return _whisper_model


def transcribe_with_local_whisper(
    audio_path: str,
) -> Tuple[str, Optional[str], Optional[float]]:
    """
    Transcribe audio using the LOCAL faster-whisper "small" model.

    This is the PRIMARY provider — free, offline, no API key needed.
    Uses CTranslate2 under the hood (4× faster than original Whisper).

    Returns: (transcript, language, duration_seconds)
    """
    model = _get_whisper_model()

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language=None,  # auto-detect
        vad_filter=True,  # skip silence for faster processing
    )

    # Collect all segment texts
    transcript_parts = []
    for segment in segments:
        transcript_parts.append(segment.text.strip())

    transcript = " ".join(transcript_parts)
    language = info.language if info else None
    duration = info.duration if info else None

    return transcript.strip(), language, duration


def transcribe_with_groq(audio_path: str) -> Tuple[str, Optional[str], Optional[float]]:
    """
    Transcribe audio using Groq Whisper API.

    Returns: (transcript, language, duration_seconds)
    """
    from groq import Groq

    client = Groq(api_key=settings.GROQ_API_KEY)

    with open(audio_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), audio_file),
            model="whisper-large-v3",
            language=None,  # auto-detect language
            response_format="verbose_json",
        )

    # Groq returns a Transcription object
    transcript = response.text if hasattr(response, "text") else str(response)
    language = getattr(response, "language", None)
    duration = getattr(response, "duration", None)

    return transcript.strip(), language, duration


def transcribe_with_openai(audio_path: str) -> Tuple[str, Optional[str], Optional[float]]:
    """
    Transcribe audio using OpenAI Whisper API.

    Returns: (transcript, language, duration_seconds)
    """
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    with open(audio_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-1",
            response_format="verbose_json",
        )

    transcript = response.text if hasattr(response, "text") else str(response)
    language = getattr(response, "language", None)
    duration = getattr(response, "duration", None)

    return transcript.strip(), language, duration


def transcribe_audio(audio_path: str) -> Tuple[str, Optional[str], Optional[float], str]:
    """
    Transcribe audio using the best available provider.

    Provider selection priority:
      1. Groq Whisper API (fast, accurate, free tier) — if GROQ_API_KEY is set
      2. Bhashini ASR (Gov India, 22+ Indian languages) — if BHASHINI keys are set
      3. LOCAL faster-whisper "small" (offline fallback)
      4. OpenAI Whisper API — if OPENAI_API_KEY is set
      5. Error — nothing worked

    Returns: (transcript, language, duration_seconds, provider_name)
    """
    # Priority 1: Groq Whisper API (fast + accurate, especially for Hindi)
    if settings.GROQ_API_KEY:
        try:
            transcript, lang, dur = transcribe_with_groq(audio_path)
            if transcript:
                return transcript, lang, dur, "groq_whisper"
        except Exception as exc:
            logger.warning("Groq Whisper failed, trying next fallback: %s", exc)

    # Priority 2: Bhashini ASR (Gov India — excellent for Indian languages)
    if settings.BHASHINI_USER_ID and settings.BHASHINI_API_KEY:
        try:
            from app.services.bhashini import transcribe_file_bhashini
            transcript, lang, dur = transcribe_file_bhashini(audio_path, source_language="hi")
            if transcript:
                logger.info("Transcription completed via Bhashini ASR")
                return transcript, lang, dur, "bhashini_asr"
        except Exception as exc:
            logger.warning("Bhashini ASR failed, trying next fallback: %s", exc)

    # Priority 3: Local faster-whisper (offline fallback)
    try:
        transcript, lang, dur = transcribe_with_local_whisper(audio_path)
        if transcript:
            logger.info("Transcription completed via local whisper-small")
            return transcript, lang, dur, "local_whisper_small"
    except Exception as exc:
        logger.warning("Local Whisper failed: %s", exc)

    # Priority 4: OpenAI Whisper API
    if settings.OPENAI_API_KEY:
        try:
            transcript, lang, dur = transcribe_with_openai(audio_path)
            if transcript:
                return transcript, lang, dur, "openai_whisper"
        except Exception as exc:
            logger.warning("OpenAI Whisper failed: %s", exc)

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="No STT provider available. Local Whisper failed and no API keys configured.",
    )


# ═════════════════════════════════════════════════════════════════════
# 2. CONTENT CLASSIFICATION — LLM determines what the transcript IS
# ═════════════════════════════════════════════════════════════════════

CLASSIFICATION_SYSTEM_PROMPT = """You are a content classifier for the NAYAM municipal governance platform.

Given a transcribed speech, classify it into EXACTLY ONE category and extract structured metadata.

CATEGORIES:
1. "policy_document" — The speaker is dictating or drafting a policy, circular, guideline, SOP, government order, or regulation. 
   Signals: formal language, references to sections/clauses, mentions of "policy", "guideline", "draft", "notification", "effective from", "all departments shall".

2. "citizen_issue" — The speaker is reporting a citizen complaint, grievance, or service request.
   Signals: mentions of specific wards, broken infrastructure, water supply problems, garbage, road damage, "complaint", "issue", "problem", "not working".

3. "meeting_minutes" — The speaker is recording meeting discussions or proceedings.
   Signals: "meeting", "agenda", "discussed", "resolved that", "present were", "minutes".

4. "field_report" — The speaker is reporting from a field inspection or site visit.
   Signals: "inspection", "site visit", "observed", "ground condition", "field report", "on location".

5. "general_query" — The speaker is asking a question meant for the AI advisor, not reporting data.
   Signals: questions like "what is", "how many", "show me", "tell me about", "what's the status of".

You MUST respond with ONLY a valid JSON object (no markdown, no extra text):
{
  "category": "<one of: policy_document, citizen_issue, meeting_minutes, field_report, general_query>",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<one sentence explaining why>",
  "extracted_metadata": {
    "title": "<suggested title for the content, or null>",
    "department": "<relevant department if identifiable, or null>",
    "ward": "<ward name/number if mentioned, or null>",
    "priority": "<Low/Medium/High if it's an issue, or null>",
    "citizen_name": "<citizen name if mentioned, or null>",
    "summary": "<2-3 sentence summary of the content>"
  }
}"""


def classify_content(transcript: str) -> ClassificationResult:
    """
    Use Groq LLM to classify transcribed text into a content category
    and extract structured metadata.

    This is the core differentiator — it determines whether spoken content
    becomes a Document, an Issue, or an Agent query.
    """
    if not settings.GROQ_API_KEY:
        # Fallback: keyword-based classification
        return _keyword_classify(transcript)

    try:
        from groq import Groq

        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
                {"role": "user", "content": f"Classify this transcribed speech:\n\n{transcript[:3000]}"},
            ],
            temperature=0.1,  # Very low — we want deterministic classification
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()

        # Parse JSON from LLM response (handle markdown code blocks)
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        parsed = json.loads(raw)

        return ClassificationResult(
            category=ContentCategory(parsed["category"]),
            confidence=float(parsed.get("confidence", 0.8)),
            reasoning=parsed.get("reasoning", "Classified by LLM"),
            extracted_metadata=parsed.get("extracted_metadata", {}),
        )

    except Exception as exc:
        logger.warning("LLM classification failed, using keyword fallback: %s", exc)
        return _keyword_classify(transcript)


def _keyword_classify(transcript: str) -> ClassificationResult:
    """
    Fallback keyword-based classifier when LLM is unavailable.

    Scores each category by keyword overlap, similar to AgentRouter.
    """
    text_lower = transcript.lower()

    scores = {
        ContentCategory.POLICY_DOCUMENT: 0,
        ContentCategory.CITIZEN_ISSUE: 0,
        ContentCategory.MEETING_MINUTES: 0,
        ContentCategory.FIELD_REPORT: 0,
        ContentCategory.GENERAL_QUERY: 0,
    }

    # Policy signals
    for kw in ["policy", "guideline", "draft", "circular", "notification",
               "regulation", "section", "clause", "effective from", "government order",
               "all departments", "hereby", "scheme", "SOP", "standard operating"]:
        if kw.lower() in text_lower:
            scores[ContentCategory.POLICY_DOCUMENT] += 1

    # Issue signals
    for kw in ["complaint", "issue", "problem", "not working", "broken",
               "ward", "water supply", "garbage", "pothole", "road damage",
               "electricity", "sanitation", "sewage", "drainage", "resident"]:
        if kw.lower() in text_lower:
            scores[ContentCategory.CITIZEN_ISSUE] += 1

    # Meeting signals
    for kw in ["meeting", "agenda", "minutes", "discussed", "resolved that",
               "present were", "attendance", "proceedings", "adjourned"]:
        if kw.lower() in text_lower:
            scores[ContentCategory.MEETING_MINUTES] += 1

    # Field report signals
    for kw in ["inspection", "site visit", "field report", "observed",
               "ground condition", "on location", "surveyed", "assessment"]:
        if kw.lower() in text_lower:
            scores[ContentCategory.FIELD_REPORT] += 1

    # Query signals
    for kw in ["what is", "how many", "show me", "tell me", "what's the",
               "can you", "please find", "status of", "list all"]:
        if kw.lower() in text_lower:
            scores[ContentCategory.GENERAL_QUERY] += 1

    best_category = max(scores, key=scores.get)  # type: ignore[arg-type]
    best_score = scores[best_category]
    total = sum(scores.values())

    if total == 0:
        return ClassificationResult(
            category=ContentCategory.GENERAL_QUERY,
            confidence=0.3,
            reasoning="No strong signals detected, defaulting to general query",
            extracted_metadata={"summary": transcript[:200]},
        )

    return ClassificationResult(
        category=best_category,
        confidence=round(best_score / max(total, 1), 2),
        reasoning=f"Keyword scoring: {best_score}/{total} signals matched for {best_category.value}",
        extracted_metadata={"summary": transcript[:200]},
    )


# ═════════════════════════════════════════════════════════════════════
# 3. INTELLIGENT ROUTING — Create the right entity based on category
# ═════════════════════════════════════════════════════════════════════

class STTService:
    """
    Full STT pipeline service: transcribe → classify → route → ingest.

    This service answers the core question: when someone speaks about
    "a new water supply policy draft" vs "Ward-3 has a water pipe burst",
    how does the system know the first is a Document and the second is an Issue?

    Answer: The LLM classifier examines the transcript's intent, language
    patterns, and explicit signals to categorize it. Then the router
    creates the appropriate entity (Document or Issue) and indexes it
    for RAG retrieval.
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    async def transcribe_only(self, file: UploadFile) -> dict:
        """Step 1 only: Audio → Text."""
        _validate_audio(file)
        audio_path, _ = await _save_audio(file)

        try:
            transcript, language, duration, provider = transcribe_audio(audio_path)
            return {
                "transcript": transcript,
                "language": language,
                "duration_seconds": duration,
                "provider": provider,
            }
        finally:
            # Clean up audio file after transcription
            self._cleanup_file(audio_path)

    async def transcribe_and_classify(self, file: UploadFile) -> dict:
        """Steps 1-2: Audio → Text → Classify."""
        _validate_audio(file)
        audio_path, _ = await _save_audio(file)

        try:
            transcript, language, duration, provider = transcribe_audio(audio_path)
            classification = classify_content(transcript)

            return {
                "transcript": transcript,
                "language": language,
                "duration_seconds": duration,
                "provider": provider,
                "classification": classification,
            }
        finally:
            self._cleanup_file(audio_path)

    async def transcribe_and_ingest(
        self,
        file: UploadFile,
        user_id,
        session_id: Optional[str] = None,
    ) -> dict:
        """
        Full pipeline: Audio → Text → Classify → Route → Create Entity → RAG Index.

        This is where the magic happens. Based on classification:

        • POLICY_DOCUMENT / MEETING_MINUTES / FIELD_REPORT →
            Create a Document record, extract/chunk text, store embeddings for RAG.
            The document is titled using LLM-extracted metadata.

        • CITIZEN_ISSUE →
            Create an Issue record with department, priority, and description
            extracted from the transcript. Also store the transcript as
            embeddings for RAG so the AI agents can reference it.

        • GENERAL_QUERY →
            Don't create any entity. Instead, route the transcript as a
            query to the Agent system for immediate response.
        """
        _validate_audio(file)
        audio_path, _ = await _save_audio(file)

        try:
            # Step 1: Transcribe
            transcript, language, duration, provider = transcribe_audio(audio_path)

            # Step 2: Classify
            classification = classify_content(transcript)
            meta = classification.extracted_metadata

            # Step 3: Route based on classification
            ingestion = self._route_and_ingest(
                transcript=transcript,
                classification=classification,
                user_id=user_id,
                audio_path=audio_path,
                session_id=session_id,
            )

            return {
                "transcript": transcript,
                "language": language,
                "duration_seconds": duration,
                "provider": provider,
                "classification": classification,
                "ingestion": ingestion,
            }
        finally:
            self._cleanup_file(audio_path)

    def _route_and_ingest(
        self,
        transcript: str,
        classification: ClassificationResult,
        user_id,
        audio_path: str,
        session_id: Optional[str] = None,
    ) -> IngestResult:
        """
        Route classified transcript to the appropriate entity creation.

        ┌──────────────────────────────────────────────────────────────┐
        │  HOW DIFFERENTIATION WORKS:                                  │
        │                                                              │
        │  "We are drafting a new water supply policy for Ward-5.      │
        │   Section 1: All households shall receive minimum 135 LPCD   │
        │   of potable water..."                                       │
        │                                                              │
        │  → LLM sees: formal language, "policy", "section",          │
        │    "shall receive" → category = POLICY_DOCUMENT              │
        │  → Creates: Document(title="Water Supply Policy Ward-5")     │
        │  → RAG: Chunks stored as source_type="voice_transcript"     │
        │                                                              │
        │  vs.                                                         │
        │                                                              │
        │  "There is a major water pipe burst in Ward-3 near the       │
        │   main road. Residents are complaining about no water        │
        │   supply since yesterday morning."                           │
        │                                                              │
        │  → LLM sees: "pipe burst", "Ward-3", "complaining",        │
        │    "no water supply" → category = CITIZEN_ISSUE              │
        │  → Creates: Issue(dept="Water Supply", priority=High,        │
        │             description=<transcript>)                        │
        │  → RAG: Also stored as embeddings for agent retrieval       │
        └──────────────────────────────────────────────────────────────┘
        """
        category = classification.category
        meta = classification.extracted_metadata

        if category in (
            ContentCategory.POLICY_DOCUMENT,
            ContentCategory.MEETING_MINUTES,
            ContentCategory.FIELD_REPORT,
        ):
            return self._create_document_from_transcript(
                transcript, classification, user_id
            )

        elif category == ContentCategory.CITIZEN_ISSUE:
            return self._create_issue_from_transcript(
                transcript, classification, user_id
            )

        elif category == ContentCategory.GENERAL_QUERY:
            return self._route_to_agent(
                transcript, classification, user_id, session_id
            )

        else:
            # Shouldn't happen, but safe fallback
            return self._create_document_from_transcript(
                transcript, classification, user_id
            )

    def _create_document_from_transcript(
        self,
        transcript: str,
        classification: ClassificationResult,
        user_id,
    ) -> IngestResult:
        """
        Create a Document from voice transcript.

        Flow: transcript → Document(title, text, summary) → chunk → embed → RAG
        """
        from app.services.document import chunk_text, generate_summary
        from app.services.memory import MemoryService

        meta = classification.extracted_metadata
        category_labels = {
            ContentCategory.POLICY_DOCUMENT: "Policy Draft",
            ContentCategory.MEETING_MINUTES: "Meeting Minutes",
            ContentCategory.FIELD_REPORT: "Field Report",
        }
        prefix = category_labels.get(classification.category, "Voice Document")
        title = meta.get("title") or f"{prefix} — {transcript[:60]}..."

        # Generate AI summary
        summary = generate_summary(transcript)

        # Create Document record
        doc_repo = DocumentRepository(self._db)
        document = Document(
            title=title,
            uploaded_by=user_id,
            file_path=f"voice_transcript_{uuid.uuid4().hex}.txt",
            extracted_text=transcript,
            summary=summary,
        )
        created_doc = doc_repo.create(document)

        # Save transcript as a text file for reference
        text_path = os.path.join(settings.UPLOAD_DIR, created_doc.file_path)
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(transcript)

        # Store chunks as embeddings for RAG retrieval
        try:
            memory = MemoryService(self._db)
            chunks = chunk_text(transcript)
            for idx, chunk in enumerate(chunks):
                memory.store_embedding(
                    source_type="voice_transcript",
                    source_id=created_doc.id,
                    text=chunk,
                    embedding_vector=[0.0],
                    chunk_index=idx,
                    model_name="tfidf-local",
                )
            logger.info(
                "Stored %d voice transcript chunks for document %s",
                len(chunks), created_doc.id,
            )
        except Exception as e:
            logger.warning("Failed to store voice embeddings: %s", e)

        return IngestResult(
            category=classification.category,
            created_type="document",
            created_id=str(created_doc.id),
            title=title,
            summary=summary,
            detail=f"Created document '{title}' from voice transcript with {len(chunk_text(transcript))} RAG chunks indexed.",
        )

    def _create_issue_from_transcript(
        self,
        transcript: str,
        classification: ClassificationResult,
        user_id,
    ) -> IngestResult:
        """
        Create an Issue from a citizen complaint / grievance transcript.

        The LLM extracts: department, priority, ward, citizen_name.
        Missing fields get sensible defaults.
        """
        from app.services.memory import MemoryService
        from app.services.document import chunk_text
        from app.repositories.citizen import CitizenRepository

        meta = classification.extracted_metadata

        # Map extracted department or default
        department = meta.get("department") or "General Administration"

        # Map extracted priority
        priority_str = (meta.get("priority") or "Medium").capitalize()
        priority_map = {"Low": IssuePriority.LOW, "Medium": IssuePriority.MEDIUM, "High": IssuePriority.HIGH}
        priority = priority_map.get(priority_str, IssuePriority.MEDIUM)

        # Find or fallback citizen
        citizen_id = None
        citizen_name = meta.get("citizen_name")
        if citizen_name:
            citizen_repo = CitizenRepository(self._db)
            citizens, _ = citizen_repo.get_all(search=citizen_name, limit=1)
            if citizens:
                citizen_id = citizens[0].id

        # If no citizen found, try to use the first citizen in the system
        if citizen_id is None:
            from app.models.citizen import Citizen as CitizenModel
            first_citizen = self._db.query(CitizenModel).first()
            if first_citizen:
                citizen_id = first_citizen.id
            else:
                return IngestResult(
                    category=classification.category,
                    created_type="issue",
                    created_id=None,
                    title=None,
                    summary=meta.get("summary"),
                    detail="Could not create issue: no citizens exist in the system. Please create a citizen first.",
                )

        # Create the Issue
        issue = Issue(
            citizen_id=citizen_id,
            department=department,
            description=transcript,
            status=IssueStatus.OPEN,
            priority=priority,
        )
        self._db.add(issue)
        self._db.commit()
        self._db.refresh(issue)

        # Also store transcript for RAG (so agents can reference this complaint)
        try:
            memory = MemoryService(self._db)
            chunks = chunk_text(transcript)
            for idx, chunk in enumerate(chunks):
                memory.store_embedding(
                    source_type="voice_transcript",
                    source_id=issue.id,
                    text=chunk,
                    embedding_vector=[0.0],
                    chunk_index=idx,
                    model_name="tfidf-local",
                )
        except Exception as e:
            logger.warning("Failed to store issue voice embeddings: %s", e)

        issue_title = meta.get("summary", transcript[:80])
        return IngestResult(
            category=classification.category,
            created_type="issue",
            created_id=str(issue.id),
            title=f"Issue: {department}",
            summary=issue_title,
            detail=(
                f"Created issue in '{department}' department with {priority.value} priority. "
                f"Status: Open. Transcript indexed for RAG retrieval."
            ),
        )

    def _route_to_agent(
        self,
        transcript: str,
        classification: ClassificationResult,
        user_id,
        session_id: Optional[str] = None,
    ) -> IngestResult:
        """
        Route as a query to the AI agent system (no entity creation).

        The transcript is treated as a user question and processed
        through the normal agent pipeline.
        """
        from app.services.agent import AgentService

        service = AgentService(self._db)
        try:
            result = service.process_query(
                user_id=user_id,
                query=transcript,
                session_id=session_id,
            )
            return IngestResult(
                category=classification.category,
                created_type="agent_query",
                created_id=result.get("session_id"),
                title=None,
                summary=result.get("response", "")[:200],
                detail=f"Routed to {result.get('agent_name', 'AI Agent')}. Response generated.",
            )
        except Exception as exc:
            logger.error("Agent query from STT failed: %s", exc)
            return IngestResult(
                category=classification.category,
                created_type="agent_query",
                created_id=None,
                title=None,
                summary=None,
                detail=f"Agent query failed: {exc}",
            )

    @staticmethod
    def _cleanup_file(path: str) -> None:
        """Remove temporary audio file after processing."""
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            pass
