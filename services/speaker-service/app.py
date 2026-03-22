"""Speaker diarization and emotion detection microservice.

Speaker diarization: pyannote/speaker-diarization-3.1 (or silence-based fallback).
Emotion detection: speechbrain/emotion-recognition (or energy-based fallback).

Accepts audio/video files and returns speaker segments and/or emotion annotations.
"""

import logging
import os
import uuid
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="OpenCut Speaker Diarization Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Lazy-load the pipeline to avoid loading on import
_pipeline = None
_pipeline_loaded = False


def _get_pipeline():
    """Lazy-load the pyannote speaker diarization pipeline."""
    global _pipeline, _pipeline_loaded
    if _pipeline_loaded:
        return _pipeline

    _pipeline_loaded = True
    hf_token = os.environ.get("HF_TOKEN")

    try:
        from pyannote.audio import Pipeline
        import torch

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading pyannote/speaker-diarization-3.1 on %s...", device)

        if hf_token:
            _pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token,
            )
        else:
            _pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
            )

        _pipeline = _pipeline.to(device)
        logger.info("Pyannote pipeline loaded successfully.")
    except Exception as e:
        logger.warning("Failed to load pyannote pipeline: %s. Will use fallback.", e)
        _pipeline = None

    return _pipeline


async def _extract_audio(input_path: str) -> str:
    """Extract audio from video file using FFmpeg, returns WAV path."""
    video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
    ext = Path(input_path).suffix.lower()
    if ext not in video_exts:
        return input_path

    output_path = input_path.rsplit(".", 1)[0] + "_audio.wav"
    cmd = [
        "ffmpeg", "-i", input_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        "-y", output_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {proc.stderr[:500]}")
    return output_path


def _fallback_diarization(audio_path: str, num_speakers: Optional[int] = None) -> list[dict]:
    """Simple energy-based fallback when pyannote is not available.

    Splits audio into segments based on silence detection via FFmpeg,
    then alternates speaker labels. This is a rough approximation.
    """
    import json

    # Use FFmpeg silence detection
    cmd = [
        "ffmpeg", "-i", audio_path,
        "-af", "silencedetect=noise=-30dB:d=0.5",
        "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    stderr = proc.stderr

    # Parse silence timestamps
    silence_starts = []
    silence_ends = []
    for line in stderr.split("\n"):
        if "silence_start:" in line:
            try:
                val = float(line.split("silence_start:")[1].strip().split()[0])
                silence_starts.append(val)
            except (ValueError, IndexError):
                pass
        elif "silence_end:" in line:
            try:
                val = float(line.split("silence_end:")[1].strip().split()[0])
                silence_ends.append(val)
            except (ValueError, IndexError):
                pass

    # Get total duration
    dur_cmd = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "json", audio_path]
    dur_proc = subprocess.run(dur_cmd, capture_output=True, text=True, timeout=30)
    try:
        total_duration = float(json.loads(dur_proc.stdout)["format"]["duration"])
    except Exception:
        total_duration = 0

    if not silence_starts and not silence_ends:
        # No silences found — single speaker for entire audio
        return [{"speaker": "SPEAKER_A", "start": 0.0, "end": total_duration}]

    # Build speech segments between silences
    segments = []
    current_speaker_idx = 0
    max_speakers = num_speakers or 2
    speaker_labels = [f"SPEAKER_{chr(65 + i)}" for i in range(max_speakers)]

    # First speech segment (before first silence)
    if silence_starts and silence_starts[0] > 0.5:
        segments.append({
            "speaker": speaker_labels[0],
            "start": 0.0,
            "end": round(silence_starts[0], 2),
        })
        current_speaker_idx = 1

    # Speech segments between silences
    for i, end_time in enumerate(silence_ends):
        next_start = silence_starts[i + 1] if i + 1 < len(silence_starts) else total_duration
        if next_start - end_time > 0.3:
            segments.append({
                "speaker": speaker_labels[current_speaker_idx % max_speakers],
                "start": round(end_time, 2),
                "end": round(next_start, 2),
            })
            current_speaker_idx += 1

    if not segments:
        segments = [{"speaker": "SPEAKER_A", "start": 0.0, "end": total_duration}]

    return segments


@app.get("/health")
async def health():
    pipeline = _get_pipeline()
    return {
        "service": "speaker-diarization",
        "status": "running",
        "model": {
            "loaded": pipeline is not None,
            "name": "pyannote/speaker-diarization-3.1" if pipeline else "fallback (silence-based)",
            "installed": pipeline is not None,
        },
        "version": "0.1.0",
    }


@app.post("/diarize")
async def diarize(
    file: UploadFile = File(...),
    num_speakers: Optional[int] = Form(default=None),
    min_speakers: Optional[int] = Form(default=None),
    max_speakers: Optional[int] = Form(default=None),
):
    """Run speaker diarization on an audio/video file.

    Returns a list of speaker segments:
    [{"speaker": "SPEAKER_A", "start": 0.0, "end": 5.2}, ...]
    """
    ext = Path(file.filename or "audio.wav").suffix.lower()
    upload_id = uuid.uuid4().hex[:8]
    upload_path = str(UPLOAD_DIR / f"diarize_{upload_id}{ext}")

    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)

    try:
        audio_path = await _extract_audio(upload_path)
        pipeline = _get_pipeline()

        if pipeline is not None:
            # Use pyannote diarization
            logger.info("Running pyannote diarization on %s...", audio_path)

            diarize_kwargs = {}
            if num_speakers is not None:
                diarize_kwargs["num_speakers"] = num_speakers
            if min_speakers is not None:
                diarize_kwargs["min_speakers"] = min_speakers
            if max_speakers is not None:
                diarize_kwargs["max_speakers"] = max_speakers

            diarization = pipeline(audio_path, **diarize_kwargs)

            segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                segments.append({
                    "speaker": speaker,
                    "start": round(turn.start, 2),
                    "end": round(turn.end, 2),
                })

            # Merge consecutive segments from the same speaker
            merged = []
            for seg in segments:
                if merged and merged[-1]["speaker"] == seg["speaker"] and seg["start"] - merged[-1]["end"] < 0.5:
                    merged[-1]["end"] = seg["end"]
                else:
                    merged.append(seg)

            logger.info("Diarization complete: %d segments, %d speakers",
                       len(merged), len(set(s["speaker"] for s in merged)))

            return {
                "segments": merged,
                "num_speakers": len(set(s["speaker"] for s in merged)),
                "method": "pyannote",
            }
        else:
            # Fallback to silence-based diarization
            logger.info("Using fallback diarization on %s...", audio_path)
            segments = _fallback_diarization(audio_path, num_speakers)

            return {
                "segments": segments,
                "num_speakers": len(set(s["speaker"] for s in segments)),
                "method": "fallback",
            }

    except Exception as e:
        logger.exception("Diarization failed")
        raise HTTPException(status_code=500, detail=f"Diarization failed: {str(e)}")
    finally:
        for p in [upload_path, upload_path.rsplit(".", 1)[0] + "_audio.wav"]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass


# ── Emotion Detection ──────────────────────────────────────────────────

_emotion_model = None
_emotion_loaded = False


def _get_emotion_model():
    """Lazy-load the speechbrain emotion recognition model."""
    global _emotion_model, _emotion_loaded
    if _emotion_loaded:
        return _emotion_model
    _emotion_loaded = True

    try:
        from speechbrain.inference.interfaces import foreign_class
        _emotion_model = foreign_class(
            source="speechbrain/emotion-recognition-wav2vec2-IEMOCAP",
            pymodule_file="custom_interface.py",
            classname="CustomEncoderWav2vec2Classifier",
            savedir="/root/.cache/speechbrain_emotion",
        )
        logger.info("SpeechBrain emotion model loaded successfully.")
    except Exception as e:
        logger.warning("SpeechBrain emotion model unavailable: %s. Using energy fallback.", e)
        _emotion_model = None

    return _emotion_model


def _fallback_emotion_detection(audio_path: str, window_seconds: float = 5.0) -> list[dict]:
    """Energy-based emotion approximation when speechbrain is unavailable.

    Segments audio into windows and measures RMS energy.
    High-energy segments are labeled as potentially emotional.
    """
    import json as _json

    # Get duration
    dur_cmd = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "json", audio_path]
    dur_proc = subprocess.run(dur_cmd, capture_output=True, text=True, timeout=30)
    try:
        total_duration = float(_json.loads(dur_proc.stdout)["format"]["duration"])
    except Exception:
        total_duration = 60.0

    # Extract raw PCM and compute RMS per window
    pcm_cmd = [
        "ffmpeg", "-i", audio_path,
        "-f", "s16le", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        "-y", "pipe:1",
    ]
    proc = subprocess.run(pcm_cmd, capture_output=True, timeout=300)
    if proc.returncode != 0:
        return []

    import struct
    import math

    raw = proc.stdout
    sample_rate = 16000
    samples_per_window = int(sample_rate * window_seconds)
    num_samples = len(raw) // 2
    results = []

    for start_sample in range(0, num_samples, samples_per_window):
        end_sample = min(start_sample + samples_per_window, num_samples)
        chunk = raw[start_sample * 2 : end_sample * 2]
        if len(chunk) < 100:
            break

        # Compute RMS
        n = len(chunk) // 2
        fmt = f"<{n}h"
        values = struct.unpack(fmt, chunk[:n * 2])
        rms = math.sqrt(sum(v * v for v in values) / n) / 32768.0

        timestamp = start_sample / sample_rate
        # Map RMS to emotion intensity (0-1)
        intensity = min(1.0, rms * 5.0)
        # Simple classification
        if intensity > 0.6:
            emotion = "excited"
        elif intensity > 0.3:
            emotion = "neutral"
        else:
            emotion = "calm"

        results.append({
            "start": round(timestamp, 2),
            "end": round(min(timestamp + window_seconds, total_duration), 2),
            "emotion": emotion,
            "intensity": round(intensity, 3),
        })

    return results


@app.post("/analyze-emotion")
async def analyze_emotion(
    file: UploadFile = File(...),
    window_seconds: float = Form(default=5.0),
):
    """Detect emotional peaks in audio for better clip scoring.

    Returns emotion annotations per time window:
    [{"start": 0.0, "end": 5.0, "emotion": "excited", "intensity": 0.8}]
    """
    ext = Path(file.filename or "audio.wav").suffix.lower()
    upload_id = uuid.uuid4().hex[:8]
    upload_path = str(UPLOAD_DIR / f"emotion_{upload_id}{ext}")

    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)

    try:
        audio_path = await _extract_audio(upload_path)
        model = _get_emotion_model()

        if model is not None:
            # Use speechbrain for real emotion detection
            # Process audio in windows
            import torchaudio

            waveform, sr = torchaudio.load(audio_path)
            if sr != 16000:
                resampler = torchaudio.transforms.Resample(sr, 16000)
                waveform = resampler(waveform)
                sr = 16000

            samples_per_window = int(sr * window_seconds)
            total_samples = waveform.shape[1]
            results = []

            for start_idx in range(0, total_samples, samples_per_window):
                end_idx = min(start_idx + samples_per_window, total_samples)
                chunk = waveform[:, start_idx:end_idx]
                if chunk.shape[1] < sr:  # skip chunks shorter than 1 second
                    continue

                timestamp = start_idx / sr
                try:
                    out_prob, score, index, text_lab = model.classify_batch(chunk)
                    emotion = text_lab[0] if text_lab else "neutral"
                    intensity = round(float(score[0].max()), 3)
                except Exception:
                    emotion = "neutral"
                    intensity = 0.5

                results.append({
                    "start": round(timestamp, 2),
                    "end": round(min(timestamp + window_seconds, total_samples / sr), 2),
                    "emotion": emotion.lower(),
                    "intensity": intensity,
                })

            return {
                "emotions": results,
                "method": "speechbrain",
                "peak_emotion": max(results, key=lambda r: r["intensity"])["emotion"] if results else "neutral",
            }
        else:
            results = _fallback_emotion_detection(audio_path, window_seconds)
            return {
                "emotions": results,
                "method": "fallback",
                "peak_emotion": max(results, key=lambda r: r["intensity"])["emotion"] if results else "neutral",
            }

    except Exception as e:
        logger.exception("Emotion detection failed")
        raise HTTPException(status_code=500, detail=f"Emotion detection failed: {str(e)}")
    finally:
        for p in [upload_path, upload_path.rsplit(".", 1)[0] + "_audio.wav"]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
