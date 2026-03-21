# Create AI Editor Component

Create a new AI-related React component for the OpenCutAI editor.

## Instructions

1. Create the component in `apps/web/src/components/editor/ai/`
2. Export it from `apps/web/src/components/editor/ai/index.ts`
3. Use shadcn/ui primitives (Dialog, ScrollArea, Tooltip, Button, etc.)
4. Use `cn()` for all className composition
5. Use Zustand store hooks directly in sub-components (don't prop-drill)
6. Use selectors for high-frequency stores: `useStore((s) => s.value)`
7. Use Motion library for animations
8. If the component needs AI backend data, use existing hooks (`use-ai-status`, `use-ai-command`, `use-transcription`)
9. Match the dark editor theme — avoid generic AI aesthetics

## File Structure

```
// constants (top)
const SOME_CONSTANT = ...

// utils (if needed)
function someHelper({ ... }: { ... }) { ... }

// main component
export function MyComponent() { ... }

// sub-components (bottom)
function SubComponent() { ... }
```

## Naming

- Component files: kebab-case (`ai-command-panel.tsx`)
- Components: PascalCase (`AICommandPanel`)
- Hooks: `use-{name}.ts`
- Booleans: `isSomething`, `hasSomething`, `shouldSomething`

## Input

Component description: {{component}}
