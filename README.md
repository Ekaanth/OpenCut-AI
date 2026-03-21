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

- **Edit by text** — Transcribe your video, then edit it like a document. Delete a sentence and the video cuts itself.
- **AI transcription** — Whisper-powered speech-to-text with word-level timestamps, running locally on GPU or CPU.
- **Filler word removal** — Detect and remove "um", "uh", "like", and "you know" in one click.
- **AI image generation** — Generate images from text prompts via Stable Diffusion and place them on the timeline.
- **Voice cloning & TTS** — Clone any voice from a 6-second sample. Generate voiceovers in that voice.
- **Smart subtitles** — One-click subtitle generation with karaoke, pill, and classic styles.
- **Natural language commands** — Control the editor in plain English: "remove the intro", "speed up the middle".
- **Audio denoising** — Clean up background noise from audio tracks.

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
services/ai-backend/  — FastAPI AI backend (Whisper, TTS, Ollama, Stable Diffusion)
packages/             — Shared packages (env, UI)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation)
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

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

3. Start the database, Redis, and AI backend:

   ```bash
   docker compose up -d
   ```

4. Install dependencies and start the dev server:

   ```bash
   bun install
   bun dev:web
   ```

The editor will be available at [http://localhost:3000](http://localhost:3000).

### AI Backend

The AI backend runs as a FastAPI service on port 8420. It powers transcription, image generation, voice cloning, TTS, audio analysis, and LLM commands.

```bash
# Start with Docker (recommended)
docker compose up -d

# Or run standalone
cd services/ai-backend
python run.py
```

Configure AI models in the **Settings > AI Models** panel inside the editor.

### Self-Hosting

```bash
docker compose up -d
```

The app will be available at [http://localhost:3100](http://localhost:3100).

## Self-Hosting Costs

OpenCut AI runs entirely on your own infrastructure — no per-seat fees, no API metering, no usage limits. The only cost is the server itself.

### Recommended Configurations

| Setup | Spec | Monthly Cost | Best For |
|-------|------|-------------|----------|
| **Starter** | 4 vCPU, 8 GB RAM, CPU-only | **$20–40/mo** | Light editing, transcription, text commands |
| **Standard** | 4 vCPU, 16 GB RAM, CPU-only | **$40–80/mo** | Full editing workflow with TTS and transcription |
| **Performance** | 8 vCPU, 32 GB RAM, NVIDIA T4 GPU | **$150–250/mo** | Fast transcription, image generation, voice cloning |
| **Production** | 8 vCPU, 64 GB RAM, NVIDIA A10G GPU | **$300–500/mo** | Teams, concurrent users, all AI features at speed |

### Where to Host

| Provider | Starter | With GPU | Notes |
|----------|---------|----------|-------|
| **Hetzner** | $15/mo | $120/mo (A100 hourly) | Best value for CPU instances in EU |
| **DigitalOcean** | $24/mo | N/A | Simple setup, no GPU options |
| **Vultr** | $24/mo | $180/mo (A100 hourly) | GPU cloud available |
| **AWS EC2** | $35/mo (t3.xlarge) | $150/mo (g4dn.xlarge) | Widest GPU selection |
| **GCP** | $35/mo (e2-standard-4) | $200/mo (T4 GPU) | Good for teams on Google Cloud |
| **Lambda Cloud** | N/A | $130/mo (A10 GPU) | GPU-first cloud, best GPU value |
| **RunPod** | N/A | $80/mo (A4000 GPU) | Cheapest GPU cloud, community templates |

### What Uses Resources

| Service | RAM Usage | CPU Usage | GPU Benefit | Notes |
|---------|-----------|-----------|-------------|-------|
| Web app (Next.js) | ~200 MB | Low | None | Serves the UI |
| PostgreSQL + Redis | ~300 MB | Low | None | Project storage |
| AI Backend (FastAPI) | ~200 MB | Low | None | API gateway |
| Ollama (LLM) | 1–5 GB | Medium | 2–5x faster | Depends on model size |
| Whisper (transcription) | ~1 GB | High during transcription | 10x faster | `base` model uses ~1 GB |
| TTS (voice generation) | ~2 GB | High during generation | 5x faster | XTTS v2 is ~1.8 GB |
| Image generation | ~3 GB | Very high | Required practically | Stable Diffusion needs GPU |

### Minimum Requirements

- **CPU-only (all features except image gen):** 4 vCPU, 8 GB RAM, 20 GB disk — ~$20/mo
- **With GPU (all features):** 4 vCPU, 16 GB RAM, NVIDIA T4 (16 GB VRAM), 40 GB disk — ~$150/mo
- **Local machine:** Any modern laptop with 16 GB RAM runs everything except image generation comfortably

### Cost Comparison

| | OpenCut AI (self-hosted) | Descript | Kapwing | Runway |
|---|---|---|---|---|
| Monthly cost | **$20–150** (server only) | $24–33/user | $24–79/user | $12–76/user |
| Per-seat pricing | **No** | Yes | Yes | Yes |
| Usage limits | **None** | Minutes-based | Credits-based | Credits-based |
| Data privacy | **100% on your server** | Cloud | Cloud | Cloud |
| AI models | **Open-source, swappable** | Proprietary | Proprietary | Proprietary |

## Attribution

This project is a fork of [OpenCut](https://github.com/OpenCut-app/OpenCut). We gratefully acknowledge the OpenCut team and all upstream contributors for the core video editor that makes this possible.

## License

[MIT LICENSE](LICENSE)
