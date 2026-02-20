
# Making Share Links Work — Before Publishing

## The Honest Situation

The app is NOT published yet, so the published URL (`https://2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app`) does not exist yet. That means there is currently **no public URL** that bypasses Lovable's auth wall.

Here's the breakdown of the three URLs:

| URL | Auth Wall? | Can Use? |
|-----|-----------|---------|
| `https://2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovableproject.com/...` | Yes — Lovable login | No good |
| `https://id-preview--2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app/...` | Yes — Lovable login | No good |
| `https://2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app/...` | **No — fully public** | ✅ This is the one |

The third URL — the **published** URL — only exists after you click Publish. Until then, share links cannot reach non-Lovable users no matter what code changes are made. The auth wall is enforced at Lovable's infrastructure level, not in your app's code.

**The good news:** Your app's code — the `SharedBookViewer`, the `get-shared-book` edge function, the `/book/:shareToken` route — is all already correctly set up for public access. Nothing is broken there. It just needs the published URL to serve it from.

## What I'll Fix In Code Right Now

Even though you're not publishing yet, I'll wire everything up correctly so that the moment you do hit Publish, share links work instantly and correctly for everyone.

### Fix 1 — `BookReview.tsx`: Update APP_BASE to the correct published URL

Currently the fallback is the preview URL (with `id-preview--` prefix). That's wrong. The published URL drops that prefix:

```typescript
// BEFORE (wrong — still has auth wall)
const APP_BASE = import.meta.env.VITE_APP_URL
  || "https://id-preview--2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app";

// AFTER (correct — this is the public URL after publishing)
const APP_BASE = import.meta.env.VITE_APP_URL
  || "https://2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app";
```

This means every share link generated will point to the correct public address. The moment you publish, they work.

### Fix 2 — `share-page` edge function: Fix the APP_URL fallback

The social-media preview redirect currently falls back to a completely wrong URL (`pixel-perfect.lovable.app`). Fix it to match the correct published URL:

```typescript
// BEFORE
const APP_URL = Deno.env.get("SITE_URL") || "https://pixel-perfect.lovable.app";

// AFTER
const APP_URL = Deno.env.get("SITE_URL") || "https://2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app";
```

This ensures when someone shares a link on iMessage/Twitter/Facebook, the preview card and redirect both use the correct public URL.

## How You'll Test It (Before Publishing)

You personally can test the full share flow right now because you have Lovable access. When you generate a share link in your book and open it, it opens in your authenticated session — you can verify the book loads correctly, the gift wrap gate works, the book flips through, everything looks right.

The only thing you cannot test before publishing is the recipient experience (no-auth). For that, you need to publish.

## The Moment You're Ready to Publish

1. Click **Publish** in the top-right of the editor
2. The public URL `https://2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app` activates
3. Every share link already in your database instantly works for anyone in the world
4. Send one to your phone (logged out of Lovable) — it opens directly to the gift wrap gate

## Files to Change

| File | Line | Change |
|------|------|--------|
| `src/components/project/BookReview.tsx` | 85 | Change `id-preview--` prefix URL to the published URL (no prefix) |
| `supabase/functions/share-page/index.ts` | 16 | Change `pixel-perfect.lovable.app` fallback to the correct published URL |

Two one-line changes. Everything else is already correctly built.
