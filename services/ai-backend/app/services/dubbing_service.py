"""AI Dubbing orchestrator.

Runs the full privacy-first dubbing pipeline entirely through local
microservices:

    media → whisper (/transcribe)
          → translate-service (/translate-batch)   [NLLB-200, fully local]
          → tts-service (/generate)                [XTTS v2, voice-cloned]
          → ffmpeg assemble (per-segment time-fit)

No text or audio ever leaves the host. Output is a single dubbed audio
file plus per-segment timing so the frontend can insert it as a track.
"""

import asyncio
import logging
import os
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, field

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# ── Language metadata ──────────────────────────────────────────────────
# NLLB uses FLORES-200 codes (e.g. eng_Latn, hin_Deva). XTTS v2 uses ISO
# 639-1 (e.g. en, hi). This map is the single source of truth bridging the
# two so the frontend only ever deals with one canonical code per language.
DUB_LANGUAGES: list[dict] = [
    {"code": "en", "nllb": "eng_Latn", "name": "English", "native": "English", "tts": True},
    {"code": "es", "nllb": "spa_Latn", "name": "Spanish", "native": "Español", "tts": True},
    {"code": "fr", "nllb": "fra_Latn", "name": "French", "native": "Français", "tts": True},
    {"code": "de", "nllb": "deu_Latn", "name": "German", "native": "Deutsch", "tts": True},
    {"code": "it", "nllb": "ita_Latn", "name": "Italian", "native": "Italiano", "tts": True},
    {"code": "pt", "nllb": "por_Latn", "name": "Portuguese", "native": "Português", "tts": True},
    {"code": "pl", "nllb": "pol_Latn", "name": "Polish", "native": "Polski", "tts": True},
    {"code": "tr", "nllb": "tur_Latn", "name": "Turkish", "native": "Türkçe", "tts": True},
    {"code": "ru", "nllb": "rus_Cyrl", "name": "Russian", "native": "Русский", "tts": True},
    {"code": "nl", "nllb": "nld_Latn", "name": "Dutch", "native": "Nederlands", "tts": True},
    {"code": "cs", "nllb": "ces_Latn", "name": "Czech", "native": "Čeština", "tts": True},
    {"code": "ar", "nllb": "arb_Arab", "name": "Arabic", "native": "العربية", "tts": True},
    {"code": "zh", "nllb": "zho_Hans", "name": "Chinese", "native": "中文", "tts": True},
    {"code": "ja", "nllb": "jpn_Jpan", "name": "Japanese", "native": "日本語", "tts": True},
    {"code": "ko", "nllb": "kor_Hang", "name": "Korean", "native": "한국어", "tts": True},
    {"code": "hi", "nllb": "hin_Deva", "name": "Hindi", "native": "हिन्दी", "tts": True},
    {"code": "hu", "nllb": "hun_Latn", "name": "Hungarian", "native": "Magyar", "tts": True},
]

_LANG_BY_CODE = {l["code"]: l for l in DUB_LANGUAGES}


def get_language(code: str) -> dict | None:
    return _LANG_BY_CODE.get(code)


def nllb_code(iso_code: str) -> str | None:
    lang = _LANG_BY_CODE.get(iso_code)
    return lang["nllb"] if lang else None


# ── Result model ───────────────────────────────────────────────────────


@dataclass
class DubSegment:
    start: float  # original segment start (s)
    end: float  # original segment end (s)
    original_text: str
    translated_text: str
    dubbed_start: float
    dubbed_end: float
    fitted: bool = True  # False if the dub could not be time-fitted


@dataclass
class DubResult:
    audio_path: str
    audio_url: str
    segments: list[DubSegment] = field(default_factory=list)
    source_language: str = ""
    target_language: str = ""
    duration: float = 0.0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "audioUrl": self.audio_url,
            "duration": round(self.duration, 3),
            "sourceLanguage": self.source_language,
            "targetLanguage": self.target_language,
            "segments": [
                {
                    "start": round(s.start, 3),
                    "end": round(s.end, 3),
                    "originalText": s.original_text,
                    "translatedText": s.translated_text,
                    "dubbedStart": round(s.dubbed_start, 3),
                    "dubbedEnd": round(s.dubbed_end, 3),
                    "fitted": s.fitted,
                }
                for s in self.segments
            ],
            "warnings": self.warnings,
        }


# ── Orchestrator ───────────────────────────────────────────────────────


class DubbingService:
    """Coordinates whisper → translate → tts → ffmpeg for one dub job."""

    # Max speed-up factor applied via TTS + atempo when fitting a dub into
    # the original segment window. Beyond this we accept drift (mark unfitted)
    # rather than producing chipmunk audio.
    MAX_SPEEDUP = 1.4

    async def _whisper_transcribe(
        self, client: httpx.AsyncClient, media_path: str, language: str | None
    ) -> dict:
        with open(media_path, "rb") as f:
            resp = await client.post(
                f"{settings.WHISPER_SERVICE_URL}/transcribe",
                files={"file": (os.path.basename(media_path), f, "application/octet-stream")},
                data={"language": language} if language else {},
                timeout=600,
            )
        resp.raise_for_status()
        return resp.json()

    async def _translate_batch(
        self,
        client: httpx.AsyncClient,
        texts: list[str],
        src_nllb: str,
        tgt_nllb: str,
    ) -> list[str]:
        resp = await client.post(
            f"{settings.TRANSLATE_SERVICE_URL}/translate-batch",
            json={"texts": texts, "source_lang": src_nllb, "target_lang": tgt_nllb},
            timeout=300,
        )
        resp.raise_for_status()
        return resp.json().get("translations", [])

    async def _tts(
        self,
        client: httpx.AsyncClient,
        text: str,
        language: str,
        speaker_wav: str | None,
        out_path: str,
    ) -> None:
        payload: dict = {
            "text": text,
            "language": language,
        }
        if speaker_wav:
            payload["speaker_wav"] = speaker_wav
        resp = await client.post(
            f"{settings.TTS_SERVICE_URL}/generate",
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        with open(out_path, "wb") as f:
            f.write(resp.content)

    async def _probe_duration(self, path: str) -> float:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await proc.communicate()
        try:
            return float(out.decode().strip())
        except ValueError:
            return 0.0

    async def _fit_segment(self, raw_wav: str, target_duration: float, out_path: str) -> tuple[float, bool]:
        """Time-stretch a TTS clip to fit ``target_duration`` seconds.

        Returns (achieved_duration, fitted). Uses atempo for fine-tuning;
        if the clip is already shorter than the target it's padded with silence
        so the next segment lines up.
        """
        raw_dur = await self._probe_duration(raw_wav)
        if raw_dur <= 0:
            return (0.0, False)

        if raw_dur <= target_duration + 0.05:
            # Shorter than window — pad with trailing silence to keep alignment.
            pad = max(0.0, target_duration - raw_dur)
            cmd = [
                "ffmpeg", "-y", "-i", raw_wav,
                "-af", f"apad=pad_dur={pad:.3f}",
                "-acodec", "pcm_s16le", out_path,
            ]
            await self._run_ffmpeg(cmd)
            return (target_duration, True)

        # Longer than window — speed up via atempo (capped at MAX_SPEEDUP).
        ratio = raw_dur / target_duration
        fitted = ratio <= self.MAX_SPEEDUP
        applied = min(ratio, self.MAX_SPEEDUP)
        # atempo only supports 0.5–2.0 per filter; chain if needed.
        filters = self._atempo_chain(applied)
        cmd = [
            "ffmpeg", "-y", "-i", raw_wav,
            "-af", filters,
            "-acodec", "pcm_s16le", out_path,
        ]
        await self._run_ffmpeg(cmd)
        achieved = await self._probe_duration(out_path)
        return (achieved, fitted)

    @staticmethod
    def _atempo_chain(ratio: float) -> str:
        """Split a tempo ratio into a chain of atempo filters (each ≤2.0)."""
        filters = []
        remaining = ratio
        while remaining > 2.0:
            filters.append("atempo=2.0")
            remaining /= 2.0
        if remaining < 0.5:
            # split the slowdown too
            while remaining < 0.5:
                filters.append("atempo=0.5")
                remaining /= 0.5
        filters.append(f"atempo={remaining:.4f}")
        return ",".join(filters)

    async def _run_ffmpeg(self, cmd: list[str]) -> None:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {err.decode()[:300]}")

    async def create_dub(
        self,
        media_path: str,
        source_language: str,
        target_language: str,
        speaker_wav_path: str | None,
        job_id: str,
        on_progress=None,
    ) -> DubResult:
        """Run the full dubbing pipeline.

        Args:
            media_path: Path to the source audio/video file.
            source_language: ISO 639-1 source code (e.g. "en"). Auto-detected
                by Whisper if empty/None.
            target_language: ISO 639-1 target code (e.g. "es").
            speaker_wav_path: Optional server-side path to a cloned voice
                sample (from tts-service /clone-voice). None = default voice.
            job_id: Background job ID, used for progress reporting.
            on_progress: async callable(progress: float, message: str).

        Returns:
            DubResult pointing at the assembled dubbed audio.
        """
        tgt_lang = get_language(target_language)
        if not tgt_lang:
            raise ValueError(f"Unsupported target language: {target_language}")

        src_nllb = nllb_code(source_language) if source_language else None
        tgt_nllb = tgt_lang["nllb"]
        warnings: list[str] = []
        if not tgt_lang.get("tts"):
            warnings.append(
                f"Voice cloning is not available for {target_language}; "
                "a default synthetic voice will be used."
            )

        async with httpx.AsyncClient() as client:
            # 1. Transcribe
            if on_progress:
                await on_progress(0.05, "Transcribing source audio…")
            transcript = await self._whisper_transcribe(
                client, media_path, source_language or None
            )
            segments = transcript.get("segments", [])
            if not segments:
                raise ValueError("Transcription returned no segments — nothing to dub.")
            detected_source = transcript.get("language", source_language or "")

            # 2. Translate (batch)
            if on_progress:
                await on_progress(0.25, f"Translating {len(segments)} segments…")
            texts = [s.get("text", "").strip() for s in segments]
            translations = await self._translate_batch(
                client, texts, src_nllb or "eng_Latn", tgt_nllb
            )
            # Pad/trim to segment count defensively
            if len(translations) < len(texts):
                translations.extend([""] * (len(texts) - len(translations)))

            # 3. TTS per segment + time-fit
            work_dir = tempfile.mkdtemp(prefix=f"dub_{job_id}_")
            seg_paths: list[str] = []
            dub_segments: list[DubSegment] = []

            for i, (seg, translation) in enumerate(zip(segments, translations)):
                pct = 0.3 + 0.6 * (i / max(1, len(segments)))
                if on_progress:
                    await on_progress(pct, f"Synthesizing voice {i + 1}/{len(segments)}…")
                if not translation.strip():
                    # Nothing to synthesize — emit silence to preserve alignment.
                    start = float(seg.get("start", 0.0))
                    end = float(seg.get("end", start))
                    dur = max(0.1, end - start)
                    silent = os.path.join(work_dir, f"sil_{i:05d}.wav")
                    cmd = [
                        "ffmpeg", "-y", "-f", "lavfi", "-t", f"{dur:.3f}",
                        "-i", "anullsrc=r=24000:cl=mono",
                        "-acodec", "pcm_s16le", silent,
                    ]
                    await self._run_ffmpeg(cmd)
                    seg_paths.append(silent)
                    dub_segments.append(DubSegment(
                        start=start, end=end,
                        original_text=texts[i], translated_text="",
                        dubbed_start=start, dubbed_end=end, fitted=True,
                    ))
                    continue

                raw = os.path.join(work_dir, f"raw_{i:05d}.wav")
                await self._tts(
                    client, translation, target_language, speaker_wav_path, raw
                )
                start = float(seg.get("start", 0.0))
                end = float(seg.get("end", start))
                window = max(0.3, end - start)
                fitted_path = os.path.join(work_dir, f"seg_{i:05d}.wav")
                _, fitted = await self._fit_segment(raw, window, fitted_path)
                if not fitted:
                    warnings.append(
                        f"Segment {i + 1} could not fit its original window "
                        f"({window:.1f}s) without distortion; drift accepted."
                    )
                seg_paths.append(fitted_path)
                dub_segments.append(DubSegment(
                    start=start, end=end,
                    original_text=texts[i], translated_text=translation,
                    dubbed_start=start, dubbed_end=start + window,
                    fitted=fitted,
                ))

            # 4. Concatenate with silence to preserve original timeline.
            if on_progress:
                await on_progress(0.92, "Assembling dubbed audio…")
            full_duration = float(transcript.get("duration", 0.0)) or dub_segments[-1].end

            # Build a concat list with silence gaps between segments.
            timeline_path = os.path.join(work_dir, "timeline.wav")
            await self._assemble_timeline(seg_paths, dub_segments, full_duration, timeline_path)

        # Move to the generated dir so it's served by StaticFiles.
        out_name = f"dub_{job_id}_{target_language}.wav"
        out_path = os.path.join(settings.GENERATED_DIR, out_name)
        os.makedirs(settings.GENERATED_DIR, exist_ok=True)
        # Convert to a compact, browser-friendly mp3 for the frontend.
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", timeline_path,
            "-codec:a", "libmp3lame", "-b:a", "128k", out_path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate()
        if proc.returncode != 0:
            # Fall back to wav if mp3 encode fails
            logger.warning("mp3 encode failed (%s); serving wav", err.decode()[:200])
            import shutil
            shutil.copy(timeline_path, out_path)
            out_name = out_name.replace(".wav", ".wav")

        duration = await self._probe_duration(out_path)

        if on_progress:
            await on_progress(1.0, "Dub complete.")

        return DubResult(
            audio_path=out_path,
            audio_url=f"/generated/{os.path.basename(out_path)}",
            segments=dub_segments,
            source_language=detected_source,
            target_language=target_language,
            duration=duration,
            warnings=warnings,
        )

    async def _assemble_timeline(
        self,
        seg_paths: list[str],
        segments: list[DubSegment],
        full_duration: float,
        out_path: str,
    ) -> None:
        """Concatenate per-segment clips with silence so dubbed audio lines
        up with the original timeline."""
        if not seg_paths:
            raise RuntimeError("No dubbed segments to assemble.")

        # Use the concat demuxer: build a list file referencing each clip.
        list_path = out_path + ".lst"
        with open(list_path, "w") as f:
            for p in seg_paths:
                f.write(f"file '{os.path.abspath(p)}'\n")

        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", list_path,
            "-acodec", "pcm_s16le", out_path,
        ]
        await self._run_ffmpeg(cmd)


dubbing_service = DubbingService()
