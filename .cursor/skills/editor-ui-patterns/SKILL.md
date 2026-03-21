---
name: editor-ui-patterns
description: Design patterns and conventions for building polished editor panels, dialogs, toolbars, and status bars in the OpenCutAI video editor. Covers shadcn/ui usage, Hugeicons, dark theme, layout, and interaction patterns specific to this project.
---

This skill guides the creation of editor UI — panels, dialogs, toolbars, and status bars — that match the existing OpenCutAI editor's look and feel while maintaining high design quality.

## Tech Stack

- **UI primitives**: shadcn/ui (Dialog, ScrollArea, Tooltip, Button, Card, Badge, Select, Slider, Tabs, etc.)
- **Icons**: `@hugeicons/react` + `@hugeicons/core-free-icons`
- **Animations**: `motion` (framer-motion v12+)
- **Styling**: Tailwind CSS via `cn()` utility (from `@/utils/ui`)
- **State**: Zustand stores accessed directly via hooks

## Available UI Components

From `apps/web/src/components/ui/`:

```
accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb,
button, calendar, card, checkbox, collapsible, color-picker, context-menu,
dialog, dropdown-menu, font-picker, form, hover-card, input-with-back,
input, label, menubar, navigation-menu, number-field, popover, progress,
prose, radio-group, resizable, scroll-area, select, separator, sheet,
skeleton, slider, sonner, spinner, split-button, switch, table, tabs,
textarea, toast, toggle-group, toggle, tooltip
```

## Icon Usage

```tsx
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon, Cancel01Icon, Tick01Icon } from "@hugeicons/core-free-icons";

// In JSX:
<HugeiconsIcon icon={SparklesIcon} className="size-4" />

// Inside Button — use !size-* to override default
<Button>
  <HugeiconsIcon icon={SparklesIcon} className="!size-5" />
  Generate
</Button>
```

## Layout Patterns

### Panel (Side/Bottom)

Panels sit alongside the main editor canvas. They have a header, scrollable body, and optional footer.

```tsx
export function MyPanel({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col h-full border-l bg-background", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Panel title</span>
        <Button variant="ghost" size="icon" className="size-7">
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-3 flex flex-col gap-3">{/* Content */}</div>
      </ScrollArea>

      {/* Footer (optional) */}
      <div className="flex items-center gap-2 p-3 border-t">
        <Button className="flex-1">Action</Button>
      </div>
    </div>
  );
}
```

### Dialog

For modal interactions (image generation, background removal, model wizard).

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Dialog title</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>;
```

### Toolbar Button

Small, icon-forward buttons in the editor toolbar.

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={handleClick}
    >
      <HugeiconsIcon icon={SomeIcon} className="size-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Button label</TooltipContent>
</Tooltip>
```

### Status Bar Item

Small indicators at the bottom or top of the editor.

```tsx
function StatusItem({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "default" | "success" | "warning" | "error";
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div
        className={cn(
          "size-1.5 rounded-full",
          variant === "success" && "bg-green-500",
          variant === "warning" && "bg-yellow-500",
          variant === "error" && "bg-red-500",
          !variant && "bg-muted-foreground",
        )}
      />
      <span>{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
```

## Interaction Patterns

### Confirm Before Apply

AI-generated content (commands, suggestions) MUST preview before applying:

```tsx
<Card>
  <CardContent className="p-3">
    <p className="text-sm">{action.description}</p>
    <div className="flex gap-2 mt-2">
      <Button variant="outline" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" onClick={onApply}>
        Apply
      </Button>
    </div>
  </CardContent>
</Card>
```

### Loading / Streaming States

Long operations show progress with cancel:

```tsx
<div className="flex items-center gap-2">
  <Spinner className="size-3" />
  <span className="text-xs text-muted-foreground">Transcribing... 42%</span>
  <Button variant="ghost" size="icon" className="size-5 ml-auto">
    <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
  </Button>
</div>
```

### Empty States

When a panel has no content yet:

```tsx
<div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
  <HugeiconsIcon icon={SomeIcon} className="size-8 text-muted-foreground/50" />
  <p className="text-sm text-muted-foreground">No transcription yet</p>
  <Button variant="outline" size="sm" onClick={onTranscribe}>
    Transcribe video
  </Button>
</div>
```

## Color/Spacing Conventions

- Background: `bg-background` (dark editor background)
- Cards/panels: `bg-card` or `bg-muted/50`
- Borders: `border` (uses CSS variable)
- Text: `text-foreground` (primary), `text-muted-foreground` (secondary)
- Accent: `text-primary`, `bg-primary`
- Spacing: use `gap-*` between siblings, `p-3` for panel padding
- Icon size in buttons: `size-3.5` to `size-4`
- Font sizes: `text-xs` for labels, `text-sm` for body, `text-base` for headings within panels

## File Organization

```
components/editor/ai/
├── ai-command-panel.tsx        # Chat-style AI command interface
├── ai-panel-wrapper.tsx        # Panel container/layout wrapper
├── ai-status-indicator.tsx     # Green/red connection dot
├── ai-toolbar-buttons.tsx      # Toolbar buttons for AI features
├── background-removal-dialog.tsx
├── filler-removal-bar.tsx
├── image-gen-dialog.tsx
├── index.ts                    # Re-exports all components
├── memory-status-bar.tsx       # GPU/RAM usage indicator
├── model-wizard.tsx            # First-run setup wizard
├── silence-removal-bar.tsx
├── smart-suggestions.tsx       # Proactive suggestion toasts
├── subtitle-style-editor.tsx
├── transcription-panel.tsx     # Transcript text display
└── voiceover-panel.tsx         # TTS generation panel
```

Always re-export new components from `index.ts`.
