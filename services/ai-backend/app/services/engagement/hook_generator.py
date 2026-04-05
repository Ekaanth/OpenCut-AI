"""A/B hook generator — creates multiple hook variants for a single clip.

For any clip, generates 3-5 alternative hooks by:
- Starting at different points in the transcript
- Generating different text overlay options via LLM
- Suggesting different visual treatments (zoom, static, face close-up)

Creators can preview each variant and pick the strongest one.
"""

import asyncio
import logging
from typing import Any

from app.services.model_backend import llm_backend
from app.services.engagement.hook_analyzer import hook_analyzer

logger = logging.getLogger(__name__)


class HookVariant:
    def __init__(
        self,
        variant_id: int,
        hook_type: str,
        start_offset: float,
        text_overlay: str,
        visual_style: str,
        estimated_hook_score: float,
        reason: str = "",
    ):
        self.variant_id = variant_id
        self.hook_type = hook_type
        self.start_offset = start_offset
        self.text_overlay = text_overlay
        self.visual_style = visual_style
        self.estimated_hook_score = estimated_hook_score
        self.reason = reason

    def to_dict(self) -> dict:
        return {
            "variant_id": self.variant_id,
            "hook_type": self.hook_type,
            "start_offset": self.start_offset,
            "text_overlay": self.text_overlay,
            "visual_style": self.visual_style,
            "estimated_hook_score": self.estimated_hook_score,
            "reason": self.reason,
        }


class HookGenerator:
    """Generate multiple hook variants for A/B testing."""

    async def generate_variants(
        self,
        transcript_text: str,
        clip_start: float,
        clip_end: float,
        transcript_segments: list[dict] | None = None,
        max_variants: int = 5,
    ) -> list[HookVariant]:
        """Generate hook variants using LLM + rule-based approaches."""
        variants = []

        # Variant 1: Original start (baseline)
        original_hook = transcript_text[:100].strip()
        if original_hook:
            variants.append(HookVariant(
                variant_id=0,
                hook_type="original",
                start_offset=0,
                text_overlay="",
                visual_style="default",
                estimated_hook_score=50,
                reason="Original clip start",
            ))

        # Generate LLM-based hook text variants
        llm_variants = await self._generate_llm_hooks(transcript_text, max_variants - 1)
        for i, lv in enumerate(llm_variants):
            variants.append(HookVariant(
                variant_id=i + 1,
                hook_type=lv.get("type", "text_overlay"),
                start_offset=lv.get("start_offset", 0),
                text_overlay=lv.get("text", ""),
                visual_style=lv.get("visual", "zoom_in"),
                estimated_hook_score=lv.get("score", 60),
                reason=lv.get("reason", ""),
            ))

        # Find alternative start points from transcript segments
        if transcript_segments:
            alt_starts = self._find_alternative_starts(
                transcript_segments, clip_start, clip_end,
            )
            for j, alt in enumerate(alt_starts[:2]):
                if len(variants) >= max_variants:
                    break
                variants.append(HookVariant(
                    variant_id=len(variants),
                    hook_type="alternate_start",
                    start_offset=alt["offset"],
                    text_overlay="",
                    visual_style="default",
                    estimated_hook_score=alt.get("score", 55),
                    reason=f"Start at: \"{alt['text'][:50]}...\"",
                ))

        return variants[:max_variants]

    async def _generate_llm_hooks(self, transcript_text: str, count: int) -> list[dict]:
        """Use LLM to generate hook text overlays."""
        try:
            available = await llm_backend.check_available()
            if not available:
                return self._fallback_hooks(transcript_text, count)

            prompt = f"""You are a viral content expert. Generate {count} different hook text overlays for this video clip. Each hook should be under 8 words and designed to stop someone mid-scroll.

Transcript: "{transcript_text[:500]}"

For each hook, provide a different approach:
1. Bold statement hook
2. Question hook
3. Proof/number hook
4. Pattern interrupt hook

Respond with JSON: {{"hooks": [{{"text": "hook text", "type": "bold_statement|question|proof|pattern_interrupt", "visual": "zoom_in|face_closeup|text_flash|static", "score": 0-100, "reason": "why this works"}}]}}"""

            data = await llm_backend.generate_json(prompt=prompt)
            hooks = data.get("hooks", [])

            return [
                {
                    "text": str(h.get("text", ""))[:60],
                    "type": str(h.get("type", "text_overlay")),
                    "visual": str(h.get("visual", "zoom_in")),
                    "score": max(0, min(100, int(h.get("score", 60)))),
                    "reason": str(h.get("reason", "")),
                    "start_offset": 0,
                }
                for h in hooks[:count]
            ]

        except Exception:
            logger.debug("LLM hook generation failed", exc_info=True)
            return self._fallback_hooks(transcript_text, count)

    def _fallback_hooks(self, transcript_text: str, count: int) -> list[dict]:
        """Rule-based hook generation when LLM unavailable."""
        hooks = []
        text = transcript_text.strip()

        # Question variant
        if text and not text.startswith("?"):
            hooks.append({
                "text": f"Did you know? {text.split('.')[0][:40]}...",
                "type": "question",
                "visual": "text_flash",
                "score": 55,
                "reason": "Question creates curiosity gap",
                "start_offset": 0,
            })

        # Bold statement
        hooks.append({
            "text": "Watch this...",
            "type": "pattern_interrupt",
            "visual": "zoom_in",
            "score": 50,
            "reason": "Simple pattern interrupt",
            "start_offset": 0,
        })

        return hooks[:count]

    def _find_alternative_starts(
        self,
        segments: list[dict],
        clip_start: float,
        clip_end: float,
    ) -> list[dict]:
        """Find compelling alternative start points in nearby segments."""
        candidates = []
        search_window = 10.0  # look 10s before/after clip start

        for seg in segments:
            seg_start = seg.get("start", 0)
            text = seg.get("text", "").strip().lower()

            # Only consider segments near the clip start
            if abs(seg_start - clip_start) > search_window:
                continue
            if seg_start == clip_start:
                continue

            offset = seg_start - clip_start
            score = 50

            # Boost for questions
            if "?" in text:
                score += 15
            # Boost for strong starts
            if any(w in text[:30] for w in ["but", "however", "actually", "here's", "the truth"]):
                score += 10
            # Boost for numbers
            if any(c.isdigit() for c in text[:20]):
                score += 5

            candidates.append({
                "offset": round(offset, 2),
                "text": seg.get("text", ""),
                "score": score,
            })

        candidates.sort(key=lambda c: c["score"], reverse=True)
        return candidates


class AdaptivePacingEngine:
    """Analyze content pacing and suggest speed adjustments.

    Research: retention drops at predictable pacing. Introducing variation
    (faster cuts during high energy, slower during emotional moments)
    maintains the variable reward schedule within a single video.
    """

    async def analyze_pacing(
        self,
        energy_envelope: list[float],
        duration: float,
        resolution_hz: float = 10,
    ) -> dict:
        """Analyze pacing and suggest speed adjustments per segment."""
        if not energy_envelope or duration <= 0:
            return {"segments": [], "overall_pace": "neutral", "suggestions": []}

        # Divide into segments (~5 seconds each)
        segment_duration = 5.0
        samples_per_segment = int(segment_duration * resolution_hz)
        segments = []

        for i in range(0, len(energy_envelope), samples_per_segment):
            chunk = energy_envelope[i : i + samples_per_segment]
            if not chunk:
                break

            avg_energy = sum(chunk) / len(chunk)
            start_time = i / resolution_hz
            end_time = min((i + samples_per_segment) / resolution_hz, duration)

            # Determine suggested speed
            if avg_energy > 0.7:
                speed = 1.0  # high energy: normal speed (already engaging)
                pace_label = "high_energy"
            elif avg_energy > 0.4:
                speed = 1.0  # medium: keep normal
                pace_label = "medium"
            elif avg_energy > 0.15:
                speed = 1.05  # low-medium: slightly faster to maintain interest
                pace_label = "slow"
            else:
                speed = 1.15  # very low: speed up dead air
                pace_label = "dead_air"

            segments.append({
                "start": round(start_time, 2),
                "end": round(end_time, 2),
                "avg_energy": round(avg_energy, 3),
                "pace_label": pace_label,
                "suggested_speed": speed,
            })

        # Overall analysis
        all_energies = [s["avg_energy"] for s in segments]
        avg_overall = sum(all_energies) / len(all_energies) if all_energies else 0
        energy_variance = sum((e - avg_overall) ** 2 for e in all_energies) / len(all_energies) if all_energies else 0

        if energy_variance > 0.05:
            overall_pace = "dynamic"
        elif avg_overall > 0.5:
            overall_pace = "high_energy"
        elif avg_overall > 0.2:
            overall_pace = "moderate"
        else:
            overall_pace = "slow"

        suggestions = []
        dead_air_segments = [s for s in segments if s["pace_label"] == "dead_air"]
        if dead_air_segments:
            suggestions.append(
                f"Found {len(dead_air_segments)} low-energy segments. Consider cutting or speeding up."
            )
        if energy_variance < 0.01:
            suggestions.append(
                "Pacing is very flat. Add visual variety (cuts, zooms) to maintain attention."
            )

        return {
            "segments": segments,
            "overall_pace": overall_pace,
            "average_energy": round(avg_overall, 3),
            "energy_variance": round(energy_variance, 5),
            "suggestions": suggestions,
        }


# Module-level singletons
hook_generator = HookGenerator()
adaptive_pacing = AdaptivePacingEngine()
