<table width="100%">
  <tr>
    <td align="left" width="120">
      <img src="apps/web/public/favicon.png" alt="OpenCut AI Logo" width="80" />
    </td>
    <td align="right">
      <h1>OpenCut AI</h1>
      <h3 style="margin-top: -10px;">A fork of <a href="https://github.com/OpenCut-app/OpenCut">OpenCut</a> with AI added on top.</h3>
      <p>Transcribe, generate, edit by text, clone voices — install locally and run everything on your machine.</p>
    </td>
  </tr>
</table>

## What is this?

This project is a fork of [OpenCut](https://github.com/OpenCut-app/OpenCut), the open-source video editor. We've added a full suite of AI capabilities on top of the core editor — transcription, image generation, voice cloning, filler removal, natural language commands, and more. Everything runs locally on your machine. No cloud, no API keys, no subscriptions.

## AI Features (added on top of OpenCut)

- **Virality Score** — Analyze your video's engagement potential before publishing. Scores 7 signals (hook strength, curiosity gap, audio energy, beat sync, face presence, emotional arc, viral potential) and gives a letter grade (A–F) with actionable suggestions.
- **YouTube to Reels** — Paste a YouTube URL to auto-detect the best short-form clips (15–90s), score each clip's engagement, reframe to 9:16 with face tracking, add captions, and export ready-to-upload reels.
- **Edit by text** — Transcribe your video, then edit it like a document. Delete a sentence and the video cuts itself.
- **AI transcription** — Whisper-powered speech-to-text with word-level timestamps, running locally on GPU or CPU.
- **Filler word removal** — Detect and remove "um", "uh", "like", and "you know" in one click.
- **AI image generation** — Generate images from text prompts via Stable Diffusion and place them on the timeline.
- **Voice cloning & TTS** — Clone any voice from a 6-second sample. Generate voiceovers in that voice. Supports [Sarvam AI](https://www.sarvam.ai/) for Indian language voiceovers and [Smallest AI](https://www.smallest.ai/) for low-latency voice generation.
- **Smart subtitles** — One-click subtitle generation with karaoke, pill, and classic styles.
- **Natural language commands** — Control the editor in plain English: "remove the intro", "speed up the middle".
- **Audio denoising** — Clean up background noise from audio tracks.
- **TurboQuant inference** — Optimized LLM inference powered by the [`turboquant-gpu`](https://github.com/DevTechJr/turboquant-gpu) library. KV cache compression down to 2-bit on GPU (via cuTile fused kernels) and 3-bit on CPU, with a user-selectable **Compute Mode** toggle (Auto / CPU / GPU) in Settings → AI Optimization.

## Editor Features (from OpenCut + our additions)

- **Multi-track timeline** — Video, audio, text, sticker, and effect tracks with drag-and-drop.
- **Separate audio** — Extract audio from video into its own track with independent volume control.
- **Freeze frame** — Capture any frame at the playhead and insert it as a still image.
- **Audio properties panel** — Per-element volume (0–200%) with dB readout, mute toggle, and keyframe animation.
- **Frame size presets** — Toggle between 16:9 (YouTube), 9:16 (TikTok/Reels), 1:1 (Instagram), 4:3 above the preview.
- **Real-time preview** — Live canvas rendering with transform and effect support.
- **No watermarks or subscriptions** — Free and open-source.

## Project Structure

```
apps/web/             — Next.js web application
  src/components/     — UI and editor components
  src/hooks/          — Custom React hooks
  src/lib/            — Utility, command, and API logic
  src/stores/         — State management (Zustand)
  src/core/           — Editor core (managers, commands)
  src/services/       — Renderer, storage, video cache
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
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) v2.3+

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
   docker compose up -d
   ```

   **Option B — NVIDIA GPU (turboquant-service runs on CUDA with cuTile kernels):**

   ```bash
   # Verify the host can see the GPU first
   nvidia-smi

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
2. **Passes `TURBOQUANT_EXTRAS=gpu`** as a build arg, which makes the turboquant-service Dockerfile run `pip install "turboquant-gpu[gpu]" --extra-index-url https://pypi.nvidia.com`. This pulls in the cuTile kernel extras from NVIDIA's PyPI mirror.
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
| Build fails on `pip install turboquant-gpu[gpu]`                                     | Host's CUDA driver is older than 13.0, so `cuda-tile` isn't available   | Either upgrade the driver, or drop the `TURBOQUANT_EXTRAS: gpu` build arg (the engine still works via the PyTorch fallback — you just lose cuTile kernels) |
| `/health` shows `"compute_mode": "cpu"` even with the override file                  | Container couldn't see the GPU at startup                               | Check `docker compose exec turboquant-service nvidia-smi`; if that fails, the toolkit/driver isn't wired up                                                |
| Generation works but `compression_ratio` is always `null`                            | `temperature > 0` requests use the sampling fallback path               | Set `temperature=0` in the request to route through `engine.generate()` and get real compression metrics                                                   |
| `RuntimeError: GPUTurboBackend requires CUDA` in turboquant-service logs at startup  | Someone pinned `DEVICE=cuda` on a host without CUDA                     | Unset `DEVICE` or set it to `auto` — the CPU backend will take over                                                                                        |

**Graceful degradation**

The factory in `compute_backends.py` is defensive: if `GPUTurboBackend.__init__` raises (e.g. `turboquant-gpu` not installed, CUDA driver missing, `cuda-tile` extras incompatible), it logs a warning and falls back to `CPUTurboBackend`. The service comes up either way — you'll just see `"backend": "cpu"` in `/health` and the CPU turbo-boost path (thread pinning + MKLDNN + 3-bit metrics probe) kicks in instead.

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

## Attribution

This project is a fork of [OpenCut](https://github.com/OpenCut-app/OpenCut). We gratefully acknowledge the OpenCut team and all upstream contributors for the core video editor that makes this possible.

## License

[MIT LICENSE](LICENSE)
