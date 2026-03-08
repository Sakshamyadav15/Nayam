"""
NAYAM — Bhashini Integration Service (Dhruva API).

Direct integration with the Government of India Bhashini Dhruva inference API:
  - ASR  (Automatic Speech Recognition / Speech-to-Text)
  - TTS  (Text-to-Speech)
  - NMT  (Neural Machine Translation)
  - Transliteration (script conversion)

Flow:
  Single POST to Dhruva inference endpoint with Authorization header.
  No config call or serviceId needed — Dhruva auto-selects the model.
"""

import base64
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Bhashini Dhruva inference endpoint
DHRUVA_INFERENCE_URL = settings.BHASHINI_INFERENCE_URL

# Languages known to be supported by Bhashini for each task type.
# Used by the /languages endpoint (Dhruva has no discovery API).
_KNOWN_ASR_LANGUAGES = [
    "hi", "en", "bn", "ta", "te", "mr", "gu", "kn", "ml",
    "pa", "or", "as", "ur", "sa", "mai", "doi", "ks", "kok",
    "mni", "ne", "sd", "sat", "brx",
]
_KNOWN_TTS_LANGUAGES = [
    "hi", "en", "bn", "ta", "te", "mr", "gu", "kn", "ml",
    "pa", "or", "as", "brx",
]
_KNOWN_TRANSLATION_LANGUAGES = [
    "hi", "en", "bn", "ta", "te", "mr", "gu", "kn", "ml",
    "pa", "or", "as", "ur", "sa", "mai", "doi", "ks", "kok",
    "mni", "ne", "sd", "sat", "brx",
]



# ═══════════════════════════════════════════════════════════════════
# Dhruva Inference Call (single step — no config needed)
# ═══════════════════════════════════════════════════════════════════

def _dhruva_call(payload: Dict[str, Any], timeout: float = 60.0) -> Dict[str, Any]:
    """
    Make a direct inference call to the Bhashini Dhruva pipeline.

    Args:
        payload: Full pipeline request body (pipelineTasks + inputData).
        timeout: HTTP timeout in seconds.

    Returns:
        JSON response body from Dhruva.

    Raises:
        RuntimeError: If the API key is missing or the call fails.
    """
    if not settings.BHASHINI_API_KEY:
        raise RuntimeError(
            "Bhashini API key not configured. Set BHASHINI_API_KEY in .env"
        )

    headers = {
        "Content-Type": "application/json",
        "Authorization": settings.BHASHINI_API_KEY,
    }

    logger.info(
        "Bhashini Dhruva call: tasks=%s",
        [t.get("taskType") for t in payload.get("pipelineTasks", [])],
    )

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(DHRUVA_INFERENCE_URL, json=payload, headers=headers)

    if resp.status_code != 200:
        logger.error(
            "Bhashini Dhruva call failed: status=%d, body=%s",
            resp.status_code,
            resp.text[:500],
        )
        raise RuntimeError(
            f"Bhashini Dhruva call failed (HTTP {resp.status_code}): {resp.text[:300]}"
        )

    # Dhruva may return empty body for unsupported tasks (e.g. transliteration)
    text = resp.text.strip()
    if not text:
        logger.warning("Bhashini Dhruva returned empty response body")
        return {"pipelineResponse": []}

    data = resp.json()
    logger.info("Bhashini Dhruva call succeeded")
    return data


# ═══════════════════════════════════════════════════════════════════
# ASR — Automatic Speech Recognition (Speech-to-Text)
# ═══════════════════════════════════════════════════════════════════

def transcribe_audio_bhashini(
    audio_content_base64: str,
    source_language: str = "hi",
    audio_format: str = "wav",
    sampling_rate: int = 16000,
    enable_vad: bool = True,
    enable_itn: bool = True,
    enable_punctuation: bool = True,
) -> Dict[str, Any]:
    """
    Transcribe audio using Bhashini ASR via Dhruva.

    Args:
        audio_content_base64: Base64-encoded audio content.
        source_language: ISO 639 language code (default: Hindi).
        audio_format: Audio format (wav, mp3, flac, etc.).
        sampling_rate: Audio sampling rate in Hz.
        enable_vad: Enable Voice Activity Detection.
        enable_itn: Enable Inverse Text Normalization.
        enable_punctuation: Enable auto punctuation.

    Returns:
        {"transcript": "...", "source_language": "...", "service_id": "dhruva-auto"}
    """
    pre_processors = []
    if enable_vad:
        pre_processors.append("vad")

    post_processors = []
    if enable_itn:
        post_processors.append("itn")
    if enable_punctuation:
        post_processors.append("punctuation")

    payload = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {"sourceLanguage": source_language},
                    "audioFormat": audio_format,
                    "samplingRate": sampling_rate,
                    **({"preProcessors": pre_processors} if pre_processors else {}),
                    **({"postProcessors": post_processors} if post_processors else {}),
                },
            }
        ],
        "inputData": {
            "input": [{"source": ""}],
            "audio": [{"audioContent": audio_content_base64}],
        },
    }

    result = _dhruva_call(payload)

    # Parse response
    transcript = ""
    for task_result in result.get("pipelineResponse", []):
        if task_result.get("taskType") == "asr":
            outputs = task_result.get("output", [])
            if outputs:
                transcript = outputs[0].get("source", "")
            break

    return {
        "transcript": transcript,
        "source_language": source_language,
        "service_id": "dhruva-auto",
    }


def transcribe_file_bhashini(
    audio_path: str,
    source_language: str = "hi",
    audio_format: Optional[str] = None,
    sampling_rate: int = 16000,
) -> Tuple[str, Optional[str], Optional[float]]:
    """
    Transcribe an audio file using Bhashini ASR via Dhruva.

    Convenience wrapper that reads a file, base64-encodes it,
    and calls the Bhashini ASR pipeline.

    Returns: (transcript, language, None) — duration not provided by Bhashini.
    """
    import os

    if audio_format is None:
        _, ext = os.path.splitext(audio_path)
        audio_format = ext.lstrip(".").lower()
        if audio_format in ("mp4", "m4a"):
            audio_format = "wav"

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

    result = transcribe_audio_bhashini(
        audio_content_base64=audio_b64,
        source_language=source_language,
        audio_format=audio_format,
        sampling_rate=sampling_rate,
    )

    return result["transcript"], result["source_language"], None


# ═══════════════════════════════════════════════════════════════════
# TTS — Text-to-Speech
# ═══════════════════════════════════════════════════════════════════

def synthesize_speech(
    text: str,
    source_language: str = "hi",
    gender: str = "female",
    sampling_rate: int = 22050,
) -> Dict[str, Any]:
    """
    Convert text to speech using Bhashini TTS via Dhruva.

    Args:
        text: Text to synthesize.
        source_language: ISO 639 language code.
        gender: Voice gender ("male" or "female").
        sampling_rate: Output audio sampling rate.

    Returns:
        {"audio_base64": "...", "source_language": "...", "service_id": "dhruva-auto"}
    """
    payload = {
        "pipelineTasks": [
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": source_language},
                    "gender": gender,
                    "samplingRate": sampling_rate,
                },
            }
        ],
        "inputData": {
            "input": [{"source": text}],
        },
    }

    result = _dhruva_call(payload)

    # Parse response
    audio_base64 = ""
    for task_result in result.get("pipelineResponse", []):
        if task_result.get("taskType") == "tts":
            audio_list = task_result.get("audio", [])
            if audio_list:
                audio_base64 = audio_list[0].get("audioContent", "")
            break

    return {
        "audio_base64": audio_base64,
        "source_language": source_language,
        "service_id": "dhruva-auto",
    }


# ═══════════════════════════════════════════════════════════════════
# NMT — Neural Machine Translation
# ═══════════════════════════════════════════════════════════════════

def translate_text(
    text: str,
    source_language: str = "en",
    target_language: str = "hi",
) -> Dict[str, Any]:
    """
    Translate text using Bhashini NMT via Dhruva.

    Args:
        text: Text to translate.
        source_language: Source language ISO 639 code.
        target_language: Target language ISO 639 code.

    Returns:
        {"translated_text": "...", "source_language": "...", "target_language": "...", "service_id": "dhruva-auto"}
    """
    payload = {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_language,
                        "targetLanguage": target_language,
                    },
                },
            }
        ],
        "inputData": {
            "input": [{"source": text}],
        },
    }

    result = _dhruva_call(payload)

    # Parse response
    translated_text = ""
    for task_result in result.get("pipelineResponse", []):
        if task_result.get("taskType") == "translation":
            outputs = task_result.get("output", [])
            if outputs:
                translated_text = outputs[0].get("target", "")
            break

    return {
        "translated_text": translated_text,
        "source_language": source_language,
        "target_language": target_language,
        "service_id": "dhruva-auto",
    }





# ═══════════════════════════════════════════════════════════════════
# Compound Pipeline: ASR + Translation (speech in one language -> text in another)
# ═══════════════════════════════════════════════════════════════════

def transcribe_and_translate(
    audio_content_base64: str,
    source_language: str = "hi",
    target_language: str = "en",
    audio_format: str = "wav",
    sampling_rate: int = 16000,
) -> Dict[str, Any]:
    """
    Transcribe audio and translate the result in a single Dhruva pipeline call.

    Uses compound pipeline: ASR + NMT.

    Returns:
        {
            "transcript": "...",
            "translated_text": "...",
            "source_language": "...",
            "target_language": "...",
            "asr_service_id": "dhruva-auto",
            "nmt_service_id": "dhruva-auto",
        }
    """
    payload = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {"sourceLanguage": source_language},
                    "audioFormat": audio_format,
                    "samplingRate": sampling_rate,
                    "preProcessors": ["vad"],
                    "postProcessors": ["itn", "punctuation"],
                },
            },
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_language,
                        "targetLanguage": target_language,
                    },
                },
            },
        ],
        "inputData": {
            "input": [{"source": ""}],
            "audio": [{"audioContent": audio_content_base64}],
        },
    }

    result = _dhruva_call(payload)

    transcript = ""
    translated_text = ""

    for task_result in result.get("pipelineResponse", []):
        task = task_result.get("taskType", "")
        outputs = task_result.get("output", [])
        if task == "asr" and outputs:
            transcript = outputs[0].get("source", "")
        elif task == "translation" and outputs:
            translated_text = outputs[0].get("target", "")

    return {
        "transcript": transcript,
        "translated_text": translated_text,
        "source_language": source_language,
        "target_language": target_language,
        "asr_service_id": "dhruva-auto",
        "nmt_service_id": "dhruva-auto",
    }


# ═══════════════════════════════════════════════════════════════════
# Supported Languages Discovery
# ═══════════════════════════════════════════════════════════════════

def get_supported_languages() -> Dict[str, Any]:
    """
    Return the known supported languages for each Bhashini task type.

    Dhruva does not have a language-discovery endpoint, so we return
    the static set of languages known to be supported by Bhashini models.
    """
    # Build translation / transliteration pairs (en <-> each Indian language)
    translation_pairs = []
    for lang in _KNOWN_TRANSLATION_LANGUAGES:
        if lang != "en":
            translation_pairs.append({"source": "en", "target": lang})
            translation_pairs.append({"source": lang, "target": "en"})

    return {
        "asr_languages": _KNOWN_ASR_LANGUAGES,
        "tts_languages": _KNOWN_TTS_LANGUAGES,
        "translation_pairs": translation_pairs,
    }


# ═══════════════════════════════════════════════════════════════════
# Intelligence: LLM-based Text Classification
# ═══════════════════════════════════════════════════════════════════

_CLASSIFY_SYSTEM_PROMPT = """You are a content classifier for the NAYAM municipal governance platform.

Given text (which may be in any Indian language), classify it into EXACTLY ONE category and extract metadata.

CATEGORIES:
1. "question" — The person is asking a question or seeking information.
   Signals: questions like "what is", "how many", "show me", "tell me about", "what's the status", "kya hai", "kitne".

2. "issue" — The person is reporting a citizen complaint, grievance, or active service request that needs resolution.
   Signals: PERSONAL experience of a problem — "there is a pothole", "water not coming", "garbage not collected", broken infrastructure, active complaints.
   KEY: The speaker is AFFECTED and wants something FIXED.

3. "document" — The person is dictating or describing a policy, report, meeting minutes, budget, proposal, circular, guideline, or any formal/informational record.
   Signals: formal language, "policy", "report", "meeting", "agenda", "budget", "proposal", "draft", "minutes", "inspection", "circular", "revision", "guideline".
   KEY: The speaker is RECORDING or DESCRIBING information, not complaining. Mentions of infrastructure topics (water, roads, electricity) in the context of policy, planning, revision, or reporting should be classified as "document", NOT "issue".

IMPORTANT DISAMBIGUATION:
- "water supply policy needs revision" → document (policy discussion, not a complaint)
- "water supply nahi aa raha" → issue (personal complaint about lack of water)
- "road repair report for this week" → document (a report)
- "road has a pothole near my house" → issue (a complaint)
- "budget proposal for infrastructure" → document (formal record)
- "electricity nahi aa rahi 3 din se" → issue (complaint)

You MUST respond with ONLY a valid JSON object:
{
  "category": "<one of: question, issue, document>",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<one sentence explaining why>",
  "extracted_metadata": {
    "title": "<suggested title for the content>",
    "department": "<relevant department if identifiable, or null>",
    "ward": "<ward name/number if mentioned, or null>",
    "priority": "<Low/Medium/High if it's an issue, or null>",
    "citizen_name": "<citizen name if mentioned, or null>",
    "summary": "<2-3 sentence summary of the content>"
  }
}"""

# ── Keyword-based classifier (no LLM needed) ─────────────────────────

_QUESTION_KEYWORDS = {
    # English
    "what", "how", "when", "where", "why", "who", "which", "is there",
    "tell me", "show me", "can i", "do you", "status", "update",
    "progress", "information", "detail", "explain", "clarify",
    # Hindi / Hinglish
    "kya", "kaise", "kab", "kahan", "kaun", "kitne", "kitna", "kitni",
    "batao", "bataiye", "bataye", "dikhao", "kuch bata", "jaankari",
    "sthiti", "pata", "kya hai", "kya hua", "kyon", "kyun",
}

_ISSUE_KEYWORDS = {
    # English
    "problem", "broken", "complaint", "damage", "issue", "repair",
    "fix", "leak", "flood", "garbage", "sewage", "pothole", "collapse",
    "electricity", "power cut", "water supply", "not working", "failure",
    "blocked", "overflow", "dirty", "unsafe", "danger", "accident",
    "corruption", "delay", "negligence", "pending", "overdue",
    "grievance", "shikayat", "urgent", "emergency", "critical",
    # Hindi / Hinglish
    "samasya", "samasyaa", "samassya", "tuuta", "toota", "tuti",
    "kharab", "bigda", "shikayat", "nuqsan", "tamir", "paani nahi",
    "bijli nahi", "bijli", "sewer", "naali", "gandagi", "kachra",
    "khatarnak", "durghatna", "rishvat", "galat", "mushkil",
    "pareshani", "takleef", "taklif", "dikkat", "theek karo",
    "band hai", "nahi aa raha", "nahi chal raha", "toot gaya",
    "gir gaya", "beh raha", "bhara hua", "band padi", "jal bharav",
}

_DOCUMENT_KEYWORDS = {
    # English
    "minutes", "meeting", "resolution", "agenda", "proceedings",
    "circular", "notice", "order", "report", "memo", "memorandum",
    "policy", "guideline", "budget", "proposal", "tender", "contract",
    "summary", "transcript", "record", "notification", "gazette",
    # Hindi / Hinglish
    "baithak", "karyavahi", "nirdesh", "aadesh", "suchna",
    "prastaav", "niti", "vivaran", "lekha", "baitak", "sabha",
    "prativedan", "budget", "nibandh", "prastav",
}


def _keyword_classify(text: str) -> Dict[str, Any]:
    """
    Rule-based classification using keyword matching.
    Scores each category by counting matching keyword hits, normalised
    by category size so that no single large wordlist dominates.

    Returns the same schema as the LLM classifier.
    """
    lower = text.lower()
    has_question_mark = "?" in text

    q_hits = sum(1 for kw in _QUESTION_KEYWORDS if kw in lower)
    i_hits = sum(1 for kw in _ISSUE_KEYWORDS if kw in lower)
    d_hits = sum(1 for kw in _DOCUMENT_KEYWORDS if kw in lower)

    # Normalise by category size to get a proportion
    q_score = q_hits / len(_QUESTION_KEYWORDS) if _QUESTION_KEYWORDS else 0
    i_score = i_hits / len(_ISSUE_KEYWORDS) if _ISSUE_KEYWORDS else 0
    d_score = d_hits / len(_DOCUMENT_KEYWORDS) if _DOCUMENT_KEYWORDS else 0

    # Boost question score if text contains a question mark
    if has_question_mark:
        q_score += 0.15

    total = q_score + i_score + d_score
    if total == 0:
        return {
            "category": "document",
            "confidence": 0.4,
            "reasoning": "Keyword fallback: no strong keyword signals — defaulting to document",
            "extracted_metadata": {"title": text[:80], "summary": text[:200]},
        }

    scores = {"question": q_score, "issue": i_score, "document": d_score}
    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    conf = round(scores[best] / total, 2)  # proportion of winning category

    return {
        "category": best,
        "confidence": min(conf, 0.85),  # cap at 0.85 for keyword-only
        "reasoning": f"Keyword fallback: matched {q_hits} question / {i_hits} issue / {d_hits} document keywords",
        "extracted_metadata": {"title": text[:80], "summary": text[:200]},
    }


def classify_text(transcript: str) -> Dict[str, Any]:
    """
    Classify transcribed text into question/issue/document.

    Strategy:
      1. If LLM (Groq) is available → use LLM.
         - If LLM confidence < 0.65 → also run keyword classifier and
           prefer whichever has higher confidence.
      2. If no GROQ_API_KEY or LLM call fails → keyword classifier only.

    Returns:
        {
            "category": "question" | "issue" | "document",
            "confidence": float,
            "reasoning": str,
            "extracted_metadata": {...}
        }
    """
    # Always compute keyword result (cheap)
    kw_result = _keyword_classify(transcript)

    if not settings.GROQ_API_KEY:
        kw_result["reasoning"] = "Keyword classifier (no LLM key): " + kw_result["reasoning"]
        return kw_result

    try:
        from groq import Groq
        import json

        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": _CLASSIFY_SYSTEM_PROMPT},
                {"role": "user", "content": f"Classify this text:\n\n{transcript[:3000]}"},
            ],
            temperature=0.1,
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        parsed = json.loads(raw)
        llm_result = {
            "category": parsed["category"],
            "confidence": float(parsed.get("confidence", 0.8)),
            "reasoning": parsed.get("reasoning", "Classified by LLM"),
            "extracted_metadata": parsed.get("extracted_metadata", {}),
        }

        # Cross-validate: if LLM confidence is low, prefer keyword if it's higher
        if llm_result["confidence"] < 0.65 and kw_result["confidence"] > llm_result["confidence"]:
            kw_result["reasoning"] = (
                f"Keyword override (LLM was low-confidence {llm_result['confidence']:.0%} "
                f"'{llm_result['category']}'): {kw_result['reasoning']}"
            )
            # Keep LLM metadata if richer
            if llm_result["extracted_metadata"]:
                kw_result["extracted_metadata"] = llm_result["extracted_metadata"]
            return kw_result

        # Annotate LLM result with keyword agreement/disagreement
        if llm_result["category"] == kw_result["category"]:
            llm_result["reasoning"] += f" [keyword classifier agrees — {kw_result['reasoning']}]"
        else:
            llm_result["reasoning"] += (
                f" [keyword classifier disagrees: '{kw_result['category']}' "
                f"at {kw_result['confidence']:.0%} — {kw_result['reasoning']}]"
            )

        return llm_result

    except Exception as exc:
        logger.warning("LLM classification failed: %s — using keyword fallback", exc)
        kw_result["reasoning"] = f"Keyword fallback (LLM error: {str(exc)[:80]}): " + kw_result["reasoning"]
        return kw_result


# ═══════════════════════════════════════════════════════════════════
# Intelligence: LLM-based Text Summarization
# ═══════════════════════════════════════════════════════════════════

_SUMMARIZE_SYSTEM_PROMPT = """You are an AI summarizer for the NAYAM municipal governance platform.

Given text (which may be transcribed speech in any Indian language), produce a structured summary.

Respond with ONLY a valid JSON object:
{
  "summary": "<3-5 sentence executive summary>",
  "key_points": ["<point 1>", "<point 2>", ...],
  "action_items": ["<action 1>", "<action 2>", ...],
  "departments_mentioned": ["<dept 1>", ...],
  "language_detected": "<language of the input text>"
}"""


def summarize_text(text: str) -> Dict[str, Any]:
    """
    Summarize text using Groq LLM. Designed for meeting transcripts,
    field reports, and long voice recordings.

    Returns:
        {
            "summary": str,
            "key_points": [...],
            "action_items": [...],
            "departments_mentioned": [...],
            "language_detected": str
        }
    """
    if not settings.GROQ_API_KEY:
        return {
            "summary": text[:500],
            "key_points": [],
            "action_items": [],
            "departments_mentioned": [],
            "language_detected": "unknown",
        }

    try:
        from groq import Groq
        import json

        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": _SUMMARIZE_SYSTEM_PROMPT},
                {"role": "user", "content": f"Summarize this text:\n\n{text[:6000]}"},
            ],
            temperature=0.2,
            max_tokens=1000,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        return json.loads(raw)
    except Exception as exc:
        logger.warning("LLM summarization failed: %s", exc)
        return {
            "summary": text[:500],
            "key_points": [],
            "action_items": [],
            "departments_mentioned": [],
            "language_detected": "unknown",
            "error": str(exc)[:200],
        }


# ═══════════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════════

def check_bhashini_health() -> Dict[str, Any]:
    """
    Verify Bhashini Dhruva API connectivity by making a lightweight
    translation call.

    Returns:
        {"available": True/False, "detail": "..."}
    """
    if not settings.BHASHINI_API_KEY:
        return {
            "available": False,
            "detail": "Bhashini API key not configured (BHASHINI_API_KEY missing in .env)",
        }

    try:
        result = translate_text(
            text="health check",
            source_language="en",
            target_language="hi",
        )
        has_output = bool(result.get("translated_text"))
        return {
            "available": has_output,
            "detail": (
                "Bhashini Dhruva API operational"
                if has_output
                else "Bhashini Dhruva returned empty translation"
            ),
        }
    except Exception as exc:
        return {
            "available": False,
            "detail": f"Bhashini Dhruva connectivity error: {exc}",
        }
