

# Bug Audit: New Push

## Build Error (blocks compilation)

**`findLastIndex` not available in current TypeScript target (ES2022)**
- File: `src/pages/PhotoRabbit.tsx`, line 932
- `prev.findLastIndex(...)` requires `es2023` or later in the `lib` compiler option
- Fix: Replace with a simple reverse `for` loop that works in all targets

## Console Warnings (non-breaking but noisy)

**Function components cannot be given refs**
- `HeroLanding` and `ChatInput` are rendered inside `AnimatePresence` in `PhotoRabbitInner`, which tries to attach a ref for exit animations
- Both are plain function components -- they need `React.forwardRef` wrapping
- Fix: Wrap both components with `forwardRef` and forward the ref to their root DOM element

## Summary of Changes

### 1. `src/pages/PhotoRabbit.tsx` (line 932)
Replace `prev.findLastIndex(...)` with a backward for-loop:
```typescript
let lastIdx = -1;
for (let i = prev.length - 1; i >= 0; i--) {
  if (prev[i].role === "rabbit" && prev[i].content.includes("Studying")) {
    lastIdx = i;
    break;
  }
}
```

### 2. `src/components/workspace/HeroLanding.tsx`
Wrap the component with `React.forwardRef` and forward the ref to the root `<div ref={heroRef}>` element (merge with existing `heroRef`).

### 3. `src/components/workspace/ChatInput.tsx`
Wrap the component with `React.forwardRef` and forward the ref to the outer container `<div>`.

All three changes are isolated, no ripple effects.
