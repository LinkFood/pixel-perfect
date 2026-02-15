

# Fix: Chat Not Responding + Tabs Alignment

## Issue 1: Chat Messages Go Into a Black Hole

When you type a message in the upload phase, the code calls the AI interview function. But if that call fails for any reason (network hiccup, edge function timeout, etc.), the error gets swallowed silently -- your message appears but Rabbit never responds.

The root cause is a gap in error handling: `sendMessage` can resolve without producing content (e.g., empty stream, early return), and when that happens, no rabbit reply is ever added to the chat. There is also no timeout -- if the AI takes too long, you just wait forever.

### Fix
- After `sendMessage` completes in the upload/home/mood-picker phase, check if a reply actually came back. If not, show a fallback canned response so the chat never goes silent.
- Add a try/catch that always produces a rabbit reply, even on failure.
- Add a console.log before and after the `sendMessage` call so we can see exactly what happens in future debugging.

**File: `src/pages/PhotoRabbit.tsx`** (lines 346-362 in `handleSend`)

```tsx
// Before sendMessage
console.log("[Chat] Sending message in upload phase, projectId:", activeProjectId);

try {
  setRabbitState("thinking");
  await sendMessage(text, interviewMessages, ...);
  
  // If sendMessage resolved but produced no content,
  // the lastFinishedContent effect won't fire.
  // Give it a moment, then check.
  setTimeout(() => {
    setChatMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === "user") {
        // No rabbit reply came -- use fallback
        return [...prev, { role: "rabbit" as const, content: "I'm still getting to know your photos! Drop more in or hit 'That's all my photos' when you're ready." }];
      }
      return prev;
    });
  }, 8000); // 8 second safety net
} catch {
  setChatMessages(prev => [...prev, { role: "rabbit", content: "Hmm, something glitched. Try that again?" }]);
  scrollToBottom();
}
```

---

## Issue 2: Tabs at the Bottom Look Crooked

The project shelf tabs intentionally rotate each tab by a few degrees (a "stack of papers" effect). This was a design choice, but it makes the tabs look broken/misaligned rather than charming at this size.

### Fix
Remove the rotation animation from the project tabs so they sit flat and aligned.

**File: `src/components/workspace/ProjectShelf.tsx`**

- Remove the `getRotation` function (lines 46-49)
- Remove `animate={{ rotate: getRotation(index) }}` from the motion.button (line 72)
- Keep the hover and tap animations

---

## Summary

| Change | File | What |
|--------|------|------|
| Chat fallback response | `src/pages/PhotoRabbit.tsx` | Add timeout safety net so Rabbit always replies |
| Debug logging | `src/pages/PhotoRabbit.tsx` | Console logs to trace chat flow |
| Fix tab alignment | `src/components/workspace/ProjectShelf.tsx` | Remove rotation from project tabs |

