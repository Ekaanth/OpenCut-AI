---
name: canvas-visual-design
description: Visual design philosophy and techniques for creating video overlays, infographic canvases, and visual compositions at 1920x1080. Covers layout, hierarchy, decorative elements, and how to make overlays that look professional on video content.
---

This skill guides the visual design thinking behind video overlays — how to compose elements at 1920×1080 so they look intentional, professional, and readable when composited over video footage.

## The Challenge

Video overlays are harder than web design because:
1. **The background is unpredictable** — bright, dark, moving, complex
2. **They're temporary** — on screen for 3-10 seconds, must communicate instantly
3. **They're composited** — transparency and blending matter
4. **They're at video resolution** — 1920×1080 means bigger text, bolder elements

## Design Principles for Video Overlays

### 1. Readability Over Everything
The overlay text MUST be readable over any footage. Techniques:
- **High contrast** — white text on dark background or vice versa
- **Background treatment** — semi-transparent box, gradient scrim, or blur
- **Text outline/shadow** — 1-3px outline or drop shadow for text without backgrounds
- **Safe margins** — keep content 60-100px from all edges (broadcast safe area)

### 2. Spatial Hierarchy
At 1920×1080, you have 5 visual zones:

```
┌────────────────────────────────────────┐
│            TOP BAR / TITLE             │  ← Headlines, scene labels
│                                        │
│  LEFT                        RIGHT     │  ← Side callouts, data
│  THIRD                       THIRD     │
│                                        │
│   ─────── LOWER THIRD ────────         │  ← Names, titles, subtitles
└────────────────────────────────────────┘
```

- **Lower third**: names, titles, subtitles (most common)
- **Center**: full-screen statements, quotes, transitions
- **Corners**: logos, timestamps, social handles
- **Top bar**: chapter titles, section labels

### 3. Less is More (per overlay)
Each overlay communicates ONE thing. Not two, not three. One.
- Lower third: Name + title. That's it.
- Stat callout: One number + one label.
- Quote card: One quote + attribution.

If you need to show 5 things, make 5 overlays that appear sequentially.

### 4. Entrance Matters
The first 300ms of an overlay determines if it feels professional or amateur:
- **Slide from direction** — implies motion, energy
- **Fade up** — implies calm, professional
- **Scale + fade** — implies importance, arrival
- **Wipe reveal** — implies cinematic, intentional

Never just "appear" (no animation). Never bounce excessively.

## Composition Techniques

### Accent Elements
Small visual details that elevate a design from "text on screen" to "designed overlay":

- **Accent lines** — 3-4px colored bars alongside text blocks
- **Geometric shapes** — small circles, triangles, or squares as decorative markers
- **Dividers** — thin horizontal or vertical lines separating information
- **Background shapes** — subtle rectangles or pills behind text
- **Gradient accents** — thin gradient strips (not full background gradients)

### Color Strategy for Overlays

**Dark overlays on light video:**
```
Background: rgba(10, 10, 20, 0.85)
Text: #FFFFFF or #F0F0F0
Accent: One bright color (#00FFAA, #FF6B35, etc.)
```

**Glass/blur effect:**
```
Background: rgba(255, 255, 255, 0.1)
Backdrop-filter: blur(20px)
Border: 1px solid rgba(255, 255, 255, 0.15)
Text: #FFFFFF
```

**Solid brand color:**
```
Background: Brand primary at 100% opacity
Text: White or contrasting color
No transparency — clean, bold, confident
```

### Typography at Video Scale

| Element | Font Size (px) | Weight | Letter Spacing |
|---|---|---|---|
| Main name (lower third) | 36-48 | 700 | 0.02em |
| Subtitle/title | 22-30 | 400-500 | 0.03-0.05em |
| Big stat number | 80-120 | 800 | -0.02em |
| Stat label | 20-26 | 400 | 0.06em (uppercase) |
| Body text (lists) | 24-30 | 400 | 0.01em |
| Small label/attribution | 16-20 | 400 | 0.04em |

**Rules:**
- Uppercase sparingly — only for short labels (2-3 words max)
- Letter-spacing wider for small text, tighter for large display text
- Line-height: 1.2 for headlines, 1.4-1.6 for body

## Template Design Recipes

### Lower Third (Name + Title)
```
Position: bottom-left, 60px from left edge, 80px from bottom
Structure: accent bar (4px) | name box (dark) | title box (accent color)
Animation: slide from left, accent bar first, then name, then title (staggered 100ms)
```

### Stat Callout (Big Number + Label)
```
Position: center or center-right
Structure: huge number (80px+) + thin divider line + small label underneath
Animation: number scales in from 0.8, label fades up
```

### Quote Card
```
Position: center, with generous margin
Structure: large opening quote mark (decorative) + quote text + thin line + attribution
Animation: fade in, quote mark slightly before text
```

### Comparison (Two Columns)
```
Position: center, full-width with margins
Structure: left column | center divider with "VS" badge | right column
Animation: columns slide in from opposite sides, divider fades in
```

### List Overlay
```
Position: right third or center
Structure: title + numbered/bulleted items with consistent spacing
Animation: title first, then items stagger in (100ms delay each)
```

## Common Mistakes to Avoid

1. **Too much text** — if it takes more than 3 seconds to read, it's too much
2. **Too many colors** — max 3 colors per overlay (background, text, accent)
3. **Centered everything** — left-alignment is usually more professional
4. **No breathing room** — overcrowded overlays feel amateur
5. **Mismatched fonts** — stick to one font family per overlay (two max)
6. **Ignoring the video** — overlays should complement, not fight the footage
7. **Tiny text** — if it wouldn't be readable on a phone screen, it's too small
