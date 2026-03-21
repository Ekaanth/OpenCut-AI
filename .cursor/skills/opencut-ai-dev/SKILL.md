---
name: opencut-ai-dev
description: Full project context for OpenCut AI — architecture, conventions, store shapes, API patterns, and coding standards. Use when working on any OpenCut AI feature to get instant project context.
---

This skill provides complete context for the OpenCut AI project — an AI-enhanced fork of the OpenCut video editor that adds text-based editing, transcription, image generation, voiceover, and natural language commands.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind, shadcn/ui |
| State | Zustand stores |
| Rich Text | Lexical (transcript editing) |
| Backend | FastAPI (Python), uvicorn |
| ML Models | faster-whisper, Ollama, diffusers, Coqui TTS, rembg, noisereduce |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth |
| Package Manager | Bun |
| Containerization | Docker Compose |

## Zustand Store Shapes

### transcript-store.ts
```typescript
{
  segments: TranscriptionSegment[]   // word-level timestamped segments
  isTranscribing: boolean
  progress: number
  language: string
  duration: number
  selectedSegmentIds: string[]
  // Actions: setSegments, addSegment, setTranscribing, setProgress,
  //          deleteSegments, reorderSegments, selectSegment, clearSelection,
  //          getTimeRangeForSegments, reset
}
```

### ai-store.ts
```typescript
{
  isConnected: boolean        // AI backend health
  activeModel: string | null  // currently loaded ML model
  memoryStatus: MemoryStatus  // GPU/RAM usage
  commandHistory: AICommand[] // natural language command history
  suggestions: AISuggestion[] // smart suggestions
}
```

## TypeScript Types (types/ai.ts)

Key types:
- `TranscriptionSegment` — `{ id, start, end, text, words: TranscriptionWord[] }`
- `TranscriptionWord` — `{ word, start, end, confidence }`
- `TranscriptionResult` — `{ segments, language, duration }`
- `EditorAction` — union type for all LLM-generated actions (REMOVE_SEGMENTS, ADD_SUBTITLE_TRACK, ADD_IMAGE_OVERLAY, TRIM_CLIP, etc.)
- `ImageGenParams` — `{ prompt, negative_prompt, width, height, steps, guidance_scale }`
- `LLMCommandResult` — `{ actions: EditorAction[], explanation: string }`

## API Endpoints (services/ai-backend)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Backend health check |
| POST | `/api/transcribe` | Upload audio/video → transcription |
| WS | `/ws/transcribe` | Streaming transcription progress |
| GET | `/api/llm/status` | Ollama status + model list |
| POST | `/api/llm/command` | Natural language → editor actions |
| POST | `/api/analyze/fillers` | Detect filler words |
| POST | `/api/analyze/silences` | Detect silence regions |
| POST | `/api/analyze/structure` | Chapter detection |
| POST | `/api/analyze/suggestions` | Smart suggestions |
| POST | `/api/generate/image` | Image generation |
| POST | `/api/generate/enhance-prompt` | LLM prompt enhancement |
| POST | `/api/generate/remove-bg` | Background removal |
| POST | `/api/generate/infographic` | Infographic content generation |
| POST | `/api/tts/generate` | Text-to-speech |
| POST | `/api/tts/clone-voice` | Voice cloning |
| POST | `/api/audio/denoise` | Audio noise reduction |
| GET | `/api/system/memory` | GPU/RAM status |

## Coding Conventions

### TypeScript / React
- Destructured props: `function Component({ prop }: { prop: string })`
- `cn()` for all className — never template literals
- Zustand selectors for high-frequency stores
- Components access stores directly (no prop drilling)
- File order: constants → utils → main component → sub-components
- Booleans: `isSomething`, `hasSomething`, `shouldSomething`
- No abbreviations: `element` not `el`, `event` not `e`
- Comments explain WHY, not WHAT — lowercase

### Python / FastAPI
- Singleton services with lazy model loading
- Pydantic for all request/response models
- One router file per domain
- Config via Pydantic BaseSettings
- Clean error responses (400/500, no stack traces)

## Issue Tracker

Full 31-issue tracker: `opencut-ai-issues-with-skills.md` (repo root)
Phases: Foundation → Transcription → Text Editing → LLM + Image → Audio AI → Polish
