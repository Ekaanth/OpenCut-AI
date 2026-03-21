---
name: theme-system
description: Create cohesive color and typography themes for OpenCut AI components — infographic templates, subtitle presets, UI panels, and overlays. Ensures visual consistency across all generated content.
---

This skill guides creation of cohesive visual themes that can be applied across infographic templates, subtitle styles, and UI panels in OpenCut AI.

## What is a Theme

A theme is a coordinated set of:
- **Color palette** — primary, secondary, accent, background, text colors
- **Typography** — display font + body font pairing
- **Spacing feel** — tight/dense vs. generous/airy
- **Mood** — the emotional tone (professional, playful, cinematic, bold, etc.)

## Theme Structure

```typescript
interface VideoTheme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;        // main brand/accent color
    secondary: string;      // supporting color
    accent: string;         // highlight, CTA, emphasis
    background: string;     // overlay/card background
    backgroundAlt: string;  // secondary background
    text: string;           // primary text
    textMuted: string;      // secondary/dimmed text
    border: string;         // subtle borders
  };
  typography: {
    displayFont: string;    // headlines, big numbers
    bodyFont: string;       // body text, labels
    monoFont: string;       // code, timestamps
  };
  borderRadius: "none" | "sm" | "md" | "lg" | "full";
  style: "minimal" | "bold" | "elegant" | "playful" | "brutalist";
}
```

## Built-In Themes

### Corporate Clean
```typescript
{
  colors: {
    primary: "#1B2A4A",
    secondary: "#4A90D9",
    accent: "#00C9A7",
    background: "#FFFFFF",
    backgroundAlt: "#F4F6F9",
    text: "#1B2A4A",
    textMuted: "#8899AA",
    border: "#E2E8F0",
  },
  typography: {
    displayFont: "DM Sans",
    bodyFont: "Inter",
    monoFont: "JetBrains Mono",
  },
  borderRadius: "md",
  style: "minimal",
}
```

### Midnight Studio
```typescript
{
  colors: {
    primary: "#E8E0D4",
    secondary: "#C9A96E",
    accent: "#FF6B35",
    background: "#0D0D0D",
    backgroundAlt: "#1A1A1A",
    text: "#E8E0D4",
    textMuted: "#6B6358",
    border: "#2A2520",
  },
  typography: {
    displayFont: "Playfair Display",
    bodyFont: "Source Sans 3",
    monoFont: "Fira Code",
  },
  borderRadius: "sm",
  style: "elegant",
}
```

### Neon Pulse
```typescript
{
  colors: {
    primary: "#00FFAA",
    secondary: "#7B61FF",
    accent: "#FF2D78",
    background: "#0A0A0F",
    backgroundAlt: "#12121A",
    text: "#EAEAEF",
    textMuted: "#6B6B80",
    border: "#1F1F2E",
  },
  typography: {
    displayFont: "Orbitron",
    bodyFont: "Space Grotesk",
    monoFont: "IBM Plex Mono",
  },
  borderRadius: "lg",
  style: "bold",
}
```

### Warm Editorial
```typescript
{
  colors: {
    primary: "#2C1810",
    secondary: "#8B4513",
    accent: "#D4A373",
    background: "#FDF8F0",
    backgroundAlt: "#F5EDE0",
    text: "#2C1810",
    textMuted: "#8B7355",
    border: "#E8DDD0",
  },
  typography: {
    displayFont: "Fraunces",
    bodyFont: "Lora",
    monoFont: "Courier Prime",
  },
  borderRadius: "sm",
  style: "elegant",
}
```

### Hyper Pop
```typescript
{
  colors: {
    primary: "#FF0055",
    secondary: "#00D4FF",
    accent: "#FFE500",
    background: "#FFFFFF",
    backgroundAlt: "#F0F0F0",
    text: "#0A0A0A",
    textMuted: "#666666",
    border: "#E0E0E0",
  },
  typography: {
    displayFont: "Bebas Neue",
    bodyFont: "Rubik",
    monoFont: "Inconsolata",
  },
  borderRadius: "none",
  style: "brutalist",
}
```

## Applying Themes

### To Infographic Templates
Templates use inline styles. Map theme colors to template props:
```tsx
<LowerThird
  name="John Doe"
  title="CEO"
  primaryColor={theme.colors.background}
  secondaryColor={theme.colors.accent}
  fontFamily={theme.typography.displayFont}
/>
```

### To Subtitle Styles
Map theme to `SubtitleStyle`:
```tsx
const themedSubtitle: SubtitleStyle = {
  fontFamily: theme.typography.displayFont,
  fontSize: 28,
  textColor: theme.colors.text,
  backgroundColor: theme.colors.background,
  backgroundOpacity: 0.8,
  outlineColor: theme.colors.primary,
  outlineWidth: 1,
  position: "bottom",
  animation: "fade",
};
```

### To UI Panels
Use CSS variables that map to the editor's existing theming:
```tsx
<div style={{
  "--panel-bg": theme.colors.backgroundAlt,
  "--panel-text": theme.colors.text,
  "--panel-accent": theme.colors.accent,
} as React.CSSProperties}>
```

## Font Pairing Guidelines

Strong pairings create hierarchy and contrast:

| Display (headlines) | Body (text) | Vibe |
|---|---|---|
| Bebas Neue | DM Sans | Bold, energetic |
| Playfair Display | Source Sans 3 | Elegant, editorial |
| Orbitron | Space Grotesk | Futuristic, tech |
| Fraunces | Lora | Warm, literary |
| Cabinet Grotesk | Inter | Clean, modern |
| Syne | Outfit | Artistic, creative |
| Instrument Serif | Instrument Sans | Sophisticated, balanced |

**Rules:**
- Never pair two serif fonts or two display fonts
- Display fonts for impact (titles, big numbers), body fonts for readability
- Load fonts via Google Fonts `<link>` for templates, `next/font` for UI
- Always include fallback stack: `"DisplayFont, Helvetica, Arial, sans-serif"`

## Creating New Themes

1. Start with a mood/reference (film poster, album art, design reference)
2. Pick 2-3 dominant colors — one dark, one light, one accent
3. Choose a font pairing that matches the mood
4. Test at 1920×1080 with real content (not lorem ipsum)
5. Verify readability: text over both light and dark video backgrounds
6. Apply to at least 2 templates and 1 subtitle preset to verify coherence
