---
name: video-overlay-templates
description: Create video overlay templates (lower thirds, callouts, titles, transitions) for the OpenCutAI editor. Each template is a React component rendered at 1920x1080 and captured to image via html2canvas for timeline placement.
---

This skill guides creation of video overlay templates — React components that render at 1920×1080, accept structured data props, and can be captured to image for placement on the video timeline.

## Existing Templates

Located in `apps/web/src/lib/infographic-templates/`:

- `lower-third.tsx` — Name + title bar at bottom of frame
- `stat-callout.tsx` — Big number + label
- `comparison.tsx` — Two-column compare
- `step-flow.tsx` — Numbered steps (1 → 2 → 3)
- `quote-card.tsx` — Styled quote with attribution
- `list-overlay.tsx` — Bullet list overlay
- `progress-bar.tsx` — Animated progress/timer

All templates are re-exported via `index.ts` with a `templateConfig` and a `allTemplateConfigs` array.

## Template Architecture

Every template follows this exact structure:

```tsx
import type { CSSProperties, FC } from "react";

// 1. Props interface — typed, all visual props optional with defaults
export interface MyTemplateProps {
  mainText: string; // required data
  subText?: string; // optional data
  primaryColor?: string; // default: dark color
  secondaryColor?: string; // default: accent color
  fontFamily?: string; // default: a specific font
  animation?: "none" | "fade" | "slide"; // animation type
}

// 2. Canvas constants
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// 3. Component — uses inline styles (NOT tailwind) for html2canvas compatibility
export const MyTemplate: FC<MyTemplateProps> = ({
  mainText,
  subText = "Default subtitle",
  primaryColor = "#1a1a2e",
  secondaryColor = "#e94560",
  fontFamily = "Inter, Helvetica, Arial, sans-serif",
  animation = "none",
}) => {
  // Animation CSS via <style> tag for keyframes
  return (
    <div
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        overflow: "hidden",
        fontFamily,
      }}
    >
      {/* Keyframe animations as inline <style> */}
      {/* Template content with absolute positioning */}
    </div>
  );
};

// 4. Template config — metadata for the picker gallery
export const templateConfig = {
  id: "my-template",
  name: "My Template",
  category: "titles" | "data" | "lists" | "quotes" | "progress",
  defaultProps: {
    mainText: "Sample Text",
    // ... all defaults
  },
};
```

## Critical Rules

1. **Inline styles only** — no Tailwind classes. Templates are rendered via `html2canvas` which doesn't process Tailwind
2. **1920×1080 fixed dimensions** — always use `CANVAS_WIDTH` and `CANVAS_HEIGHT` constants
3. **Absolute positioning** — place elements precisely within the canvas
4. **CSS keyframe animations** — defined in inline `<style>` tags, not Motion library
5. **Customizable colors/fonts** — all visual properties as optional props with sensible defaults
6. **Animation prop** — support at minimum `"none" | "fade" | "slide"`
7. **Export both component and templateConfig** — register in `index.ts`

## Template Ideas to Build

### Title & Identity

- **End card** — Subscribe CTA with social handles, channel branding
- **Title card** — Full-screen episode/video title with date and series branding
- **Logo reveal** — Animated company/channel logo with tagline
- **Credits roll** — Scrolling credits with role + name pairs

### Data & Information

- **Timeline/roadmap** — Horizontal or vertical milestones
- **Pie/donut chart** — Animated segment fill with labels
- **Bar chart** — Animated growing bars with values
- **Countdown timer** — Animated countdown with labels
- **Split screen label** — Labels for before/after or A/B comparisons

### Social & Engagement

- **Social proof banner** — Subscriber/follower count with platform icons
- **Poll/vote results** — Animated bar results with percentages
- **Comment highlight** — Styled viewer comment with avatar
- **CTA banner** — "Like & Subscribe" or custom action with animated arrow

### Educational & Explainer

- **Definition card** — Word + pronunciation + definition with accent line
- **Pro/con list** — Two-column with green checkmarks / red X marks
- **Equation/formula** — Styled mathematical or code expression
- **Key takeaway** — Highlighted insight box with icon

### Atmosphere

- **Animated gradient mesh** — Looping color gradients as background
- **Particle field** — Floating dots/shapes as ambient overlay
- **Film grain** — Subtle noise texture overlay
- **Vignette** — Darkened edges for cinematic feel

## Adding a New Template

1. Create `apps/web/src/lib/infographic-templates/{name}.tsx`
2. Follow the architecture pattern above exactly
3. Export component + config from the file
4. Add to `index.ts`:
   ```tsx
   export { MyTemplate, templateConfig as myTemplateConfig } from "./{name}";
   export type { MyTemplateProps } from "./{name}";
   ```
5. Add config to `allTemplateConfigs` array in `index.ts`
6. LLM content generation: add matching schema to `POST /api/generate/infographic` on backend

## Design Philosophy

Templates should look like they belong in a **professional YouTube video or conference keynote**, not a PowerPoint deck from 2005. Think:

- **Bold typography** — large, confident text with tight letter-spacing
- **Intentional whitespace** — don't fill every pixel
- **Accent geometry** — thin lines, small color blocks, subtle shapes as decoration
- **Consistent tone** — each template should feel like it belongs in the same "pack"
- **Entrance animations** — slides, fades, and reveals that feel smooth at 30fps
