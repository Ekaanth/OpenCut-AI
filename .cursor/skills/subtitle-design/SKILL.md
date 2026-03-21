---
name: subtitle-design
description: Design and implement subtitle styles, presets, and word-level animations for the OpenCutAI video editor. Covers CapCut-style animated captions, karaoke effects, and custom subtitle styling.
---

This skill guides creation of subtitle styles, animation effects, and preset systems for the OpenCutAI video editor's auto-subtitle feature.

## Existing Implementation

- **Style editor**: `apps/web/src/components/editor/ai/subtitle-style-editor.tsx`
- **Types**: `SubtitleStyle`, `SubtitlePreset`, `SubtitlePosition`, `SubtitleAnimation`
- **Backend**: `POST /api/transcribe/subtitles` (SRT/VTT/ASS export)

### Current Presets

- **CapCut** — Bold, bounce animation, black semi-transparent background
- **Classic** — White text, black outline, bottom center, fade
- **Modern** — Clean outline only, no background, slide animation
- **Karaoke** — Impact font, word-by-word color fill, centered

## Subtitle Style Schema

```typescript
interface SubtitleStyle {
  fontFamily: string;
  fontSize: number; // 12-64
  textColor: string; // hex
  backgroundColor: string; // hex or "transparent"
  backgroundOpacity: number; // 0-1
  outlineColor: string; // hex
  outlineWidth: number; // 0-5
  position: "top" | "center" | "bottom";
  animation: "none" | "fade" | "slide" | "typewriter" | "bounce" | "karaoke";
}
```

## Animation Types Explained

| Animation    | Effect                                  | Implementation                                                                  |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------------- |
| `none`       | Static text                             | No animation                                                                    |
| `fade`       | Opacity 0→1 per segment                 | CSS `@keyframes fadeIn`                                                         |
| `slide`      | Slide up from below                     | CSS `translateY` transition                                                     |
| `typewriter` | Characters appear left-to-right         | Delayed `opacity` per character                                                 |
| `bounce`     | Scale up with overshoot, then settle    | CSS `@keyframes bounceIn` with elastic easing                                   |
| `karaoke`    | Word-by-word color fill synced to audio | Per-word `clip-path` or color transition timed to `TranscriptionWord.start/end` |

## Creating New Subtitle Presets

A good preset needs:

1. **Distinct visual identity** — instantly recognizable
2. **Readability** — works over both light and dark video content
3. **Appropriate animation** — matches the vibe (professional = fade, energetic = bounce)
4. **Font choice** — the font IS the personality

### Preset Ideas

**Neon Glow**

```typescript
{
  fontFamily: "Orbitron",
  fontSize: 28,
  textColor: "#00FFAA",
  backgroundColor: "transparent",
  backgroundOpacity: 0,
  outlineColor: "#00FFAA",
  outlineWidth: 1,
  position: "bottom",
  animation: "fade",
  // Extra: CSS text-shadow glow effect
}
```

**Cinematic**

```typescript
{
  fontFamily: "Playfair Display",
  fontSize: 20,
  textColor: "#F5F0E8",
  backgroundColor: "transparent",
  backgroundOpacity: 0,
  outlineColor: "#000000",
  outlineWidth: 1,
  position: "bottom",
  animation: "fade",
  // Extra: letter-spacing 0.15em, thin elegant font
}
```

**Street / Hype**

```typescript
{
  fontFamily: "Bebas Neue",
  fontSize: 42,
  textColor: "#FFFFFF",
  backgroundColor: "#FF0040",
  backgroundOpacity: 0.9,
  outlineColor: "transparent",
  outlineWidth: 0,
  position: "center",
  animation: "bounce",
  // Extra: uppercase, tight padding, punchy
}
```

**Handwritten**

```typescript
{
  fontFamily: "Caveat",
  fontSize: 32,
  textColor: "#2D2D2D",
  backgroundColor: "#FFF9C4",
  backgroundOpacity: 0.85,
  outlineColor: "transparent",
  outlineWidth: 0,
  position: "bottom",
  animation: "typewriter",
  // Extra: slightly rotated, sticky-note feel
}
```

**Minimal Pill**

```typescript
{
  fontFamily: "DM Sans",
  fontSize: 18,
  textColor: "#FFFFFF",
  backgroundColor: "#1A1A1A",
  backgroundOpacity: 0.75,
  outlineColor: "transparent",
  outlineWidth: 0,
  position: "bottom",
  animation: "slide",
  // Extra: large border-radius, tight fit
}
```

## Word-Level Animation (Karaoke)

The key to CapCut-style subtitles is word-level timing from `TranscriptionWord`:

```typescript
interface TranscriptionWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number;
}
```

### Rendering approach:

1. Each word is a `<span>` with a computed style based on current playback time
2. Words before `currentTime` → fully highlighted
3. Active word → partial fill (clip-path or gradient)
4. Words after → default/dimmed

```tsx
function KaraokeWord({ word, currentTime, highlightColor, baseColor }) {
  const progress = Math.min(
    1,
    Math.max(0, (currentTime - word.start) / (word.end - word.start)),
  );

  return (
    <span
      style={{
        background: `linear-gradient(90deg,
        ${highlightColor} ${progress * 100}%,
        ${baseColor} ${progress * 100}%)`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {word.word}
    </span>
  );
}
```

## UI Conventions

- Preview: render subtitle over a dark `aspect-video` container
- Preset selector: grid of cards with name + short description
- Custom controls: font, size, colors, position, animation — all via shadcn/ui
- Use `cn()` for className composition
- Color inputs: native `<input type="color">` + hex text input
- Sliders for size, opacity, outline width
