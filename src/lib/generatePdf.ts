import type jsPDF from "jspdf";

interface StoryPage {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationUrl: string | null;
}

interface GalleryPhoto {
  photoUrl: string;
  caption: string | null;
}

interface GeneratePdfOptions {
  petName: string;
  storyPages: StoryPage[];
  galleryPhotos: GalleryPhoto[];
}

// 8.5" x 8.5" in points (72 points per inch)
const PAGE_SIZE = 612;
const BLEED = 9; // 0.125" bleed
const SAFE_MARGIN = 27; // 0.375" safe area for text

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Pre-fetch all image URLs in parallel and return a lookup map */
async function preloadImages(urls: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter(Boolean))] as string[];
  const results = await Promise.all(unique.map(async (url) => {
    const data = await loadImageAsDataUrl(url);
    return [url, data] as const;
  }));
  const map = new Map<string, string>();
  for (const [url, data] of results) {
    if (data) map.set(url, data);
  }
  return map;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = doc.getTextWidth(testLine);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generatePdf({ petName, storyPages, galleryPhotos }: GeneratePdfOptions) {
  const { default: jsPDF, GState } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [PAGE_SIZE, PAGE_SIZE],
  });

  const textArea = PAGE_SIZE - 2 * SAFE_MARGIN;
  let isFirstPage = true;

  // Pre-fetch ALL images in parallel (story + gallery)
  const allUrls = [
    ...storyPages.map(p => p.illustrationUrl),
    ...galleryPhotos.map(p => p.photoUrl),
  ];
  const imageCache = await preloadImages(allUrls);

  // --- Story Pages ---
  for (const page of storyPages) {
    if (!isFirstPage) doc.addPage([PAGE_SIZE, PAGE_SIZE]);
    isFirstPage = false;

    const imgData = page.illustrationUrl ? (imageCache.get(page.illustrationUrl) ?? null) : null;

    if (page.pageType === "cover") {
      // Cover: full illustration with overlays to hide AI-generated text artifacts
      if (imgData) {
        doc.addImage(imgData, "PNG", 0, 0, PAGE_SIZE, PAGE_SIZE);
        // Top overlay to hide garbled AI text in illustration
        doc.setGState(new GState({ opacity: 0.85 }));
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, PAGE_SIZE, 140, "F");
        doc.setGState(new GState({ opacity: 1 }));
      } else {
        doc.setFillColor(255, 248, 235); // warm cream
        doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      }
      // Title overlay at bottom
      if (page.textContent) {
        doc.setGState(new GState({ opacity: 0.75 }));
        doc.setFillColor(255, 255, 255);
        doc.rect(0, PAGE_SIZE - 130, PAGE_SIZE, 130, "F");
        doc.setGState(new GState({ opacity: 1 }));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(28);
        doc.setTextColor(40, 40, 40);
        const lines = wrapText(doc, page.textContent, textArea);
        const startY = PAGE_SIZE - 80 + ((2 - lines.length) * 16);
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, startY + i * 32, { align: "center" });
        });
      }
    } else if (page.pageType === "dedication") {
      // Dedication: full-page soft overlay to hide AI text artifacts, centered text
      if (imgData) {
        doc.addImage(imgData, "PNG", 0, 0, PAGE_SIZE, PAGE_SIZE);
        // Full-page semi-transparent overlay so garbled AI text is hidden
        doc.setGState(new GState({ opacity: 0.88 }));
        doc.setFillColor(255, 252, 245);
        doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
        doc.setGState(new GState({ opacity: 1 }));
      } else {
        doc.setFillColor(255, 250, 240);
        doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      }
      if (page.textContent) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(18);
        doc.setTextColor(80, 70, 60);
        const lines = wrapText(doc, page.textContent, textArea - 60);
        const startY = PAGE_SIZE / 2 - (lines.length * 14);
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, startY + i * 28, { align: "center" });
        });
      }
    } else if (page.pageType === "back_cover") {
      // Back cover: full illustration or solid color
      if (imgData) {
        doc.addImage(imgData, "PNG", 0, 0, PAGE_SIZE, PAGE_SIZE);
      } else {
        doc.setFillColor(255, 248, 235);
        doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      }
      if (page.textContent) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        const lines = wrapText(doc, page.textContent, textArea - 40);
        const startY = PAGE_SIZE - 80;
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, startY + i * 18, { align: "center" });
        });
      }
    } else {
      // Story / closing pages: full-bleed illustration with text overlay at bottom
      if (imgData) {
        doc.addImage(imgData, "PNG", 0, 0, PAGE_SIZE, PAGE_SIZE);
      } else {
        doc.setFillColor(245, 240, 230);
        doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      }

      if (page.textContent) {
        // Auto-size: measure text first, then size the overlay to fit
        let fontSize = 15;
        let lineHeight = 22;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        let lines = wrapText(doc, page.textContent, textArea - 30);

        // If text is long (>5 lines), shrink font to fit more
        if (lines.length > 5) {
          fontSize = 12;
          lineHeight = 18;
          doc.setFontSize(fontSize);
          lines = wrapText(doc, page.textContent, textArea - 30);
        }

        const padding = 24; // top + bottom padding
        const overlayHeight = Math.max(100, lines.length * lineHeight + padding * 2);
        const overlayY = PAGE_SIZE - overlayHeight;

        // Semi-transparent overlay bar at bottom, sized to fit text
        doc.setGState(new GState({ opacity: 0.75 }));
        doc.setFillColor(255, 255, 255);
        doc.rect(0, overlayY, PAGE_SIZE, overlayHeight, "F");
        doc.setGState(new GState({ opacity: 1 }));

        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(40, 40, 40);
        const totalTextHeight = lines.length * lineHeight;
        const startY = overlayY + (overlayHeight - totalTextHeight) / 2 + fontSize * 0.4;
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, startY + i * lineHeight, { align: "center" });
        });
      }
    }
  }

  // --- Photo Gallery Section ---
  if (galleryPhotos.length > 0) {
    // Gallery title page
    doc.addPage([PAGE_SIZE, PAGE_SIZE]);
    doc.setFillColor(255, 250, 240); // warm cream
    doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.setTextColor(60, 50, 40);
    doc.text(`The Real ${petName}`, PAGE_SIZE / 2, PAGE_SIZE / 2 - 20, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    doc.setTextColor(120, 110, 100);
    doc.text("The real moments behind the story", PAGE_SIZE / 2, PAGE_SIZE / 2 + 20, { align: "center" });

    // Photo grid pages — 4 photos per page (2x2)
    for (let i = 0; i < galleryPhotos.length; i += 4) {
      doc.addPage([PAGE_SIZE, PAGE_SIZE]);
      doc.setFillColor(255, 252, 248);
      doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");

      const batch = galleryPhotos.slice(i, i + 4);
      const gridMargin = 40;
      const gridGap = 16;
      const cellSize = (PAGE_SIZE - 2 * gridMargin - gridGap) / 2;

      for (let j = 0; j < batch.length; j++) {
        const photo = batch[j];
        const col = j % 2;
        const row = Math.floor(j / 2);
        const x = gridMargin + col * (cellSize + gridGap);
        const y = gridMargin + row * (cellSize + gridGap + 30); // 30pt for caption space

        const imgData = imageCache.get(photo.photoUrl) ?? null;
        if (imgData) {
          // Shadow/frame effect
          doc.setFillColor(230, 225, 218);
          doc.roundedRect(x - 3, y - 3, cellSize + 6, cellSize + 6, 3, 3, "F");
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x - 1, y - 1, cellSize + 2, cellSize + 2, 2, 2, "F");

          doc.addImage(imgData, "JPEG", x, y, cellSize, cellSize);
        }

        // Caption below each photo
        if (photo.caption) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          doc.setTextColor(100, 90, 80);
          const captionLines = wrapText(doc, photo.caption, cellSize - 10);
          captionLines.slice(0, 2).forEach((line, k) => {
            doc.text(line, x + cellSize / 2, y + cellSize + 14 + k * 12, { align: "center" });
          });
        }
      }
    }
  }

  // Download
  const filename = `${petName.replace(/[^a-zA-Z0-9]/g, "_")}_Book.pdf`;
  doc.save(filename);
}
