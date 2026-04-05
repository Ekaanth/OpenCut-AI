"""Topic boundary detection via LLM.

Identifies natural topic transitions in a transcript to ensure clips
don't cross topic boundaries. Also used for chapter detection.
"""

import logging
from typing import Any

from app.services.model_backend import llm_backend

logger = logging.getLogger(__name__)


class TopicBoundary:
    def __init__(self, timestamp: float, topic_label: str, summary: str = ""):
        self.timestamp = timestamp
        self.topic_label = topic_label
        self.summary = summary

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "topic_label": self.topic_label,
            "summary": self.summary,
        }


class TopicDetector:
    """Detect natural topic transitions in a transcript."""

    async def detect_boundaries(
        self,
        segments: list[dict],
        max_topics: int = 20,
    ) -> list[TopicBoundary]:
        """Find topic shift points in the transcript."""
        if not segments:
            return []

        available = await llm_backend.check_available()
        if not available:
            return self._fallback_silence_based(segments)

        # Build compact transcript
        lines = []
        for seg in segments:
            lines.append(f"[{seg.get('start', 0):.0f}s] {seg.get('text', '')}")

        full_text = "\n".join(lines)

        # Chunk if too long
        max_chars = 10000
        chunks = [full_text[i:i + max_chars] for i in range(0, len(full_text), max_chars)]

        all_boundaries = []

        for chunk_idx, chunk in enumerate(chunks):
            prompt = f"""Analyze this transcript and identify the major topic transitions. Return the timestamp where each new topic begins.

Transcript (part {chunk_idx + 1}/{len(chunks)}):
{chunk}

Respond with JSON: {{"topics": [{{"timestamp": float, "label": "short topic name", "summary": "1-sentence summary"}}]}}

Return at most {max_topics} topic boundaries. Only include clear topic shifts, not minor tangents."""

            try:
                data = await llm_backend.generate_json(prompt=prompt)
                topics = data.get("topics", [])
                for t in topics:
                    all_boundaries.append(TopicBoundary(
                        timestamp=float(t.get("timestamp", 0)),
                        topic_label=str(t.get("label", "Unknown")),
                        summary=str(t.get("summary", "")),
                    ))
            except Exception as e:
                logger.warning("Topic detection failed for chunk %d: %s", chunk_idx, e)

        # Deduplicate boundaries that are too close
        all_boundaries.sort(key=lambda b: b.timestamp)
        deduped = []
        for b in all_boundaries:
            if not deduped or b.timestamp - deduped[-1].timestamp > 30:
                deduped.append(b)

        return deduped[:max_topics]

    def _fallback_silence_based(self, segments: list[dict]) -> list[TopicBoundary]:
        """Fallback: detect topic boundaries at long silences (>3s gaps)."""
        boundaries = []
        prev_end = 0

        for seg in segments:
            start = seg.get("start", 0)
            if start - prev_end > 3.0 and prev_end > 0:
                boundaries.append(TopicBoundary(
                    timestamp=start,
                    topic_label=f"Segment at {int(start)}s",
                    summary=seg.get("text", "")[:100],
                ))
            prev_end = seg.get("end", start)

        return boundaries


# Module-level singleton
topic_detector = TopicDetector()
