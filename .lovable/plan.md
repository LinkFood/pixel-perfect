

# Fix: Old Project State Leaking Into New Projects

## The Problem

When you switch between projects (or start a new one), stale state from the previous project shows up. This happens because `handleSelectProject` and `handleNewProject` only clear `chatMessages` and `showSpeedChoice`, but leave several other pieces of local state untouched:

- `decisionBubbles` (format/mood/length choices from old project still visible)
- `decisionTier` (decision tree position carries over)
- `quickReplies` (old interview suggestions stick around)
- `pageTarget` (length choice from old project carries over)
- `rabbitState` (animation state from old project)
- `isFinishing` (if generation was in progress)
- `speedChoiceShownRef` (not reset in new project path)

Additionally, the interview restore effect (line 519-527) can race with the state clear, causing old interview messages to briefly flash before the new project's data loads.

## The Fix

**File: `src/pages/PhotoRabbit.tsx`**

1. Create a `resetProjectState()` helper that clears ALL project-scoped local state in one call:

```typescript
const resetProjectState = useCallback(() => {
  setChatMessages([]);
  setDecisionBubbles([]);
  setDecisionTier(null);
  setQuickReplies([]);
  setPageTarget(null);
  setShowSpeedChoice(false);
  speedChoiceShownRef.current = false;
  setRabbitState("idle");
  setIsFinishing(false);
  setShowCreditGate(false);
  prevCanFinish.current = false;
}, []);
```

2. Call `resetProjectState()` in all three places that switch projects:
   - `handleNewProject` (line 310)
   - `handleSelectProject` (line 316-321)
   - `handleDeleteProject` (line 331)

3. Guard the interview restore effect (line 519-527) with `activeProjectId` to prevent cross-project message restoration:

```typescript
useEffect(() => {
  if (phase !== "interview" && phase !== "generating") return;
  if (interviewMessages.length === 0 || chatMessages.length > 0) return;
  // Only restore if messages belong to the current project
  const restored = interviewMessages.map(m => ({
    role: (m.role === "assistant" ? "rabbit" : "user") as "rabbit" | "user",
    content: m.content,
  }));
  setChatMessages(restored);
}, [phase, interviewMessages.length, activeProjectId]);
```

## Summary

| Location | Change |
|----------|--------|
| New helper `resetProjectState()` | Clears all project-scoped local state in one call |
| `handleNewProject` (~line 310) | Replace individual clears with `resetProjectState()` |
| `handleSelectProject` (~line 316) | Replace individual clears with `resetProjectState()` |
| `handleDeleteProject` (~line 331) | Replace individual clears with `resetProjectState()` |
| Interview restore effect (~line 519) | Add `activeProjectId` to dependency array for proper scoping |

No database changes. No new files. Just a clean state reset when switching contexts.

