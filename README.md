<table width="100%">
  <tr>
    <td align="left" width="120">
      <img src="apps/web/public/favicon.png" alt="OpenCut AI Logo" width="80" />
    </td>
    <td align="right">
      <h1>OpenCut AI</h1>
      <h3 style="margin-top: -10px;">The privacy-first, open-source AI video editor.</h3>
      <p>Self-host. Edit by text. Clone voices. Remove fillers. No cloud, no subscriptions, no data leaving your machine.</p>
    </td>
  </tr>
</table>

## Why OpenCut AI?

Every major video editor sends your footage to the cloud. OpenCut AI doesn't.

| | OpenCut AI | Descript | CapCut | DaVinci Resolve |
|---|---|---|---|---|
| **Self-hosted** | Yes | No | No | No |
| **Open source** | Yes | No | No | No |
| **Data stays local** | Always | Cloud | Cloud (ByteDance) | Local |
| **AI editing** | Yes | Yes | Yes | Limited |
| **AI video generation** | 9 models, 5 providers | No | No | No |
| **A/B testing** | Thumbnails + Hooks | No | No | No |
| **Engagement analytics** | Yes (7 signals) | No | No | No |
| **Cost** | Free (your server) | $24–65/mo | Free with watermark | $295 one-time |
| **Per-seat pricing** | No | Yes | No | No |

**OpenCut AI is the only self-hosted, open-source video editor with AI built in.** Run it on a $20/mo server or your laptop. Your footage, your models, your rules.

## Features

### AI-Powered Editing

- **Edit by text** — Transcribe, then edit video like a document. Delete a sentence and the timeline cuts itself.
- **Smart Cut** — One-click filler word removal ("um", "uh", "like") and silence detection. Runs locally via FFmpeg.
- **AI transcription** — Whisper-powered speech-to-text with word-level timestamps. GPU or CPU.
- **Voice cloning & TTS** — Clone any voice from a 6-second sample. Supports [Sarvam AI](https://www.sarvam.ai/) for 22 Indian languages and [Smallest AI](https://www.smallest.ai/) for 15 languages with 80+ voices.
- **AI Auto-Duck** — Automatically lowers background music during speech segments with configurable duck amount and fade.
- **AI Music Generation** — Generate royalty-free background music with 15 genres, 12 moods, and 3 tempo settings. Preview and insert directly to the timeline.
- **AI Thumbnail Generator** — Create eye-catching thumbnails from prompts or transcript analysis. 5 styles, 4 size presets, 5 color schemes, up to 4 variations at once.
- **AI Script-to-Video** — Write a script, AI generates voiceover, visuals, and builds the timeline automatically.
- **AI Co-Pilot Agent** — Describe your goal in plain English ("make this a 60-second reel with captions and music"). AI creates a multi-step plan, you review, then it executes. 19 action types, cancel anytime. Runs through your local LLM.
- **AI Scene Detection** — Client-side visual scene change detection using color histogram analysis. Finds camera cuts and angle changes with before/after thumbnails. No data leaves your machine.
- **AI Auto-Color Correction** — 8 color correction profiles (Vibrant Pop, Film Look, Warm Sunset, etc.) with batch apply to all video clips.
- **AI Video-to-Shorts Auto-Composer** — One-click: AI selects best clip, trims to target duration, sets canvas size (9:16, 1:1, 4:5), adds subtitles.
- **Speaker-Labeled Captions** — Auto-assign color-coded speaker labels, rename speakers, apply captions to timeline.
- **YouTube Chapters Export** — Auto-detect chapter boundaries, export in YouTube `MM:SS Title` format. One-click copy chapters or full description with title, tags, and timestamps.
- **Virality Score** — Score your video's engagement potential across 7 signals (hook, curiosity gap, energy, beat sync, face, emotion, viral) before publishing.
- **A/B Thumbnail Testing** — Generate up to 4 thumbnail variants, auto-score each on contrast, text readability, face presence, color vibrancy, and composition. Winner gets a "Recommended" badge. TubeBuddy charges $15/mo for this.
- **A/B Hook Testing** — Generate 5 hook variants from your transcript, each scored for engagement potential. Compare side-by-side and pick the best opening.
- **Engagement Analytics Dashboard** — Track score history over time. Avg composite, grade distribution, per-signal breakdown, strongest/weakest signals, trend chart.
- **AI Video Generation Hub** — Generate video from text, image, or video using 9 models across 5 providers (Runway Gen-3 Alpha, Pika 1.0, Kling v1.6 Pro, MiniMax, Stable Video Diffusion, Seedance 2.0, Luma Dream Machine, CogVideoX). 3 modes, 6 aspect ratios, prompt enhancement, one-click add to timeline.
- **Smart Reframe** — AI-powered face detection generates position/scale keyframes to keep subjects centered when converting landscape to vertical. 4 presets: TikTok 9:16, Square, Instagram 4:5, YouTube 16:9.
- **Chroma Key / Green Screen** — WebGL shader-based color keying with 5 presets, tolerance, softness, and spill suppression controls.
- **Motion Tracking** — Client-side template matching (normalized cross-correlation) that generates transform keyframes. Runs entirely in the browser.
- **Drag-to-Reorder Tracks** — Drag-and-drop track labels to reorder timeline tracks. Full undo/redo support.
- **YouTube to Reels** — Paste a URL, auto-detect clips, reframe to 9:16 with face tracking, add captions, export reels.
- **AI image generation** — Generate images from text via Stable Diffusion and place on the timeline.
- **Smart subtitles** — One-click generation with karaoke, pill, and classic styles.
- **Natural language commands** — "remove the intro", "speed up the middle" — the editor listens.
- **Audio denoising** — Clean up background noise from any track.

### Professional Editing

- **20 built-in transitions** — Cross-dissolve, dip-black, slide, wipe, zoom, iris, clock wipe, morph, glitch, film burn, page peel, spin, push, fade-white, checkerboard, dissolve-zoom, band-slide, cube-spin, and more. All WebGL dual-texture shaders.
- **22 filter presets + 12 effects** — Sunset Glow, Moonlight, Cyberpunk, Film Noir, Dreamy, Retro VHS, Teal & Orange, Bleach Bypass, Cross Process, Faded Film. Effects include Sharpen, Chromatic Aberration, Vignette, Film Grain, Glitch, RGB Split, Lens Distortion, Motion Blur, Posterize, Duotone.
- **Speed ramping** — Variable speed curves with click-to-add keyframes and 5 presets (linear, ease-in, ease-out, smooth, bounce). Per-clip playback rate animation.
- **Crop & Mask tool** — Rectangle, ellipse, polygon masks with feather control and inversion. Pixel-based crop values in properties panel.
- **Multicam editing** — Sync angles by timecode, multicam viewer panel, one-click angle switching, auto-detect video tracks as angles.
- **Marker system** — Press `M` to drop colored markers (red, yellow, green, blue, purple). Markers panel, jump to next/previous, notes on markers.
- **J/K/L shuttle playback** — `J` reverse, `K` stop, `L` forward. Press multiple times for 2x, 4x, 8x speed. Full reverse playback support.
- **Ripple trim** — Delete clips and close gaps automatically. `computeRippleTrim()` shifts downstream elements.
- **Nesting / compound clips** — Select multiple clips and nest into a single compound clip. Un-nest to explode back to individual clips.
- **Proxy editing** — Auto-generate lower-resolution copies of 4K+ footage for smooth preview. Export always uses originals.
- **Audio mixer** — Per-track volume, stereo pan, solo/mute with real-time level meters.
- **Audio effects chain** — Per-track insert chain: EQ (3-band/parametric), Compressor, Noise Gate, Reverb (room/hall/plate), De-esser, Limiter. Real-time Web Audio API processing.
- **Direct audio recording** — Record audio directly to timeline from your microphone. Live level metering, pause/resume, auto-insert at playhead position.
- **LUFS loudness normalization** — Measure integrated, short-term, momentary, true peak loudness. Normalize to platform targets (YouTube -14, Spotify -14, Apple Podcasts -16, EBU R128 -23, ATSC A/85 -24). Custom target slider.
- **Beat detection** — Detect beats in music tracks, display BPM, visualize beat strength, toggle beat grid overlay and snap-to-beats.
- **Batch export** — Queue multiple export jobs. 8 platform presets: YouTube 1080p/4K, TikTok/Reels 9:16, Instagram Square/Portrait, Twitter/X, Podcast Audio, Web/Email.
- **Keyboard shortcut editor** — Full shortcut management UI with search, category filter, click-to-rebind, conflict detection, and reset to defaults.
- **Undo history panel** — Visual history list with jump-to-any-point. See redo stack, click to navigate command history.
- **Color-coded tracks** — Assign 8 colors to tracks. Lock/unlock tracks to prevent accidental edits.
- **Filmstrip thumbnails** — Canvas-based frame extraction with LRU cache. Thumbnails rendered on timeline clips.
- **Template gallery** — 8 built-in project templates (YouTube Intro, TikTok Vlog, Podcast Highlight, Product Review, Classroom Lesson, Instagram Reel, Travel Vlog, Tutorial). Search, filter by category, one-click apply.
- **Share project via link** — Generate share links with expiration, password protection, and permission controls (download/edit). Auto-copy to clipboard, revoke support.
- **Multi-track timeline** — Video, audio, text, sticker, and effect tracks with drag-and-drop.
- **Freeze frame** — Capture any frame at the playhead and insert as a still image.
- **Frame size presets** — Toggle 16:9, 9:16, 1:1, 4:3 above the preview.
- **Real-time preview** — Live canvas rendering with transforms, effects, and transitions.
- **No watermarks or subscriptions** — Free and open-source, forever.

### Infrastructure

- **TurboQuant inference** — KV cache compression down to 2-bit on GPU, 3-bit on CPU, with a compute mode toggle (Auto / CPU / GPU).
- **Kimi K2 & Kimi VL** — MoonshotAI's open-source Kimi models are fully supported: Kimi K2 (1T/32B active MoE) via Ollama GGUF (Q3/Q4/Q5) for every tier, and Kimi VL A3B (vision-language, 3B active) via TurboQuant for multimodal scene analysis.
- **All data local** — Files stored in OPFS (Origin Private File System). Nothing leaves the browser or your server.
- **Docker-ready** — One command to start the full stack. BuildKit cache mounts, CPU-only PyTorch wheels, and parallel builds keep rebuilds fast.

## Project Structure

```
apps/web/             — Next.js web application
  src/components/     — UI and editor components
  src/hooks/          — Custom React hooks
  src/lib/            — Utility, command, and API logic
  src/core/           — Editor core (singleton managers)
  src/services/       — Renderer, storage, video cache, proxy generator
  src/types/          — TypeScript type definitions
services/ai-backend/  — FastAPI AI backend
  app/routes/         — API endpoints (transcribe, tts, youtube, engagement, etc.)
  app/services/       — AI services (clip detection, engagement scoring, face reframe, etc.)
packages/             — Shared packages (env, UI)
```

## Getting Started

### Prerequisites

**All setups:**

- [Bun](https://bun.sh/docs/installation)
- [Docker](https://docs.docker.com/get-docker/) with BuildKit support and [Docker Compose](https://docs.docker.com/compose/install/) v2.3+

**GPU setup (optional, NVIDIA only):**

- NVIDIA driver installed on the host (`nvidia-smi` must work on the host first)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) so Docker can expose the GPU to containers
- Recommended: CUDA 13+ driver for the `cuTile` kernel path used by TurboQuant (older drivers still work — they just fall back to the PyTorch KV-compression path)

> Docker is optional but recommended for running the database, Redis, and AI backend. Frontend-only development works without it.

### Install and Run Locally

1. Clone the repository:

   ```bash
   git clone https://github.com/Ekaanth/OpenCut-AI.git
   cd OpenCut-AI
   ```

2. Copy the environment file:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Start the database, Redis, and AI backend. **Pick one of the two startup modes below.**

   **Option A — CPU (default, works on any machine):**

   ```bash
   # Enable BuildKit for faster builds with cache mounts
   export DOCKER_BUILDKIT=1

   # Build shared base images first, then all services in parallel
   docker compose build --parallel
   docker compose up -d
   ```

   **Option B — NVIDIA GPU (turboquant-service runs on CUDA with cuTile kernels):**

   ```bash
   # Verify the host can see the GPU first
   nvidia-smi

   # Enable BuildKit for faster builds with cache mounts
   export DOCKER_BUILDKIT=1

   # Build + start everything with the GPU override file layered on top
   docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build

   # Confirm the turboquant-service container actually sees the GPU
   docker compose exec turboquant-service nvidia-smi

   # Confirm the service reports GPU mode
   curl http://localhost:8430/health | jq '{compute_mode, backend, turboquant_engine_available}'
   # Expected: {"compute_mode": "cuda", "backend": "gpu", "turboquant_engine_available": true}
   ```

   If `nvidia-smi` fails on the host, install the NVIDIA driver first. If it works on the host but fails inside the container, install the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) and restart the Docker daemon (`sudo systemctl restart docker`).

4. Install dependencies and start the dev server:

   ```bash
   bun install
   bun dev:web
   ```

The editor will be available at [http://localhost:3000](http://localhost:3000).

> **Switching between CPU and GPU later?** You can toggle at runtime from the editor's **Settings → AI Optimization → Compute Mode** panel — no need to tear down Docker. If you started with Option A (CPU) and later want GPU, stop the stack (`docker compose down`) and restart with Option B.

### Docker Build Optimizations

All services are self-contained Dockerfiles that build in parallel without dependency ordering issues. BuildKit cache mounts share downloaded packages across services automatically.

**Key optimizations:**

| Technique | Benefit |
|-----------|---------|
| **CPU-only PyTorch** | ~8GB less to download across 4 services (~200MB vs ~2GB CUDA each) |
| **BuildKit cache mounts** | uv/pip download cache survives across rebuilds — code-only changes skip dep installs entirely |
| **Parallel builds** | `docker compose build --parallel` builds all services concurrently |
| **Per-service .dockerignore** | Smaller build contexts, faster COPY operations |
| **Layer-ordered Dockerfiles** | `requirements.txt` copied before source code — dep layer stays cached when only code changes |

**Rebuilding after code changes:**

```bash
export DOCKER_BUILDKIT=1
docker compose build --parallel
docker compose up -d
```

On subsequent builds, only the `COPY . .` layer and below is rebuilt. The dependency install layers are served from the BuildKit cache unless `requirements.txt` or `requirements.lock` changes.

### AI Backend

The AI backend runs as a FastAPI service on port 8420. It powers transcription, image generation, voice cloning, TTS, audio analysis, LLM commands, YouTube-to-Reels processing, and engagement scoring.

```bash
# Start with Docker (recommended)
docker compose up -d

# Or run standalone
cd services/ai-backend
python run.py
```

Configure AI models in the **Settings > AI Models** panel inside the editor.

#### Optional dependencies

| Dependency               | Purpose                                 | Required?                          |
| ------------------------ | --------------------------------------- | ---------------------------------- |
| Redis                    | Job queue for YouTube-to-Reels pipeline | Optional (falls back to in-memory) |
| yt-dlp                   | YouTube video downloading               | Required for YouTube-to-Reels      |
| Google OAuth credentials | YouTube channel ownership verification  | Optional                           |

#### Python package management (uv)

All seven Python services (ai-backend, turboquant-service, whisper-service, tts-service, image-service, speaker-service, face-service) use [**uv**](https://docs.astral.sh/uv/) — Astral's Rust-based Python package manager — instead of pip. uv resolves and installs 10–100× faster than pip, so cold-cache Docker builds of the heavy services (torch, transformers, bitsandbytes) finish in seconds instead of minutes.

Each service has two files that define its dependencies:

- **`requirements.txt`** — the editable source of truth. Add / remove / pin packages here.
- **`requirements.lock`** — the full transitive closure, autogenerated from `requirements.txt` via `uv pip compile --universal`. Commit this file; the Dockerfile installs from it for reproducible builds.

After editing a `requirements.txt`, regenerate the matching lockfile:

```bash
# Install uv once on your host (or `brew install uv`)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Regenerate the lockfile for the service you edited
uv pip compile services/<service-name>/requirements.txt \
  -o services/<service-name>/requirements.lock \
  --python-version 3.11 \
  --universal
```

`--universal` is important — it produces a platform-independent lockfile that preserves PEP 508 markers (e.g. `bitsandbytes>=0.43.0 ; platform_system != "Darwin"` in the turboquant-service) so the same lockfile works whether you generate it on macOS or run it inside a Linux container. Without `--universal`, packages gated off your current platform are dropped from the lockfile entirely.

Inside Dockerfiles, uv runs with `--system --no-cache`: system-site-packages (safe because each container is already isolated) and no install cache (the Docker layer cache handles that). The GPU extras for TurboQuant are **not** in the lockfile — they're layered on top via the `TURBOQUANT_EXTRAS=gpu` build arg from [`docker-compose.gpu.yml`](docker-compose.gpu.yml).

**Platform note — face-service runs on linux/amd64.** Six of the seven services build natively for whatever arch your Docker daemon defaults to (arm64 on Apple Silicon, amd64 on Intel/AMD Linux). The exception is **face-service**, which pins `FROM --platform=linux/amd64` because `mediapipe` does not publish aarch64 Linux wheels — only `manylinux_2_28_x86_64`, `macosx_arm64`, and `win_amd64`. On Apple Silicon hosts Docker runs face-service through Rosetta emulation (slower startup, fine at steady state). If mediapipe eventually ships aarch64 Linux wheels, drop the `--platform=linux/amd64` line from `services/face-service/Dockerfile` and the container will run natively.

> **Reverting to pip** is a one-line change per Dockerfile: replace `uv pip install --system --no-cache` with `pip install --no-cache-dir` and delete the `COPY --from=ghcr.io/astral-sh/uv:0.9.28 ...` line. Lockfiles can stay committed — pip ignores them.

### TurboQuant: Compute Mode (CPU / GPU)

The TurboQuant inference service supports both CPU and NVIDIA GPU execution, with **two completely separate backend implementations** tuned for each device.

| Backend            | Compression path                                          | Decode path                                                    | "Turbo boost" strategy                                        |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `GPUTurboBackend`  | `turboquant-gpu` cuTile fused kernels, **2-bit** or 3-bit | Full `engine.generate()` through the compressed KV cache       | TF32 matmul, cuDNN benchmark, `auto_tune()` warm-up           |
| `CPUTurboBackend`  | PyTorch fallback, **3-bit** only (2-bit decode is lossy)  | Plain HF `model.generate` (greedy fallback too slow on CPU)   | Physical-core thread pinning, MKLDNN, single warm-up probe   |

The backends live in [`services/turboquant-service/compute_backends.py`](services/turboquant-service/compute_backends.py) behind a common `BaseTurboBackend` interface, so application code never branches on device type. The factory `create_turbo_backend(device=...)` picks the right one automatically — and if a GPU backend fails to initialize (e.g. `cuda-tile` not installed, CUDA driver too old), it falls back to the CPU backend with a warning rather than crashing.

#### Choosing Compute Mode in the UI

Open the editor → **Settings → AI Optimization → Compute Mode** and pick one of:

- **Auto** — detect the fastest device (CUDA → MPS → CPU). Default for every existing user.
- **CPU** — force CPU inference. Works on any host; `CPUTurboBackend` kicks in.
- **GPU (CUDA)** — force NVIDIA GPU. Button is greyed out (with a tooltip) when no GPU is detected.

The selector shows a live "Running on: `<device>`" status line and a badge with the **actual** KV compression ratio from the most recent inference request. Selecting a new mode writes `OPENCUTAI_AI_COMPUTE_MODE` to `.env`, reloads the in-memory backend config, and reloads the model on the new device.

#### Running with a GPU (Docker) — reference

See **Getting Started → Install and Run Locally → Option B** above for the quickstart. This section is the deeper reference.

**What the GPU override file does**

[`docker-compose.gpu.yml`](docker-compose.gpu.yml) is a standard Compose override layered on top of the base file. It changes three things for the `turboquant-service`:

1. **Reserves a GPU device** via `deploy.resources.reservations.devices` with `driver: nvidia`, `count: 1`, `capabilities: [gpu]`. This is the modern Compose v2.3+ syntax; older `runtime: nvidia` setups need to be updated.
2. **Passes `TURBOQUANT_EXTRAS=gpu`** as a build arg, which makes the turboquant-service Dockerfile run `uv pip install --system "turboquant-gpu[gpu]" --extra-index-url https://pypi.nvidia.com`. This pulls in the cuTile kernel extras from NVIDIA's PyPI mirror.
3. **Pins `DEVICE=cuda`** (instead of `auto`) so the container always comes up in GPU mode. Remove that override line if you want the UI Compute Mode toggle to drive the device.

**First-time startup**

```bash
# 1. Make sure the host + Docker can see the GPU
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi

# 2. Bring up the stack with the GPU override
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build

# 3. Verify the turboquant-service picked up the GPU
docker compose exec turboquant-service nvidia-smi
docker compose logs turboquant-service | grep -E "Compute mode|TurboQuantEngine|GPUTurboBackend"

# 4. Verify via the HTTP health endpoint
curl -s http://localhost:8430/health | jq
#   "compute_mode": "cuda",
#   "backend": "gpu",
#   "backend_effective_bits": 2,
#   "turboquant_engine_available": true,
#   "gpu_available": true
```

**Managing the stack**

```bash
# Tail logs for just the turboquant-service
docker compose -f docker-compose.yml -f docker-compose.gpu.yml logs -f turboquant-service

# Restart just the turboquant-service (e.g. after changing env vars)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --force-recreate turboquant-service

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.gpu.yml down
```

> Tip: export `COMPOSE_FILE=docker-compose.yml:docker-compose.gpu.yml` in your shell so you don't have to repeat `-f` on every command.

**Troubleshooting**

| Symptom                                                                              | Cause                                                                   | Fix                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `could not select device driver "nvidia"`                                            | NVIDIA Container Toolkit not installed                                  | Install the toolkit and restart Docker: `sudo systemctl restart docker`                                                                                    |
| `nvidia-smi` works on host but not in container                                      | Docker daemon hasn't picked up the toolkit                              | Restart the daemon, or add `"default-runtime": "nvidia"` to `/etc/docker/daemon.json`                                                                      |
| Build fails on `uv pip install turboquant-gpu[gpu]`                                  | Host's CUDA driver is older than 13.0, so `cuda-tile` isn't available   | Either upgrade the driver, or drop the `TURBOQUANT_EXTRAS: gpu` build arg (the engine still works via the PyTorch fallback — you just lose cuTile kernels) |
| `/health` shows `"compute_mode": "cpu"` even with the override file                  | Container couldn't see the GPU at startup                               | Check `docker compose exec turboquant-service nvidia-smi`; if that fails, the toolkit/driver isn't wired up                                                |
| Generation works but `compression_ratio` is always `null`                            | `temperature > 0` requests use the sampling fallback path               | Set `temperature=0` in the request to route through `engine.generate()` and get real compression metrics                                                   |
| `RuntimeError: GPUTurboBackend requires CUDA` in turboquant-service logs at startup  | Someone pinned `DEVICE=cuda` on a host without CUDA                     | Unset `DEVICE` or set it to `auto` — the CPU backend will take over                                                                                        |

**Graceful degradation**

The factory in `compute_backends.py` is defensive: if `GPUTurboBackend.__init__` throws (e.g. `turboquant-gpu` not installed, CUDA driver missing, `cuda-tile` extras incompatible), it logs a warning and falls back to `CPUTurboBackend`. The service comes up either way — you'll just see `"backend": "cpu"` in `/health` and the CPU turbo-boost path (thread pinning + MKLDNN + 3-bit metrics probe) kicks in instead.

### Security Notes (turboquant-service)

The turboquant-service is designed to run on a private Docker network behind the ai-backend proxy — it does not expose its own auth layer. A few hardening knobs are still worth knowing:

| Environment variable | Default | Effect                                                                                                                                                                |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRUST_REMOTE_CODE`  | `false` | When `true`, HuggingFace model repos can execute arbitrary Python on load (`AutoTokenizer` / `AutoModelForCausalLM` with `trust_remote_code=True`). Only opt in for models you fully trust. |
| `CORS_ORIGINS`       | `*`     | Comma-separated list of allowed origins. Wildcard mode intentionally runs with `allow_credentials=False` (forbidden-by-spec combo otherwise); set an explicit list to enable credentialed CORS. |
| `DEVICE`             | `auto`  | Pinned by docker-compose to `${OPENCUTAI_AI_COMPUTE_MODE:-auto}` so the UI toggle drives it. `auto`/`cpu`/`cuda`/`mps` all accepted.                                  |

The service also validates all `model_id` inputs against the strict HuggingFace `org/name` pattern (rejects path traversal and control characters) and caps every request body field (`content`, `prompt`, `messages`) at a reasonable length to prevent memory-exhaustion DOS. The ai-backend's `POST /api/config/update` endpoint rejects any value containing newlines, carriage returns, or NUL bytes before writing to `.env`, so the compute-mode toggle can't be abused to smuggle arbitrary env vars.

### Self-Hosting

```bash
export DOCKER_BUILDKIT=1
docker compose build --parallel
docker compose up -d
```

The app will be available at [http://localhost:3100](http://localhost:3100).

## Self-Hosting Costs

OpenCut AI runs entirely on your own infrastructure — no per-seat fees, no API metering, no usage limits. The only cost is the server itself.

### Recommended Configurations

| Setup           | Spec                               | Monthly Cost    | Best For                                            |
| --------------- | ---------------------------------- | --------------- | --------------------------------------------------- |
| **Starter**     | 4 vCPU, 8 GB RAM, CPU-only         | **$20–40/mo**   | Light editing, transcription, text commands         |
| **Standard**    | 4 vCPU, 16 GB RAM, CPU-only        | **$40–80/mo**   | Full editing workflow with TTS and transcription    |
| **Performance** | 8 vCPU, 32 GB RAM, NVIDIA T4 GPU   | **$150–250/mo** | Fast transcription, image generation, voice cloning |
| **Production**  | 8 vCPU, 64 GB RAM, NVIDIA A10G GPU | **$300–500/mo** | Teams, concurrent users, all AI features at speed   |

### Where to Host

| Provider         | Starter                | With GPU              | Notes                                   |
| ---------------- | ---------------------- | --------------------- | --------------------------------------- |
| **Hetzner**      | $15/mo                 | $120/mo (A100 hourly) | Best value for CPU instances in EU      |
| **DigitalOcean** | $24/mo                 | N/A                   | Simple setup, no GPU options            |
| **Vultr**        | $24/mo                 | $180/mo (A100 hourly) | GPU cloud available                     |
| **AWS EC2**      | $35/mo (t3.xlarge)     | $150/mo (g4dn.xlarge) | Widest GPU selection                    |
| **GCP**          | $35/mo (e2-standard-4) | $200/mo (T4 GPU)      | Good for teams on Google Cloud          |
| **Lambda Cloud** | N/A                    | $130/mo (A10 GPU)     | GPU-first cloud, best GPU value         |
| **RunPod**       | N/A                    | $80/mo (A4000 GPU)    | Cheapest GPU cloud, community templates |

### What Uses Resources

| Service                 | RAM Usage | CPU Usage                 | GPU Benefit          | Notes                                    |
| ----------------------- | --------- | ------------------------- | -------------------- | ---------------------------------------- |
| Web app (Next.js)       | ~200 MB   | Low                       | None                 | Serves the UI                            |
| PostgreSQL + Redis      | ~300 MB   | Low                       | None                 | Project storage + job queue              |
| AI Backend (FastAPI)    | ~200 MB   | Low                       | None                 | API gateway                              |
| Ollama (LLM)            | 1–5 GB    | Medium                    | 2–5x faster          | Depends on model size                    |
| TurboQuant (LLM)        | 1–3 GB    | Medium                    | 2–5x faster          | 2-bit KV cache, lower memory than Ollama |
| Whisper (transcription) | ~1 GB     | High during transcription | 10x faster           | `base` model uses ~1 GB                  |
| TTS (voice generation)  | ~2 GB     | High during generation    | 5x faster            | XTTS v2, Sarvam AI, Smallest AI          |
| Image generation        | ~3 GB     | Very high                 | Required practically | Stable Diffusion needs GPU               |
| YouTube-to-Reels        | ~500 MB   | High during processing    | Moderate             | yt-dlp + clip detection + face reframe   |
| Engagement scoring      | ~100 MB   | Medium during analysis    | None                 | Hook, energy, face, emotion analysis     |

### Minimum Requirements

- **CPU-only (all features except image gen):** 4 vCPU, 8 GB RAM, 20 GB disk — ~$20/mo
- **With GPU (all features):** 4 vCPU, 16 GB RAM, NVIDIA T4 (16 GB VRAM), 40 GB disk — ~$150/mo
- **Local machine:** Any modern laptop with 16 GB RAM runs everything except image generation comfortably

### Cost Comparison

|                  | OpenCut AI (self-hosted)   | Descript      | Kapwing       | Runway        |
| ---------------- | -------------------------- | ------------- | ------------- | ------------- |
| Monthly cost     | **$20–150** (server only)  | $24–33/user   | $24–79/user   | $12–76/user   |
| Per-seat pricing | **No**                     | Yes           | Yes           | Yes           |
| Usage limits     | **None**                   | Minutes-based | Credits-based | Credits-based |
| Data privacy     | **100% on your server**    | Cloud         | Cloud         | Cloud         |
| AI models        | **Open-source, swappable** | Proprietary   | Proprietary   | Proprietary   |

## Who is this for?

- **Privacy-conscious creators and journalists** — your footage never leaves your machine
- **Enterprises with data sovereignty requirements** — self-host on your own infrastructure
- **Education** — install once in a lab, no per-seat licenses
- **Developers** — fully open source, extend and contribute
- **Subscription-fatigued creators** — pay for a server, not a subscription
- **Indian market** — 22 Indian languages via Sarvam AI is unmatched by any competitor

## Attribution

This project is a fork of [OpenCut](https://github.com/OpenCut-app/OpenCut). We gratefully acknowledge the OpenCut team and all upstream contributors for the core video editor that makes this possible.

## License

[MIT LICENSE](LICENSE)


## ❤️ Support This Project

OpenCut-AI is an independent, open-source project maintained in my free time.  
If it has helped you or saved you time, your support keeps development active and new features coming!

### Ways to Support

<a href="https://buymeacoffee.com/humblefool">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" style="height: 60px !important;width: 217px !important;" />
</a>

<br>

- 💰 [Donate via PayPal](https://paypal.me/humblefool06)

You can also click the **Sponsor** button on the top-right of this repository page (thanks to the `.github/FUNDING.yml` file).

Every contribution — big or small — is deeply appreciated! 🙏  
Thank you for supporting independent open source!
