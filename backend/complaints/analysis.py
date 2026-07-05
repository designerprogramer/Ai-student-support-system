import json
import os
import re
from dataclasses import asdict, dataclass
from typing import Iterable
from urllib import error, request


LANGUAGE_ENGLISH = "english"
LANGUAGE_SOMALI = "somali"
LANGUAGE_MIXED = "mixed"

SENTIMENT_NEGATIVE = "negative"
SENTIMENT_NEUTRAL = "neutral"
SENTIMENT_POSITIVE = "positive"

PRIORITY_LOW = "Low"
PRIORITY_MEDIUM = "Medium"
PRIORITY_HIGH = "High"
PRIORITY_CRITICAL = "Critical"

URGENCY_LOW = "low"
URGENCY_MEDIUM = "medium"
URGENCY_HIGH = "high"
URGENCY_CRITICAL = "critical"

MODEL_VERSION = "heuristic-v1"

SOMALI_MARKERS = {
    "ayaa",
    "waxaan",
    "waan",
    "ma",
    "iyo",
    "lacag",
    "iga",
    "jaray",
    "diiwaangelin",
    "imtixaan",
    "natiijo",
    "muuqdaan",
    "arki",
    "karo",
    "xisaab",
    "arday",
    "portal",
}

ENGLISH_MARKERS = {
    "the",
    "is",
    "are",
    "and",
    "payment",
    "registration",
    "failed",
    "exam",
    "marks",
    "deadline",
    "cannot",
    "issue",
    "problem",
    "error",
    "support",
}

SOMALI_TRANSLATIONS = {
    "lacag la iga jaray": "money was deducted from my account",
    "registration failed": "registration failed",
    "exam ma arki karo": "i cannot see the exam",
    "marks ma muuqdaan": "marks are not visible",
    "diiwaangelin": "registration",
    "imtixaan": "exam",
    "natiijo": "results",
    "lacag": "money",
    "jaray": "deducted",
    "ma arki karo": "cannot see",
    "ma muuqdaan": "not visible",
    "arday": "student",
}

URGENT_KEYWORDS = {
    "lacag la iga jaray",
    "registration failed",
    "exam ma arki karo",
    "marks ma muuqdaan",
    "deadline",
    "urgent",
    "immediately",
    "asap",
    "final warning",
    "locked out",
    "suspension",
    "expelled",
}

CRITICAL_KEYWORDS = {
    "exam today",
    "deadline today",
    "final warning",
    "immediately",
    "suspension",
    "expelled",
    "system down",
}

NEGATIVE_WORDS = {
    "failed",
    "error",
    "issue",
    "problem",
    "urgent",
    "deducted",
    "missing",
    "cannot",
    "can't",
    "stuck",
    "delay",
    "late",
    "broken",
    "ma",
    "jaray",
    "muuqdaan",
}

POSITIVE_WORDS = {
    "resolved",
    "thanks",
    "thank you",
    "working",
    "fixed",
    "appreciate",
}

CATEGORY_KEYWORDS = {
    "Finance": {
        "finance",
        "fee",
        "fees",
        "payment",
        "bursary",
        "refund",
        "deducted",
        "invoice",
        "stipend",
        "money",
        "lacag",
    },
    "Academics": {
        "exam",
        "marks",
        "grade",
        "registration",
        "course",
        "transcript",
        "class",
        "diiwaangelin",
        "imtixaan",
        "natiijo",
    },
    "Housing": {
        "hostel",
        "dorm",
        "room",
        "accommodation",
        "water",
        "bed",
    },
    "IT Services": {
        "portal",
        "login",
        "system",
        "wifi",
        "internet",
        "password",
        "website",
        "app",
        "error code",
    },
    "Faculty": {
        "lecturer",
        "professor",
        "teacher",
        "supervisor",
        "faculty",
        "grading",
        "attendance",
    },
    "Facilities": {
        "library",
        "lab",
        "classroom",
        "electricity",
        "sanitation",
        "building",
        "security",
    },
    "Other": set(),
}

CATEGORY_WEIGHTS = {
    "Finance": 0.18,
    "Academics": 0.2,
    "IT Services": 0.18,
    "Housing": 0.12,
    "Faculty": 0.1,
    "Facilities": 0.08,
    "Other": 0.05,
}

DOCUMENT_MIME_HINTS = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@dataclass
class AttachmentContext:
    name: str
    mime_type: str
    size_bytes: int


@dataclass
class ComplaintAnalysisResult:
    original_text: str
    translated_text: str
    detected_language: str
    sentiment: str
    urgency: str
    confidence_score: float
    auto_priority: str
    suggested_category: str
    model_version: str
    matched_keywords: list[str]
    attachment_count: int

    def to_raw_output(self) -> dict:
        payload = asdict(self)
        payload["confidence_score"] = round(float(payload["confidence_score"]), 4)
        return payload


def analyze_complaint(
    title: str,
    description: str,
    submitted_category: str | None,
    attachments: Iterable[AttachmentContext] | None = None,
) -> ComplaintAnalysisResult:
    attachments = list(attachments or [])
    original_text = " ".join(part.strip() for part in [title or "", description or ""] if part and part.strip()).strip()

    heuristic_result = _heuristic_analyze(original_text, submitted_category, attachments)
    llm_result = _llm_analyze(original_text, submitted_category, attachments)
    if not llm_result:
        return heuristic_result

    merged = _merge_results(heuristic_result, llm_result)
    return merged


def _heuristic_analyze(
    original_text: str,
    submitted_category: str | None,
    attachments: list[AttachmentContext],
) -> ComplaintAnalysisResult:
    detected_language = _detect_language(original_text)
    translated_text = _translate_to_english(original_text, detected_language)
    normalized_text = _normalize_text(translated_text or original_text)

    keyword_hits = _match_keywords(normalized_text, URGENT_KEYWORDS)
    critical_hits = _match_keywords(normalized_text, CRITICAL_KEYWORDS)

    sentiment, sentiment_strength = _detect_sentiment(normalized_text)
    urgency, urgency_score = _detect_urgency(
        normalized_text=normalized_text,
        sentiment=sentiment,
        sentiment_strength=sentiment_strength,
        urgent_hits=keyword_hits,
        critical_hits=critical_hits,
        attachments=attachments,
    )
    suggested_category = _suggest_category(normalized_text, submitted_category)
    auto_priority, confidence_score = _compute_priority(
        normalized_text=normalized_text,
        sentiment=sentiment,
        sentiment_strength=sentiment_strength,
        urgency=urgency,
        urgency_score=urgency_score,
        suggested_category=suggested_category,
        urgent_hits=keyword_hits,
        critical_hits=critical_hits,
        attachments=attachments,
        detected_language=detected_language,
    )

    matched_keywords = sorted(set(keyword_hits + critical_hits))
    return ComplaintAnalysisResult(
        original_text=original_text,
        translated_text=translated_text,
        detected_language=detected_language,
        sentiment=sentiment,
        urgency=urgency,
        confidence_score=confidence_score,
        auto_priority=auto_priority,
        suggested_category=suggested_category,
        model_version=MODEL_VERSION,
        matched_keywords=matched_keywords,
        attachment_count=len(attachments),
    )


def _merge_results(
    heuristic_result: ComplaintAnalysisResult,
    llm_payload: dict,
) -> ComplaintAnalysisResult:
    detected_language = _normalize_language(llm_payload.get("detected_language")) or heuristic_result.detected_language
    translated_text = _clean_text(llm_payload.get("translated_text")) or heuristic_result.translated_text
    sentiment = _normalize_sentiment(llm_payload.get("sentiment")) or heuristic_result.sentiment
    urgency = _normalize_urgency(llm_payload.get("urgency")) or heuristic_result.urgency
    auto_priority = _normalize_priority(llm_payload.get("auto_priority")) or heuristic_result.auto_priority
    suggested_category = _normalize_category_name(llm_payload.get("suggested_category")) or heuristic_result.suggested_category

    confidence_score = _safe_float(llm_payload.get("confidence_score"), heuristic_result.confidence_score)
    confidence_score = max(0.0, min(1.0, confidence_score))

    matched_keywords = llm_payload.get("matched_keywords")
    if not isinstance(matched_keywords, list):
        matched_keywords = heuristic_result.matched_keywords
    else:
        matched_keywords = [str(keyword).strip() for keyword in matched_keywords if str(keyword).strip()]
        if not matched_keywords:
            matched_keywords = heuristic_result.matched_keywords

    model_version = _clean_text(llm_payload.get("model_version")) or "openai-triage-v1"

    return ComplaintAnalysisResult(
        original_text=heuristic_result.original_text,
        translated_text=translated_text,
        detected_language=detected_language,
        sentiment=sentiment,
        urgency=urgency,
        confidence_score=round(confidence_score, 4),
        auto_priority=auto_priority,
        suggested_category=suggested_category,
        model_version=model_version,
        matched_keywords=matched_keywords,
        attachment_count=heuristic_result.attachment_count,
    )


def _llm_analyze(
    original_text: str,
    submitted_category: str | None,
    attachments: list[AttachmentContext],
) -> dict | None:
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        return None

    if not original_text:
        return None

    model = (os.getenv("OPENAI_COMPLAINT_MODEL") or "gpt-4.1-mini").strip()
    attachment_summary = [
        {
            "name": item.name,
            "mime_type": item.mime_type,
            "size_bytes": item.size_bytes,
        }
        for item in attachments
    ]

    system_prompt = (
        "You are a complaint triage assistant for a university support system. "
        "Detect language (english/somali/mixed), translate Somali or mixed text to English, "
        "classify sentiment (positive/neutral/negative), urgency (low/medium/high/critical), "
        "suggested category (Finance, Academics, Housing, IT Services, Faculty, Facilities, Other), "
        "and auto priority (Low, Medium, High, Critical). Return strict JSON only."
    )
    user_payload = {
        "title_and_description": original_text,
        "submitted_category": submitted_category,
        "attachment_summary": attachment_summary,
    }

    payload = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Analyze this complaint and return JSON with keys: "
                    "detected_language, translated_text, sentiment, urgency, suggested_category, "
                    "auto_priority, confidence_score, matched_keywords, model_version.\n"
                    f"Complaint payload: {json.dumps(user_payload, ensure_ascii=True)}"
                ),
            },
        ],
    }

    req = request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=12) as response:
            body = response.read().decode("utf-8")
            parsed = json.loads(body)
            content = (
                parsed.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if not content:
                return None
            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") if isinstance(part, dict) else str(part)
                    for part in content
                )
            return json.loads(content)
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        return None


def _detect_language(text: str) -> str:
    normalized = _normalize_text(text)
    if not normalized:
        return LANGUAGE_ENGLISH

    tokens = re.findall(r"[a-z']+", normalized)
    if not tokens:
        return LANGUAGE_ENGLISH

    somali_hits = sum(1 for token in tokens if token in SOMALI_MARKERS)
    english_hits = sum(1 for token in tokens if token in ENGLISH_MARKERS)

    if any(phrase in normalized for phrase in ("lacag la iga jaray", "exam ma arki karo", "marks ma muuqdaan")):
        somali_hits += 3
    if "registration failed" in normalized:
        english_hits += 2

    if somali_hits >= 2 and english_hits >= 2:
        return LANGUAGE_MIXED
    if somali_hits > english_hits:
        return LANGUAGE_SOMALI
    return LANGUAGE_ENGLISH


def _translate_to_english(text: str, detected_language: str) -> str:
    cleaned = _clean_text(text)
    if detected_language == LANGUAGE_ENGLISH or not cleaned:
        return cleaned

    translated = f"translated to english: {cleaned.lower()}"
    for source, target in sorted(SOMALI_TRANSLATIONS.items(), key=lambda item: len(item[0]), reverse=True):
        translated = translated.replace(source, target)
    return translated


def _detect_sentiment(normalized_text: str) -> tuple[str, float]:
    if not normalized_text:
        return SENTIMENT_NEUTRAL, 0.0

    negative_hits = _count_keyword_hits(normalized_text, NEGATIVE_WORDS)
    positive_hits = _count_keyword_hits(normalized_text, POSITIVE_WORDS)

    score = (negative_hits * 1.25) - positive_hits
    if score >= 2:
        return SENTIMENT_NEGATIVE, min(1.0, 0.35 + (score * 0.1))
    if score <= -1:
        return SENTIMENT_POSITIVE, min(1.0, 0.4 + (abs(score) * 0.1))
    return SENTIMENT_NEUTRAL, 0.3


def _detect_urgency(
    normalized_text: str,
    sentiment: str,
    sentiment_strength: float,
    urgent_hits: list[str],
    critical_hits: list[str],
    attachments: list[AttachmentContext],
) -> tuple[str, float]:
    score = 0.1
    score += min(0.4, len(urgent_hits) * 0.12)
    score += min(0.45, len(critical_hits) * 0.2)

    if any(token in normalized_text for token in ("today", "now", "deadline", "asap", "urgent")):
        score += 0.18
    if sentiment == SENTIMENT_NEGATIVE:
        score += 0.18 + (0.1 * sentiment_strength)
    if attachments:
        score += 0.08
        if len(attachments) >= 3:
            score += 0.05

    score = min(1.0, score)
    if score >= 0.82:
        return URGENCY_CRITICAL, score
    if score >= 0.62:
        return URGENCY_HIGH, score
    if score >= 0.35:
        return URGENCY_MEDIUM, score
    return URGENCY_LOW, score


def _suggest_category(normalized_text: str, submitted_category: str | None) -> str:
    scores: dict[str, int] = {name: 0 for name in CATEGORY_KEYWORDS}
    for category_name, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in normalized_text:
                scores[category_name] += 1

    best_category = max(scores, key=scores.get)
    if scores.get(best_category, 0) == 0:
        return _normalize_category_name(submitted_category) or "Other"

    if submitted_category:
        normalized_submitted = _normalize_category_name(submitted_category)
        if normalized_submitted and scores.get(normalized_submitted, 0) == scores.get(best_category, 0):
            return normalized_submitted
    return best_category


def _compute_priority(
    normalized_text: str,
    sentiment: str,
    sentiment_strength: float,
    urgency: str,
    urgency_score: float,
    suggested_category: str,
    urgent_hits: list[str],
    critical_hits: list[str],
    attachments: list[AttachmentContext],
    detected_language: str,
) -> tuple[str, float]:
    severity = 0.08
    confidence = 0.45

    if sentiment == SENTIMENT_NEGATIVE:
        severity += 0.2 + min(0.2, sentiment_strength * 0.2)
        confidence += 0.08
    elif sentiment == SENTIMENT_POSITIVE:
        severity -= 0.05

    urgency_modifier = {
        URGENCY_LOW: 0.08,
        URGENCY_MEDIUM: 0.2,
        URGENCY_HIGH: 0.35,
        URGENCY_CRITICAL: 0.52,
    }
    severity += urgency_modifier.get(urgency, 0.1)
    severity += min(0.25, len(urgent_hits) * 0.08)
    severity += min(0.3, len(critical_hits) * 0.13)
    confidence += min(0.2, (len(urgent_hits) + len(critical_hits)) * 0.04)

    severity += CATEGORY_WEIGHTS.get(suggested_category, 0.05)
    confidence += min(0.1, CATEGORY_WEIGHTS.get(suggested_category, 0.05))

    if attachments:
        severity += 0.08
        confidence += 0.05
        if _has_document_attachment(attachments):
            severity += 0.06
            confidence += 0.04
        if len(attachments) >= 3:
            severity += 0.05
            confidence += 0.04

    if "deadline" in normalized_text:
        severity += 0.08

    if detected_language == LANGUAGE_MIXED:
        confidence -= 0.03

    severity = max(0.0, min(1.0, severity))
    confidence = max(0.2, min(0.99, confidence + (urgency_score * 0.08)))

    if severity >= 0.82:
        return PRIORITY_CRITICAL, round(confidence, 4)
    if severity >= 0.58:
        return PRIORITY_HIGH, round(confidence, 4)
    if severity >= 0.33:
        return PRIORITY_MEDIUM, round(confidence, 4)
    return PRIORITY_LOW, round(confidence, 4)


def _has_document_attachment(attachments: list[AttachmentContext]) -> bool:
    for attachment in attachments:
        mime_type = (attachment.mime_type or "").lower()
        if mime_type in DOCUMENT_MIME_HINTS:
            return True
        if attachment.name.lower().endswith((".pdf", ".doc", ".docx")):
            return True
    return False


def _match_keywords(normalized_text: str, keywords: set[str]) -> list[str]:
    matches = []
    for keyword in keywords:
        if keyword in normalized_text:
            matches.append(keyword)
    return matches


def _count_keyword_hits(normalized_text: str, keywords: set[str]) -> int:
    total = 0
    for keyword in keywords:
        if keyword in normalized_text:
            total += 1
    return total


def _normalize_priority(value: str | None) -> str | None:
    text = _clean_text(value).lower()
    if text in {"low", "l"}:
        return PRIORITY_LOW
    if text in {"medium", "med"}:
        return PRIORITY_MEDIUM
    if text in {"high", "h"}:
        return PRIORITY_HIGH
    if text in {"critical", "crit"}:
        return PRIORITY_CRITICAL
    return None


def _normalize_sentiment(value: str | None) -> str | None:
    text = _clean_text(value).lower()
    if text in {SENTIMENT_NEGATIVE, "negative"}:
        return SENTIMENT_NEGATIVE
    if text in {SENTIMENT_NEUTRAL, "neutral"}:
        return SENTIMENT_NEUTRAL
    if text in {SENTIMENT_POSITIVE, "positive"}:
        return SENTIMENT_POSITIVE
    return None


def _normalize_language(value: str | None) -> str | None:
    text = _clean_text(value).lower()
    if text in {"english", "en"}:
        return LANGUAGE_ENGLISH
    if text in {"somali", "so"}:
        return LANGUAGE_SOMALI
    if text in {"mixed", "mix", "somali-english", "english-somali"}:
        return LANGUAGE_MIXED
    return None


def _normalize_urgency(value: str | None) -> str | None:
    text = _clean_text(value).lower()
    if text in {URGENCY_LOW, "l"}:
        return URGENCY_LOW
    if text in {URGENCY_MEDIUM, "med"}:
        return URGENCY_MEDIUM
    if text in {URGENCY_HIGH, "h"}:
        return URGENCY_HIGH
    if text in {URGENCY_CRITICAL, "crit"}:
        return URGENCY_CRITICAL
    return None


def _normalize_category_name(value: str | None) -> str | None:
    cleaned = _clean_text(value)
    if not cleaned:
        return None
    lowered = cleaned.lower()
    for category_name in CATEGORY_KEYWORDS:
        if category_name.lower() == lowered:
            return category_name
    return cleaned


def _safe_float(value, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_text(value: str | None) -> str:
    cleaned = _clean_text(value).lower()
    return re.sub(r"\s+", " ", cleaned).strip()


def _clean_text(value: str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()
