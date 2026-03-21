---
name: motion-design
description: Create animations, transitions, and micro-interactions for the OpenCutAI editor UI and video overlays. Covers Motion (framer-motion) for React components, CSS keyframes for video templates, and animation timing best practices.
---

This skill guides animation and motion design for both the editor UI (React components) and video overlay templates (CSS keyframes).

## Two Animation Systems

### 1. Editor UI — Motion library (framer-motion)

For React component animations: panel reveals, toast notifications, drag interactions, status transitions.

**Package**: `motion` (v12+) — already installed in the project.

```tsx
import { motion, AnimatePresence } from "motion/react";

// Panel slide-in
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  <Panel />
</motion.div>

// Staggered list reveal
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.05 } },
  }}
>
  {items.map((item) => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
    />
  ))}
</motion.div>
```

### 2. Video Templates — CSS @keyframes

For infographic overlays rendered at 1920×1080 via html2canvas. Must use inline `<style>` tags.

```tsx
<style>{`
  @keyframes slideInLeft {
    from { transform: translateX(-100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`}</style>
```

## Animation Patterns for the Editor

### Panel Transitions

```tsx
// Slide panel (command panel, text panel, voiceover panel)
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
    />
  )}
</AnimatePresence>
```

### Toast / Suggestion Notifications

```tsx
<motion.div
  initial={{ opacity: 0, y: 40, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: 20, scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 30 }}
/>
```

### Action Preview Cards (AI Command Panel)

```tsx
// Card entering the chat
<motion.div
  initial={{ opacity: 0, height: 0 }}
  animate={{ opacity: 1, height: "auto" }}
  transition={{ duration: 0.3 }}
>
  <ActionPreviewCard />
</motion.div>

// Status change (pending → applied)
<motion.div
  animate={{
    backgroundColor: status === "applied" ? "#10B981" : "#6B7280",
  }}
  transition={{ duration: 0.3 }}
/>
```

### Progress / Loading States

```tsx
// Transcription progress bar with spring physics
<motion.div
  className="h-1 bg-primary rounded-full"
  initial={{ width: "0%" }}
  animate={{ width: `${progress}%` }}
  transition={{ type: "spring", stiffness: 100, damping: 20 }}
/>

// Streaming text segments appearing
<motion.p
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.15 }}
>
  {segment.text}
</motion.p>
```

### Drag Interactions (Transcript Reorder)

```tsx
import { Reorder } from "motion/react";

<Reorder.Group values={segments} onReorder={setSegments}>
  {segments.map((segment) => (
    <Reorder.Item key={segment.id} value={segment}>
      <SegmentRow segment={segment} />
    </Reorder.Item>
  ))}
</Reorder.Group>;
```

## Animation for Video Templates

### Entrance Animations

Every template should support at minimum:

| Animation    | Keyframe                     | Duration | Use Case             |
| ------------ | ---------------------------- | -------- | -------------------- |
| `fade`       | Opacity 0→1                  | 0.4-0.6s | Professional, subtle |
| `slide`      | TranslateX -100%→0           | 0.4-0.5s | Dynamic, directional |
| `slideUp`    | TranslateY 100%→0            | 0.3-0.5s | Lower thirds         |
| `scaleIn`    | Scale 0.8→1 + opacity        | 0.3-0.4s | Callouts, stats      |
| `typewriter` | Reveal characters left→right | Variable | Quotes, definitions  |
| `wipeIn`     | Clip-path reveal             | 0.5-0.7s | Cinematic            |

### Stagger Pattern for Multi-Element Templates

```css
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Element 1 */
animation: fadeSlideUp 0.4s ease-out 0s forwards;
/* Element 2 */
animation: fadeSlideUp 0.4s ease-out 0.1s forwards;
/* Element 3 */
animation: fadeSlideUp 0.4s ease-out 0.2s forwards;
```

### Word-Level Animation (Subtitles)

Karaoke and typewriter effects need per-word or per-character timing synced to `TranscriptionWord.start/end` timestamps. See the `subtitle-design` skill for implementation details.

## Timing and Easing Guidelines

### Easing Functions

| Name        | CSS                                    | Feel                 |
| ----------- | -------------------------------------- | -------------------- |
| Ease out    | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Natural deceleration |
| Ease in-out | `cubic-bezier(0.42, 0, 0.58, 1)`       | Smooth both ways     |
| Overshoot   | `cubic-bezier(0.34, 1.56, 0.64, 1)`    | Bouncy, playful      |
| Snappy      | `cubic-bezier(0.16, 1, 0.3, 1)`        | Quick, decisive      |

### Duration Guidelines

| Context                          | Duration             |
| -------------------------------- | -------------------- |
| Micro-interaction (hover, focus) | 100-150ms            |
| UI panel open/close              | 200-300ms            |
| Toast notification               | 300-400ms            |
| Video template entrance          | 400-700ms            |
| Video template stagger delay     | 80-150ms per element |

### Rules

- Never animate layout properties (width, height, top, left) in the editor — use `transform` and `opacity`
- Use `will-change: transform` sparingly and only during active animations
- Motion library's `layout` animations are allowed for reorder effects
- Keep exit animations faster than enter animations (0.7× duration)
- `AnimatePresence` required for exit animations
