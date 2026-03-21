# Create Zustand Store

Create a new Zustand store for the OpenCutAI editor.

## Instructions

1. Create the store in `apps/web/src/stores/`
2. Follow the existing store patterns in the project
3. Define types in `apps/web/src/types/` if they don't exist
4. State should be serializable (no functions, class instances, or DOM refs in state)
5. Actions go in the store, not in components

## Conventions

- Store name: `{domain}-store.ts` (e.g., `transcript-store.ts`)
- Hook export: `use{Domain}Store` (e.g., `useTranscriptStore`)
- High-frequency stores (timeline, playback, selections): consumers MUST use selectors

  ```ts
  // ✅ correct
  const segments = useTranscriptStore((s) => s.segments);

  // ❌ wrong — causes re-renders on every state change
  const { segments } = useTranscriptStore();
  ```

- Components access store methods directly — never pass them as props
- Include a `reset()` action for cleanup between projects

## Input

Store description: {{store}}
