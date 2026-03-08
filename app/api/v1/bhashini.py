"""
NAYAM — Bhashini API Routes.

Endpoints for Bhashini Gov India AI language services:
  POST /asr               — Speech-to-Text (ASR)
  POST /tts               — Text-to-Speech (TTS)
  POST /translate          — Neural Machine Translation
  POST /asr-translate      — Compound: ASR + Translation
  POST /classify-text      — LLM text classification (question/issue/document)
  POST /summarize          — LLM text summarization
  GET  /languages          — Supported languages per task
  GET  /health             — Bhashini connectivity check
"""

import base64
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.exceptions import HTTPException

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.bhashini import (
    ASRRequest,
    ASRResponse,
    BhashiniLanguage,
    SupportedLanguagesResponse,
    TTSRequest,
    TTSResponse,
    TTSGender,
    TranslationRequest,
    TranslationResponse,
    ClassifyTextRequest,
    ClassifyTextResponse,
    SummarizeRequest,
    SummarizeResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bhashini"])

# Lazy import — keeps module load fast
from app.services import bhashini as bhashini_svc  # noqa: E402


# ── ASR (Speech-to-Text) ────────────────────────────────────────────

@router.post(
    "/asr",
    response_model=ASRResponse,
    status_code=status.HTTP_200_OK,
    summary="Bhashini ASR — Speech to Text",
)
async def bhashini_asr(
    file: UploadFile = File(..., description="Audio file (.wav, .mp3, .flac, .ogg, .webm)"),
    source_language: str = Form("hi", description="Audio language (ISO 639 code, e.g., hi, en, ta, bn)"),
    enable_vad: bool = Form(True, description="Enable Voice Activity Detection"),
    enable_itn: bool = Form(True, description="Enable Inverse Text Normalization"),
    enable_punctuation: bool = Form(True, description="Enable automatic punctuation"),
    current_user: User = Depends(get_current_user),
) -> ASRResponse:
    """
    Transcribe audio to text using Bhashini ASR (Government of India).

    Supports 22+ Indian languages including Hindi, English, Tamil,
    Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, and more.

    Audio is base64-encoded and sent to the Bhashini ULCA pipeline.
    """
    try:
        # Read and validate audio
        content = await file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio file exceeds 25 MB limit.",
            )

        _, ext = os.path.splitext(file.filename or "audio.wav")
        audio_format = ext.lstrip(".").lower()
        if audio_format in ("mp4", "m4a"):
            audio_format = "wav"

        audio_b64 = base64.b64encode(content).decode("utf-8")

        result = bhashini_svc.transcribe_audio_bhashini(
            audio_content_base64=audio_b64,
            source_language=source_language,
            audio_format=audio_format,
            enable_vad=enable_vad,
            enable_itn=enable_itn,
            enable_punctuation=enable_punctuation,
        )

        return ASRResponse(
            transcript=result["transcript"],
            source_language=result["source_language"],
            service_id=result["service_id"],
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Bhashini ASR failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bhashini ASR service error: {str(exc)}",
        )


# ── TTS (Text-to-Speech) ────────────────────────────────────────────

@router.post(
    "/tts",
    response_model=TTSResponse,
    status_code=status.HTTP_200_OK,
    summary="Bhashini TTS — Text to Speech",
)
async def bhashini_tts(
    request: TTSRequest,
    current_user: User = Depends(get_current_user),
) -> TTSResponse:
    """
    Convert text to speech using Bhashini TTS (Government of India).

    Returns base64-encoded audio that can be played directly in the browser.
    Supports male and female voices across 22+ Indian languages.
    """
    try:
        result = bhashini_svc.synthesize_speech(
            text=request.text,
            source_language=request.source_language.value,
            gender=request.gender.value,
            sampling_rate=request.sampling_rate,
        )

        if not result["audio_base64"]:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Bhashini TTS returned empty audio. The language/voice may not be available.",
            )

        return TTSResponse(
            audio_base64=result["audio_base64"],
            source_language=result["source_language"],
            service_id=result["service_id"],
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Bhashini TTS failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bhashini TTS service error: {str(exc)}",
        )


# ── Translation (NMT) ───────────────────────────────────────────────

@router.post(
    "/translate",
    response_model=TranslationResponse,
    status_code=status.HTTP_200_OK,
    summary="Bhashini NMT — Neural Machine Translation",
)
async def bhashini_translate(
    request: TranslationRequest,
    current_user: User = Depends(get_current_user),
) -> TranslationResponse:
    """
    Translate text between Indian languages using Bhashini NMT.

    Supports translation between 22+ Indian languages and English.
    """
    try:
        result = bhashini_svc.translate_text(
            text=request.text,
            source_language=request.source_language.value,
            target_language=request.target_language.value,
        )

        return TranslationResponse(
            translated_text=result["translated_text"],
            source_language=result["source_language"],
            target_language=result["target_language"],
            service_id=result["service_id"],
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Bhashini Translation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bhashini Translation service error: {str(exc)}",
        )


# ── Classify Text (LLM Intelligence) ──────────────────────────────

@router.post(
    "/classify-text",
    response_model=ClassifyTextResponse,
    status_code=status.HTTP_200_OK,
    summary="Classify text as question, issue, or document",
)
async def bhashini_classify_text(
    request: ClassifyTextRequest,
    current_user: User = Depends(get_current_user),
) -> ClassifyTextResponse:
    """
    Classify text using LLM intelligence.

    Takes transcribed text (in any language) and classifies it as:
    - **question** — user is asking a question / seeking information
    - **issue** — citizen complaint, grievance, or service request
    - **document** — policy, meeting minutes, field report, or other formal record

    Also extracts structured metadata (title, department, priority, etc.).
    """
    try:
        result = bhashini_svc.classify_text(request.text)
        return ClassifyTextResponse(**result)
    except Exception as exc:
        logger.error("Text classification failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Classification error: {str(exc)}",
        )


# ── Summarize Text (LLM Intelligence) ─────────────────────────────

@router.post(
    "/summarize",
    response_model=SummarizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Summarize text using LLM",
)
async def bhashini_summarize(
    request: SummarizeRequest,
    current_user: User = Depends(get_current_user),
) -> SummarizeResponse:
    """
    Summarize text using LLM intelligence.

    Designed for meeting transcripts, field reports, and long voice recordings.
    Returns a structured summary with key points, action items, and departments.
    """
    try:
        result = bhashini_svc.summarize_text(request.text)
        return SummarizeResponse(**result)
    except Exception as exc:
        logger.error("Text summarization failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Summarization error: {str(exc)}",
        )


# ── Compound: ASR + Translation ─────────────────────────────────────

@router.post(
    "/asr-translate",
    status_code=status.HTTP_200_OK,
    summary="Bhashini ASR + Translation — Speech to Translated Text",
)
async def bhashini_asr_translate(
    file: UploadFile = File(..., description="Audio file"),
    source_language: str = Form("hi", description="Audio language (ISO 639 code)"),
    target_language: str = Form("en", description="Translation target language (ISO 639 code)"),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Compound pipeline: Transcribe audio and translate in a single call.

    Example: Hindi speech → English text.
    Uses Bhashini's compound ASR + NMT pipeline for efficiency.
    """
    try:
        content = await file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Audio file exceeds 25 MB limit.",
            )

        _, ext = os.path.splitext(file.filename or "audio.wav")
        audio_format = ext.lstrip(".").lower()
        if audio_format in ("mp4", "m4a"):
            audio_format = "wav"

        audio_b64 = base64.b64encode(content).decode("utf-8")

        result = bhashini_svc.transcribe_and_translate(
            audio_content_base64=audio_b64,
            source_language=source_language,
            target_language=target_language,
            audio_format=audio_format,
        )

        return {
            "transcript": result["transcript"],
            "translated_text": result["translated_text"],
            "source_language": result["source_language"],
            "target_language": result["target_language"],
            "provider": "bhashini_asr_nmt",
            "success": True,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Bhashini ASR+Translation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bhashini ASR+Translation service error: {str(exc)}",
        )


# ── Supported Languages ─────────────────────────────────────────────

@router.get(
    "/languages",
    response_model=SupportedLanguagesResponse,
    status_code=status.HTTP_200_OK,
    summary="List supported Bhashini languages",
)
async def bhashini_languages(
    current_user: User = Depends(get_current_user),
) -> SupportedLanguagesResponse:
    """
    List all languages supported by the Bhashini pipeline for each task type.

    Returns ASR languages, TTS languages, translation pairs, and transliteration pairs.
    """
    try:
        result = bhashini_svc.get_supported_languages()
        return SupportedLanguagesResponse(**result)
    except Exception as exc:
        logger.error("Bhashini languages fetch failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not fetch Bhashini language list: {str(exc)}",
        )


# ── Health Check ─────────────────────────────────────────────────────

@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Bhashini service health check",
)
async def bhashini_health(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Verify Bhashini API connectivity and key validity.

    Returns availability status and diagnostic detail.
    """
    result = bhashini_svc.check_bhashini_health()
    return {
        "service": "bhashini",
        "available": result["available"],
        "detail": result["detail"],
    }
