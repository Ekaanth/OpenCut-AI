# Product Hunt Discussion Thread — v0.4.0 Release

> Post as a new thread on the OpenCut AI Product Hunt page using "Start new thread."

---

## Title

v0.4.0 is live: six new AI features — dubbing, background removal, auto B-roll, and more, all on-device

## Body

Hey everyone! Big update just shipped — **v0.4.0**, our largest release yet. Six new AI features, and every one of them runs locally. Your footage still never leaves your machine.

### What's new

- **AI dubbing, fully local** — a new NLLB-200 translation service batch-translates transcripts on-device (Whisper → translate → voice clone → render). Optional Sarvam fallback only for Indian language pairs, if you configure it.
- **Video background removal** — per-frame matting with the result dropped in as a non-destructive alpha layer above your clip. Original stays untouched.
- **Auto B-roll from your own footage** — on-device CLIP search matches each transcript segment to clips you already have and inserts the best match. No stock libraries, no uploads.
- **Multilingual captions** — one-click translation into multiple languages with per-track SRT/VTT export.
- **Edit by speaker** — diarization labels who spoke when; remove, tighten, or isolate a single speaker's segments like text.
- **Automatic multicam sync** — client-side audio cross-correlation aligns camera angles without timecode. Preview offsets with confidence scores, apply in one undoable step.

### Also in this release

- Visual footage search powered by local CLIP embeddings (shipped earlier this spring)
- Thumbnail A/B testing and YouTube virality scoring
- New model support: Sarvam AI, Smallest AI, Kimi K2, Google Gemma
- Hardened upload endpoints, stabilized VPS deployment, and a repaired build/CI pipeline — community contributions from @MikyJ05 and @interfluve-wav landed in this release. Open source works. 🙏

### Why it matters

Every other "AI video editor" asks you to upload raw footage to the cloud. For unreleased material, client work, or anything sensitive, that's a non-starter. We keep wrapping more intelligence around the editor while keeping the architecture boring and private: Docker services on your own hardware, no telemetry, no account required.

Full changelog: /changelog/0.4.0 on the site.

What should we build next — and what would you dub first? 👇
