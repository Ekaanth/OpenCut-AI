# Actions System

Actions are the trigger layer for user-initiated operations. They connect keyboard shortcuts, UI buttons, and context menus to editor functionality.

## Adding a New Action

### 1. Define the action — `src/lib/actions/definitions.ts`

Add an entry to the `ACTIONS` object:

```typescript
"my-action": {
    description: "What it does",
    category: "editing",           // playback | navigation | editing | selection | history | timeline | controls
    defaultShortcuts: ["ctrl+m"],  // optional
    args: { someValue: "number" }, // optional, only if it takes args
},
```

### 2. Register the handler — `src/hooks/actions/use-editor-actions.ts`

```typescript
useActionHandler(
    "my-action",
    () => {
        editor.timeline.doSomething();
    },
    undefined, // isActive: MutableRefObject<boolean> | boolean | undefined
);
```

### 3. Register arg types (if needed) — `src/lib/actions/types.ts`

Only required if your action accepts arguments:

```typescript
export type TActionArgsMap = {
    // ...existing actions...
    "my-action": { someValue: number } | undefined; // | undefined = optional args
};
```

## Invoking Actions

Use `invokeAction` for any user-triggered operation (buttons, context menus, etc.):

```typescript
import { invokeAction } from "@/lib/actions";

invokeAction("my-action");
invokeAction("seek-forward", { seconds: 5 });
```

Avoid calling `editor.xxx()` directly from UI components — that bypasses the action layer (toasts, validation feedback, keybinding support).

## The `isActive` parameter

The third argument to `useActionHandler` controls when the handler is active:

- `undefined` — always active
- `true` / `false` — statically enabled/disabled
- `MutableRefObject<boolean>` — reactive, toggled at runtime (e.g. only active when a panel is focused)
