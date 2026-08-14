# Product Hunt Launch Kit — OpenCut AI

Ready-to-paste materials for the launch. Nothing here has been posted anywhere yet.

## Product

- **Name:** OpenCut AI
- **Website:** https://opencut-ai.vercel.app (update to your live domain)
- **Topics:** Video Editing, Artificial Intelligence, Open Source, Privacy

## Tagline (max 60 chars)

```
The privacy-first AI video editor that runs on your machine
```

Alternates:

- `AI video editing that never uploads your footage` (50)
- `Descript energy. CapCut speed. Zero cloud.` (43)

## Description (max 260 chars)

```
OpenCut AI is an open-source video editor with a full AI suite — transcription, text-based editing, dubbing, B-roll, captions, background removal and multicam sync — running locally on your machine. Your footage never leaves it.
```

## Maker's first comment

```
Hey Product Hunters! 👋

I built OpenCut AI because every AI video editor asks you to upload your raw footage to someone else's cloud. For creators working on unreleased material, client work, or anything sensitive, that's a dealbreaker.

OpenCut AI is a fork of the wonderful open-source OpenCut editor, wrapped in a full local AI pipeline:

🎬 What's in 0.4.0 (launching today):
• Whisper transcription with word-level timestamps — edit video by deleting text
• AI dubbing with fully-local NLLB-200 translation (no cloud round-trip)
• Auto B-roll pulled from your own footage via on-device CLIP search
• Background removal (per-frame matting, inserted non-destructively)
• Multilingual captions with SRT/VTT export
• Edit-by-speaker and automatic multicam sync via audio cross-correlation

🔒 How it stays private:
Everything — transcription, translation, matting, CLIP embeddings — runs in Docker services on your own machine. There's no telemetry, no analytics, no account required. Cloud providers (Sarvam, Smallest AI) are optional fallbacks you configure yourself, mainly for Indian-language work.

🛠 Under the hood:
Next.js + React editor core, FastAPI microservices (Whisper, XTTS, NLLB, rembg, CLIP), Web Audio cross-correlation for multicam, IndexedDB for the visual-search index. MIT-friendly open source — link in the repo.

Self-host free, or grab a GPU server tier if you don't want to babysit Docker.

Questions, feature requests, and "why did you fork" stories all welcome — I'll be here all day. 🙏
```

## Launch checklist

- [ ] Record 30–60s demo video: import clip → transcribe → delete words → auto B-roll → dub to Hindi → multicam apply
- [ ] Gallery: hero screenshot of editor + timeline, caption close-up, multicam offset preview, architecture diagram
- [ ] Set launch date; avoid Mon AM PT saturation if possible (Tue–Thu 12:01 AM PT)
- [ ] Line up 5–10 friendly users for genuine early upvotes/comments (no vote brigading)
- [ ] Cross-post to the LinkedIn post and X/Twitter thread the same morning
- [ ] Update the website domain in tagline links before submitting
