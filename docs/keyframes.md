# Keyframe System

Keyframes allow element properties to change over time. The system is split into three layers: the **data model** (how keyframes are stored), the **registry** (which properties support keyframes and how to read/write them), and the **UI** (hooks and components that wire it all together).

## How It Works

### Data model

Every `BaseTimelineElement` has an optional `animations?: ElementAnimations` field:

```typescript
interface ElementAnimations {
    channels: Record<string, AnimationChannel | undefined>;
}
```

A channel is a typed bucket of keyframes keyed by property path (e.g. `"opacity"`, `"background.color"`). Three channel types exist: `NumberAnimationChannel`, `ColorAnimationChannel`, and `DiscreteAnimationChannel`.

### Registry

`src/lib/animation/property-registry.ts` defines which property paths are animatable and how to read/write their values on an element. `src/types/animation.ts` holds the canonical list of valid paths in `ANIMATION_PROPERTY_PATHS`.

### Resolver

`src/lib/animation/resolve.ts` provides functions that return the effective value of a property at a given local time — falling back to the element's static value when no keyframes exist.

### Renderer

Nodes in `src/services/renderer/` call the resolve functions before drawing so that animated properties interpolate correctly during export and preview.

### UI

Two hooks in `src/components/editor/panels/properties/hooks/` handle the keyframe-aware field logic:

- `useKeyframedNumberProperty` — for numeric fields (opacity, position, scale, etc.)
- `useKeyframedColorProperty` — for color pickers

Both hooks handle the toggle/add/remove keyframe flow and automatically switch between writing to the static property and writing to the animation channel depending on whether keyframes are active.

---

## Adding a New Animatable Property

Using `"background.paddingX"` as an example.

### 1. Register the path — `src/types/animation.ts`

```typescript
export const ANIMATION_PROPERTY_PATHS = [
    // ...existing paths
    "background.paddingX",
] as const;
```

### 2. Add a registry entry — `src/lib/animation/property-registry.ts`

```typescript
"background.paddingX": {
    valueKind: "number",          // "number" | "color" | "discrete"
    defaultInterpolation: "linear",
    numericRange: { min: 0 },     // optional, only for number properties
    supportsElement: ({ element }) => element.type === "text",
    getValue: ({ element }) =>
        element.type === "text"
            ? (element.background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX)
            : null,
    setValue: ({ element, value }) =>
        element.type === "text"
            ? { ...element, background: { ...element.background, paddingX: value as number } }
            : element,
},
```

**Notes:**
- `getValue` must return the effective value including any defaults — this is what gets recorded when a keyframe is added.
- `setValue` receives `AnimationValue` (`number | string | boolean`). Cast to the correct type since `coerceAnimationValueForProperty` already validated it upstream.
- For color properties, use `valueKind: "color"` and cast `value as string`.

### 3. Add a resolve function — `src/lib/animation/resolve.ts`

For **numbers**, use the existing generic `resolveNumberAtTime`:

```typescript
import { resolveNumberAtTime } from "@/lib/animation";

const resolvedPaddingX = resolveNumberAtTime({
    baseValue: element.background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX,
    animations: element.animations,
    propertyPath: "background.paddingX",
    localTime,
});
```

For **colors**, use `resolveColorAtTime`:

```typescript
const resolvedColor = resolveColorAtTime({
    baseColor: element.color,
    animations: element.animations,
    propertyPath: "color",
    localTime,
});
```

If neither fits (new value kind), add a dedicated resolve function following the same pattern as `resolveOpacityAtTime` and export it from `src/lib/animation/index.ts`.

### 4. Wire the renderer

In the relevant node (`src/services/renderer/nodes/`), call the resolve function before drawing:

```typescript
const resolvedPaddingX = resolveNumberAtTime({
    baseValue: this.params.background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX,
    animations: this.params.animations,
    propertyPath: "background.paddingX",
    localTime,
});
```

Use the resolved value (not `this.params.*`) anywhere that value affects rendering.

### 5. Wire the UI

In the properties panel, replace `usePropertyDraft` with the appropriate keyframe hook and add a `KeyframeToggle` to the field.

**For number fields:**

```typescript
const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
    startTime: element.startTime,
    duration: element.duration,
});

const resolvedPaddingX = resolveNumberAtTime({
    baseValue: element.background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX,
    animations: element.animations,
    propertyPath: "background.paddingX",
    localTime,
});

const paddingX = useKeyframedNumberProperty({
    trackId,
    elementId: element.id,
    animations: element.animations,
    propertyPath: "background.paddingX",
    localTime,
    isPlayheadWithinElementRange,
    displayValue: Math.round(resolvedPaddingX).toString(),
    parse: (input) => {
        const parsed = parseFloat(input);
        return Number.isNaN(parsed) ? null : Math.max(0, Math.round(parsed));
    },
    valueAtPlayhead: resolvedPaddingX,
    buildBaseUpdates: ({ value }) => ({
        background: { ...element.background, paddingX: value },
    }),
});
```

In JSX:

```tsx
<SectionField
    label="Width"
    beforeLabel={
        <KeyframeToggle
            isActive={paddingX.isKeyframedAtTime}
            isDisabled={!isPlayheadWithinElementRange}
            title="Toggle background width keyframe"
            onToggle={paddingX.toggleKeyframe}
        />
    }
>
    <NumberField
        value={paddingX.displayValue}
        onFocus={paddingX.onFocus}
        onChange={paddingX.onChange}
        onBlur={paddingX.onBlur}
        onScrub={paddingX.scrubTo}
        onScrubEnd={paddingX.commitScrub}
        onReset={() => paddingX.commitValue({ value: DEFAULT_TEXT_BACKGROUND.paddingX })}
        isDefault={isPropertyAtDefault({
            hasAnimatedKeyframes: paddingX.hasAnimatedKeyframes,
            isPlayheadWithinElementRange,
            resolvedValue: resolvedPaddingX,
            staticValue: element.background.paddingX ?? DEFAULT_TEXT_BACKGROUND.paddingX,
            defaultValue: DEFAULT_TEXT_BACKGROUND.paddingX,
        })}
    />
</SectionField>
```

**For color fields**, use `useKeyframedColorProperty` instead. It returns `{ onChange, onChangeEnd, toggleKeyframe, isKeyframedAtTime }` — wire `onChange({ color })` and `onChangeEnd` directly to the `ColorPicker`.

---

## Checklist

- [ ] Path added to `ANIMATION_PROPERTY_PATHS`
- [ ] Registry entry added with correct `valueKind`, `supportsElement`, `getValue`, `setValue`
- [ ] Resolve call added in the renderer node
- [ ] UI field uses `useKeyframedNumberProperty` or `useKeyframedColorProperty` (not `usePropertyDraft`)
- [ ] `KeyframeToggle` added to the `SectionField`
- [ ] `onReset` calls `commitValue` (not `editor.timeline.updateElements` directly)
