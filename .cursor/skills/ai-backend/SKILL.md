---
name: ai-backend-dev
description: Guide for building FastAPI endpoints, ML service integrations, and API design for the OpenCut AI backend. Use when creating routes, services, or models in services/ai-backend/.
---

This skill guides development of the OpenCut AI Python backend — a FastAPI service that wraps ML models (Whisper, Stable Diffusion, Ollama, Coqui TTS) and exposes them as clean REST/WebSocket APIs consumed by the Next.js frontend.

## Architecture

```
services/ai-backend/
├── app/
│   ├── main.py           # FastAPI app + CORS + router registration
│   ├── config.py          # Pydantic BaseSettings (env-driven config)
│   ├── routes/            # One file per domain (transcribe, llm, generate, tts, analyze)
│   ├── services/          # ML model wrappers — singleton + lazy loading
│   └── models/            # Pydantic request/response schemas
├── requirements.txt
├── run.py                 # uvicorn entrypoint (port 8420)
└── Dockerfile
```

## Creating a New Endpoint

1. **Define Pydantic models** in `app/models/`:
   ```python
   from pydantic import BaseModel

   class GenerateImageRequest(BaseModel):
       prompt: str
       negative_prompt: str = ""
       width: int = 1920
       height: int = 1080
       steps: int = 20

   class GenerateImageResponse(BaseModel):
       image_url: str
       seed: int
   ```

2. **Create or update the service** in `app/services/`:
   ```python
   class DiffusionService:
       _instance = None
       _pipeline = None

       @classmethod
       def get_instance(cls):
           if cls._instance is None:
               cls._instance = cls()
           return cls._instance

       def load_model(self):
           if self._pipeline is None:
               # Lazy load — only when first needed
               ...

       def unload(self):
           self._pipeline = None
           torch.cuda.empty_cache()

       def generate(self, prompt, **kwargs):
           self.load_model()
           ...
   ```

3. **Create the route** in `app/routes/`:
   ```python
   from fastapi import APIRouter

   router = APIRouter(prefix="/api/generate", tags=["generate"])

   @router.post("/image", response_model=GenerateImageResponse)
   async def generate_image(request: GenerateImageRequest):
       service = DiffusionService.get_instance()
       result = service.generate(request.prompt, ...)
       return GenerateImageResponse(image_url=result.url, seed=result.seed)
   ```

4. **Register in main.py**: `app.include_router(generate_router)`

5. **Add matching TypeScript types** in `apps/web/src/types/ai.ts`

6. **Add client method** in `apps/web/src/lib/ai-client.ts`

## Conventions

- Route prefix: `/api/{domain}/{action}`
- Services use singleton + lazy loading (ML models are expensive)
- Only one GPU-heavy model in memory at a time (model_manager.py handles swapping)
- WebSocket for streaming long operations (transcription, generation):
  ```json
  {"type": "status", "message": "Loading model..."}
  {"type": "progress", "percent": 50}
  {"type": "complete", "data": {...}}
  ```
- Error responses: 400 for bad input, 500 for server errors (never expose stack traces)
- Config via env vars → Pydantic BaseSettings in `app/config.py`
- FFmpeg as system dependency for audio/video processing
