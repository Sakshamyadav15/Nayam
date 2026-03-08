"""
NAYAM — Bhashini (Gov India AI Language Services) Pydantic Schemas.

Request/response models for ASR (Speech Recognition), TTS (Text-to-Speech),
and Transliteration via the Bhashini ULCA pipeline.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Language Codes (ISO 639-1 subset supported by Bhashini) ──────────

class BhashiniLanguage(str, Enum):
    """ISO 639 language codes supported by the Bhashini pipeline."""
    HINDI = "hi"
    ENGLISH = "en"
    BENGALI = "bn"
    TAMIL = "ta"
    TELUGU = "te"
    MARATHI = "mr"
    GUJARATI = "gu"
    KANNADA = "kn"
    MALAYALAM = "ml"
    PUNJABI = "pa"
    ODIA = "or"
    ASSAMESE = "as"
    URDU = "ur"
    SANSKRIT = "sa"
    MAITHILI = "mai"
    DOGRI = "doi"
    KASHMIRI = "ks"
    KONKANI = "kok"
    MANIPURI = "mni"
    NEPALI = "ne"
    SINDHI = "sd"
    SANTALI = "sat"
    BODO = "brx"


# ── ASR (Automatic Speech Recognition) ──────────────────────────────

class ASRRequest(BaseModel):
    """Request model for Bhashini ASR (speech-to-text)."""
    source_language: BhashiniLanguage = Field(
        default=BhashiniLanguage.HINDI,
        description="Language of the audio input (ISO 639 code)",
    )
    audio_format: str = Field(
        default="wav",
        description="Audio format: wav, mp3, flac, ogg, webm",
    )
    sampling_rate: int = Field(
        default=16000,
        description="Audio sampling rate in Hz",
    )
    enable_vad: bool = Field(
        default=True,
        description="Enable Voice Activity Detection for audio >30s",
    )
    enable_itn: bool = Field(
        default=True,
        description="Enable Inverse Text Normalization (spoken numbers to digits)",
    )
    enable_punctuation: bool = Field(
        default=True,
        description="Enable automatic punctuation in output",
    )


class ASRResponse(BaseModel):
    """Response model for Bhashini ASR."""
    transcript: str = Field(..., description="Transcribed text from audio")
    source_language: str = Field(..., description="Language code of the input audio")
    service_id: str = Field("", description="Bhashini model service ID used")
    provider: str = Field(default="bhashini_asr", description="Provider identifier")
    success: bool = True


# ── TTS (Text-to-Speech) ────────────────────────────────────────────

class TTSGender(str, Enum):
    """Voice gender options for TTS."""
    MALE = "male"
    FEMALE = "female"


class TTSRequest(BaseModel):
    """Request model for Bhashini TTS (text-to-speech)."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    source_language: BhashiniLanguage = Field(
        default=BhashiniLanguage.HINDI,
        description="Language of the input text (ISO 639 code)",
    )
    gender: TTSGender = Field(
        default=TTSGender.FEMALE,
        description="Voice gender: male or female",
    )
    sampling_rate: int = Field(
        default=22050,
        description="Output audio sampling rate in Hz",
    )


class TTSResponse(BaseModel):
    """Response model for Bhashini TTS."""
    audio_base64: str = Field(..., description="Base64-encoded WAV audio output")
    source_language: str = Field(..., description="Language code of the synthesized speech")
    service_id: str = Field("", description="Bhashini model service ID used")
    provider: str = Field(default="bhashini_tts", description="Provider identifier")
    success: bool = True


# ── Translation (NMT) ───────────────────────────────────────────────

class TranslationRequest(BaseModel):
    """Request model for Bhashini NMT (Neural Machine Translation)."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to translate")
    source_language: BhashiniLanguage = Field(
        default=BhashiniLanguage.ENGLISH,
        description="Source language (ISO 639 code)",
    )
    target_language: BhashiniLanguage = Field(
        default=BhashiniLanguage.HINDI,
        description="Target language (ISO 639 code)",
    )


class TranslationResponse(BaseModel):
    """Response model for Bhashini NMT."""
    translated_text: str = Field(..., description="Translated text")
    source_language: str
    target_language: str
    service_id: str = Field("", description="Bhashini model service ID used")
    provider: str = Field(default="bhashini_nmt", description="Provider identifier")
    success: bool = True


# ── Pipeline Config (internal) ───────────────────────────────────────

class BhashiniServiceConfig(BaseModel):
    """Cached service configuration from a Bhashini Pipeline Config call."""
    service_id: str
    callback_url: str
    inference_api_key_name: str
    inference_api_key_value: str


class BhashiniConfigCache(BaseModel):
    """Full cached config for a task type + language pair."""
    task_type: str
    source_language: str
    target_language: Optional[str] = None
    config: BhashiniServiceConfig


# ── Supported Languages Response ────────────────────────────────────

class SupportedLanguagesResponse(BaseModel):
    """Response listing languages supported by the Bhashini pipeline."""
    asr_languages: List[str] = Field(default_factory=list, description="Languages with ASR support")
    tts_languages: List[str] = Field(default_factory=list, description="Languages with TTS support")
    translation_pairs: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Supported source-target translation pairs",
    )
    provider: str = "bhashini"


# ── Classify Text (LLM Intelligence) ────────────────────────────────

class ClassifyTextRequest(BaseModel):
    """Request to classify text as question/issue/document."""
    text: str = Field(..., min_length=5, max_length=10000, description="Text to classify")

class ClassifyTextResponse(BaseModel):
    """Classification result from LLM."""
    category: str = Field(..., description="One of: question, issue, document")
    confidence: float = Field(..., description="Confidence score 0.0-1.0")
    reasoning: str = Field(..., description="LLM reasoning for classification")
    extracted_metadata: Dict[str, Any] = Field(default_factory=dict)
    success: bool = True


# ── Summarize Text (LLM Intelligence) ───────────────────────────────

class SummarizeRequest(BaseModel):
    """Request to summarize text using LLM."""
    text: str = Field(..., min_length=20, max_length=20000, description="Text to summarize")

class SummarizeResponse(BaseModel):
    """Structured summary from LLM."""
    summary: str = Field(..., description="Executive summary")
    key_points: List[str] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)
    departments_mentioned: List[str] = Field(default_factory=list)
    language_detected: str = Field(default="", description="Detected language of input")
    success: bool = True
