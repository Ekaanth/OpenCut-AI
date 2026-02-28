## **0.2.0**:

This release adds the foundation for motion and effects.

**Features**:

- Keyframe animation system, starting with transform properties (position, scale, rotation).
- Effects system (with our first effect: Blur!)

**Bug fixes**:

- Fixed an issue where click-and-drag selection on one timeline track could accidentally select items from the track below

**Improvements**:

## **0.1.0**:

This first release focuses on making editing faster, clearer, and more reliable for day-to-day use.

**Features**:

- Rebuilt the properties panel from scratch. Number inputs now support math expressions and click-drag scrubbing instead of just typing values in.
- The properties panel went from a flat list of basic text styles to organized sections: transform, blending, typography, spacing, and background controls. Text elements finally have position, scale, and rotation.
- New color picker with eyedropper, opacity control, and multiple color formats.
- Bookmarks now support notes, color labels, and optional duration to plan scenes more clearly.
- Move, scale, and rotate elements directly in the preview panel.
- Blend modes (Multiply, Screen, Overlay, etc). Only available on text elements for now.
- Paste images, videos, or audio from your clipboard straight into the editor.
- Hold `Shift` while moving or resizing to temporarily turn off snapping.

**Improvements**:

- Expanded font selection from 7 to over 1,000.
- Fonts load much faster.
- All asset panel tabs now share a consistent layout.
- Text rendering properly supports multiple lines, line height, and letter spacing.
- Better contrast in the dark theme.

**Bug fixes**:

- Fixed undo/redo for drag-and-drop so dropped items are reliably undoable.
