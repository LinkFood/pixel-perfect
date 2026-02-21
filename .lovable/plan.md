

# Fix Remaining forwardRef Warnings

The app compiles and runs fine. Two console warnings remain — the same pattern we fixed last round for HeroLanding and ChatInput.

## Warning 1: PhotoThumb in PhotoUploadInline.tsx

`PhotoThumb` is rendered inside an `AnimatePresence` block, which tries to attach a ref for exit animations. It's a plain function component and needs `forwardRef`.

**Change**: Wrap `PhotoThumb` (lines 6-21) with `React.forwardRef`, forwarding the ref to a wrapper `div` (or the `<>` fragment needs to become a `div` so there's a DOM node to attach the ref to).

## Warning 2: SleepZzz in RabbitCharacter.tsx

`SleepZzz` (line 307) is conditionally rendered inside an `AnimatePresence`-like context in `RabbitCharacter`. It's a plain function component returning a `<g>` SVG group.

**Change**: Wrap `SleepZzz` with `React.forwardRef` and forward the ref to the root `<g>` element.

## Summary

| File | Component | Fix |
|------|-----------|-----|
| `src/components/workspace/PhotoUploadInline.tsx` | `PhotoThumb` | Wrap with `forwardRef`, convert fragment to `div` for ref target |
| `src/components/rabbit/RabbitCharacter.tsx` | `SleepZzz` | Wrap with `forwardRef`, forward ref to `<g>` |

Both changes are isolated, no ripple effects. After this, the console should be clean of ref warnings.

