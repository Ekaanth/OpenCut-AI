# Effects & WebGL Renderer

## How to add a new effect

1. Create a new file in `apps/web/src/lib/effects/definitions/` (e.g. `brightness.ts`)
2. Export an `EffectDefinition` — see `blur.ts` as a reference
3. Register it in `apps/web/src/lib/effects/definitions/index.ts`

An effect definition has:
- `type` — unique string identifier
- `name` — display name
- `keywords` — for search
- `params` — user-facing controls (sliders, toggles, etc.)
- `renderer` — always `webgl`

All effects use WebGL. Even simple single-value effects like brightness or contrast are trivial shaders — there's no reason to leave the GPU pipeline for them.

## Single-pass vs multi-pass

The `webgl` renderer supports a `passes` array. Single-pass effects (e.g. color grading) just have one entry. Multi-pass is needed when an effect has to process its own output — blur (H then V), bloom (extract → blur → composite), glow, etc.

```typescript
renderer: {
  type: "webgl",
  passes: [
    { fragmentShader: myShader, uniforms: ({ effectParams }) => ({ ... }) },
  ],
}
```

All WebGL rendering — both the main renderer and the effect preview — goes through `applyMultiPassEffect` in `apps/web/src/services/renderer/webgl-utils.ts`. Don't add a new rendering path somewhere else; update that function if needed.

## Writing fragment shaders

Shaders live in `apps/web/src/lib/effects/definitions/`. The shared vertex shader (`effect.vert.glsl`) maps clip space to UV coordinates — don't replace it unless you have a specific reason.

Available uniforms (automatically injected, no need to pass them manually):
- `u_texture` — the input texture (sampler2D)
- `u_resolution` — canvas size in pixels (vec2)

Any additional uniforms come from the `uniforms()` function in the pass definition.

**Sampling density — the most common mistake**

Always use a step of 1 texel when sampling neighbors. Do not scale the step size with the blur radius or intensity — it creates visible discrete artifacts (ghosting/glow look) because there are large gaps between samples that the GPU fills with linear interpolation instead of your intended curve.

```glsl
// correct — step is always 1 texel, loop count controls radius
for (int i = -30; i <= 30; i++) {
  color += texture2D(u_texture, v_texCoord + texelSize * u_direction * float(i)) * weight;
}

// wrong — stepping 6 texels at a time looks ghosty at high intensity
vec2 offset = texelSize * u_direction * u_radius;
color += texture2D(u_texture, v_texCoord + offset * 2.0) * someWeight;
```

If you need a large radius with a fixed kernel size, increase the number of samples rather than the step.

## Y-flip and coordinate systems

Source textures (uploaded from canvas) are Y-flipped via `UNPACK_FLIP_Y_WEBGL`. Intermediate FBO textures (rendered by WebGL between passes) are not. In practice this cancels out correctly as long as you use the shared vertex shader — it maps clip space Y consistently so both texture types sample correctly.

If you write a custom vertex shader or do manual coordinate math, be aware that canvas and WebGL have opposite Y origins (canvas: top-left, WebGL: bottom-left). Getting this wrong produces an upside-down result with no obvious error.
