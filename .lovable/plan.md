

# Reject Unsupported Photo Formats at Upload

## What's Changing
When a user tries to upload photos in formats the app can't use (like HEIC from iPhones), they'll see a friendly message explaining the issue. The unsupported files won't be stored at all — saving storage space and avoiding broken images in the final book.

## Why
These formats can't be used anywhere in the app:
- The AI can't analyze them for captions or appearance profiling
- Browsers can't display them in the photo gallery or the final printed book
- Storing them wastes space and creates confusion

## How It Works

### 1. Filter files in `UploadZone.tsx`
- In both the drag-and-drop handler and the file picker handler, filter files by MIME type (jpeg, png, webp, gif)
- If any files are rejected, show a toast: "X photo(s) can't be used. Please use JPG, PNG, or WebP."
- Only pass supported files through to the upload logic
- Import `toast` from sonner

### 2. Keep existing safety nets
- The `accept` attribute on the file input already limits the picker (added in the last edit)
- The server-side check in `describe-photo` stays as a fallback
- No other files need to change

---

## Technical Details

**File: `src/components/project/UploadZone.tsx`**

Update `handleDrop`:
```typescript
const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const supported = files.filter(f => supportedTypes.includes(f.type));
const rejected = files.length - supported.length;
if (rejected > 0) {
  toast.error(`${rejected} photo(s) can't be used. Please use JPG, PNG, or WebP.`);
}
if (supported.length) onFilesSelected(supported);
```

Apply the same filtering in `handleFileInput`.

No changes to backend functions, hooks, or other components needed.

