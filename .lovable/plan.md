

# Fix: ChatMessage ref not forwarded + verify app works after photo upload

## Problem
After uploading a photo, the app crashes or becomes unresponsive. Two contributing issues:

1. **ChatMessage forwardRef is incomplete** -- the `ref` parameter is received from `forwardRef` but never attached to the `motion.div` element. When `AnimatePresence` tries to measure or interact with the element via the ref, it gets nothing, which can cause render errors on re-renders triggered by photo upload state changes.

2. **Stale hot-reload cache** -- some of the "Component is not a function" errors may be artifacts of hot module replacement after the previous code changes. A clean rebuild should clear these.

## Fix

### Step 1: Attach the forwarded ref to the motion.div in ChatMessage
In `src/components/workspace/ChatMessage.tsx`, pass the `ref` to the `motion.div`:

```tsx
<motion.div
  ref={ref}   // <-- add this
  initial={{ opacity: 0, y: 12, scale: 0.97 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  ...
```

This is a one-line change on line 16.

### Step 2: Verify the app works
After the fix, test the full flow:
- Navigate to home
- Upload a photo
- Confirm the photo appears in the grid and the rabbit reacts
- Confirm no crash or blank screen

## Technical Details
- File changed: `src/components/workspace/ChatMessage.tsx` (line 16, add `ref={ref}`)
- Root cause: `forwardRef` wraps the component but the ref was never connected to the DOM, causing `AnimatePresence` measurement failures during state transitions triggered by photo upload

