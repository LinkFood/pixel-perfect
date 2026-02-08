

# Generate a PhotoRabbit Logo

Create a simple edge function to generate a watercolor rabbit logo on demand, matching the illustration style used in the storybooks.

## What I'll Do

1. **Create a `generate-logo` edge function** that calls the same AI image gateway (`google/gemini-3-pro-image-preview`) with a prompt specifically crafted for a logo-friendly watercolor rabbit
2. **Return the image directly** as a base64 data URL so you can download it right away

## The Prompt

```
A single adorable rabbit sitting upright, facing slightly left, in soft 
watercolor style with gentle ink outlines. Warm golden lighting, 
amber/cream palette. Simple, clean composition on a pure white 
background with no other elements. No text, no words, no letters. 
Suitable as a brand mascot/logo. Square 1:1 composition.
```

## Technical Details

- New file: `supabase/functions/generate-logo/index.ts`
- Uses `LOVABLE_API_KEY` (already configured) with `google/gemini-3-pro-image-preview`
- Same `extractImageData` + magic byte validation logic from the existing illustration function
- Public endpoint (no auth needed, it's a one-off tool for you)
- Update `supabase/config.toml` to include the new function
- After deploying, I'll call it and show you the result so you can grab it

