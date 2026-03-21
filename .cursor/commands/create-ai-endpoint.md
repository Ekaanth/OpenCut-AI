# Create AI Backend Endpoint

Create a new FastAPI endpoint in the AI backend.

## Instructions

1. Create the route file in `services/ai-backend/app/routes/` if it doesn't exist
2. Create Pydantic request/response models in `services/ai-backend/app/models/`
3. Create or update the service in `services/ai-backend/app/services/`
4. Register the router in `services/ai-backend/app/main.py`
5. Add matching TypeScript types in `apps/web/src/types/ai.ts`
6. Add client method in `apps/web/src/lib/ai-client.ts`

## Conventions

- Route pattern: `/api/{domain}/{action}`
- Services: singleton with lazy model loading
- Heavy ML models: load on first use, `unload()` to free GPU/RAM
- Return structured JSON matching the frontend TypeScript types
- 400 for invalid input, 500 for server errors (no stack traces)
- Long operations: use WebSocket with `{"type": "status|progress|segment|complete", ...}`

## Input

Endpoint description: {{endpoint}}
