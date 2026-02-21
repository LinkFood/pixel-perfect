import type jsPDF from "jspdf";

// Google Fonts TTF URLs for embedding in PDF
const FONT_URLS = {
  playfairRegular: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.ttf",
  playfairBold: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiunDXbtM.ttf",
  playfairItalic: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtbK-F2rA.ttf",
  jakartaRegular: "https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_KU7NShXUEKi4Rw.ttf",
  jakartaBold: "https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_907NShXUEKi4Rw.ttf",
};

async function loadFontAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

async function registerFonts(doc: jsPDF): Promise<boolean> {
  try {
    const [playfairRegular, playfairBold, playfairItalic, jakartaRegular, jakartaBold] =
      await Promise.all([
        loadFontAsBase64(FONT_URLS.playfairRegular),
        loadFontAsBase64(FONT_URLS.playfairBold),
        loadFontAsBase64(FONT_URLS.playfairItalic),
        loadFontAsBase64(FONT_URLS.jakartaRegular),
        loadFontAsBase64(FONT_URLS.jakartaBold),
      ]);

    if (playfairRegular && playfairBold && playfairItalic && jakartaRegular && jakartaBold) {
      doc.addFileToVFS("PlayfairDisplay-Regular.ttf", playfairRegular);
      doc.addFont("PlayfairDisplay-Regular.ttf", "PlayfairDisplay", "normal");
      doc.addFileToVFS("PlayfairDisplay-Bold.ttf", playfairBold);
      doc.addFont("PlayfairDisplay-Bold.ttf", "PlayfairDisplay", "bold");
      doc.addFileToVFS("PlayfairDisplay-Italic.ttf", playfairItalic);
      doc.addFont("PlayfairDisplay-Italic.ttf", "PlayfairDisplay", "italic");
      doc.addFileToVFS("PlusJakartaSans-Regular.ttf", jakartaRegular);
      doc.addFont("PlusJakartaSans-Regular.ttf", "PlusJakartaSans", "normal");
      doc.addFileToVFS("PlusJakartaSans-Bold.ttf", jakartaBold);
      doc.addFont("PlusJakartaSans-Bold.ttf", "PlusJakartaSans", "bold");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

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
  onProgress?: (stage: string, percent: number) => void;
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
  const lines: string[] = [];
  // Split on newlines first, then word-wrap each paragraph
  const paragraphs = text.split(/\n/);
  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
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
    else lines.push(""); // preserve empty lines
  }
  return lines;
}

export async function generatePdf({ petName, storyPages, galleryPhotos, onProgress }: GeneratePdfOptions) {
  const { default: jsPDF, GState } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [PAGE_SIZE, PAGE_SIZE],
  });

  const textArea = PAGE_SIZE - 2 * SAFE_MARGIN;
  let isFirstPage = true;

  // Cap gallery photos at 30 for memory safety — loading 50+ as base64 can crash mobile browsers
  const cappedGalleryPhotos = galleryPhotos.slice(0, 30);

  onProgress?.("Loading fonts...", 10);

  // Pre-fetch ALL images + fonts in parallel
  const allUrls = [
    ...storyPages.map(p => p.illustrationUrl),
    ...cappedGalleryPhotos.map(p => p.photoUrl),
  ];
  const [imageCache, fontsLoaded] = await Promise.all([
    preloadImages(allUrls),
    registerFonts(doc),
  ]);

  onProgress?.("Images loaded", 30);

  // Font helpers — fall back to helvetica if custom fonts failed to load
  const displayFont = fontsLoaded ? "PlayfairDisplay" : "helvetica";
  const bodyFont = fontsLoaded ? "PlusJakartaSans" : "helvetica";

  // --- Story Pages ---
  let storyPageNumber = 0; // visible page counter (excludes cover, dedication, back_cover)
  for (let i = 0; i < storyPages.length; i++) {
    const page = storyPages[i];
    onProgress?.(`Rendering page ${i+1}...`, 30 + (i / storyPages.length) * 50);
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
        doc.setFont(displayFont, "bold");
        doc.setFontSize(34);
        doc.setTextColor(40, 40, 40);
        const lines = wrapText(doc, page.textContent, textArea - 20);
        const startY = PAGE_SIZE - 85 + ((2 - lines.length) * 19);
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, startY + i * 38, { align: "center" });
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
        doc.setFont(displayFont, "italic");
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
        doc.setFont(bodyFont, "normal");
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
      storyPageNumber++;

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
        doc.setFont(displayFont, "normal");
        doc.setFontSize(fontSize);
        let lines = wrapText(doc, page.textContent, textArea - 40);

        // If text is long (>5 lines), shrink font to fit more
        if (lines.length > 5) {
          fontSize = 12;
          lineHeight = 18;
          doc.setFontSize(fontSize);
          lines = wrapText(doc, page.textContent, textArea - 40);
        }

        const padding = 24; // top + bottom padding
        const pageNumSpace = 20; // room for page number below text
        const overlayHeight = Math.max(100, lines.length * lineHeight + padding * 2 + pageNumSpace);
        const overlayY = PAGE_SIZE - overlayHeight;

        // Semi-transparent overlay bar at bottom, sized to fit text
        doc.setGState(new GState({ opacity: 0.75 }));
        doc.setFillColor(255, 255, 255);
        doc.rect(0, overlayY, PAGE_SIZE, overlayHeight, "F");
        doc.setGState(new GState({ opacity: 1 }));

        doc.setFont(displayFont, "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(40, 40, 40);
        const totalTextHeight = lines.length * lineHeight;
        const startY = overlayY + (overlayHeight - totalTextHeight - pageNumSpace) / 2 + fontSize * 0.4;
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, startY + i * lineHeight, { align: "center" });
        });
      }

      // Page number — small, centered, light gray at bottom
      doc.setFont(bodyFont, "normal");
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text(String(storyPageNumber), PAGE_SIZE / 2, PAGE_SIZE - 14, { align: "center" });
    }
  }

  // --- Photo Gallery Section ---
  if (cappedGalleryPhotos.length > 0) {
    onProgress?.("Adding photo gallery...", 85);
    // Skip gallery title page for 1-2 photos
    if (cappedGalleryPhotos.length > 2) {
      doc.addPage([PAGE_SIZE, PAGE_SIZE]);
      doc.setFillColor(255, 250, 240); // warm cream
      doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      doc.setFont(displayFont, "bold");
      doc.setFontSize(32);
      doc.setTextColor(60, 50, 40);
      doc.text(`The Real ${petName}`, PAGE_SIZE / 2, PAGE_SIZE / 2 - 20, { align: "center" });
      doc.setFont(bodyFont, "normal");
      doc.setFontSize(14);
      doc.setTextColor(120, 110, 100);
      doc.text("The real moments behind the story", PAGE_SIZE / 2, PAGE_SIZE / 2 + 20, { align: "center" });
    }

    // Single photo: full-page hero
    if (cappedGalleryPhotos.length === 1) {
      doc.addPage([PAGE_SIZE, PAGE_SIZE]);
      doc.setFillColor(255, 252, 248);
      doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      const heroImg = imageCache.get(cappedGalleryPhotos[0].photoUrl) ?? null;
      if (heroImg) {
        const margin = 60;
        const size = PAGE_SIZE - 2 * margin;
        doc.addImage(heroImg, "JPEG", margin, margin, size, size);
      }
      if (cappedGalleryPhotos[0].caption) {
        doc.setFont(bodyFont, "normal");
        doc.setFontSize(11);
        doc.setTextColor(100, 90, 80);
        doc.text(cappedGalleryPhotos[0].caption, PAGE_SIZE / 2, PAGE_SIZE - 30, { align: "center", maxWidth: textArea - 40 });
      }
    } else {
    // Photo grid pages — 6 photos per page (2x3)
    for (let i = 0; i < cappedGalleryPhotos.length; i += 6) {
      doc.addPage([PAGE_SIZE, PAGE_SIZE]);
      doc.setFillColor(255, 252, 248);
      doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");

      const batch = cappedGalleryPhotos.slice(i, i + 6);
      const gridMargin = 36;
      const gridGapX = 14;
      const gridGapY = 10;
      const captionSpace = 22; // room for caption below each photo
      const cols = 2;
      const rows = 3;
      const cellWidth = (PAGE_SIZE - 2 * gridMargin - (cols - 1) * gridGapX) / cols;
      const cellHeight = (PAGE_SIZE - 2 * gridMargin - (rows - 1) * (gridGapY + captionSpace)) / rows;
      const cellSize = Math.min(cellWidth, cellHeight);

      for (let j = 0; j < batch.length; j++) {
        const photo = batch[j];
        const col = j % cols;
        const row = Math.floor(j / cols);
        const x = gridMargin + col * (cellSize + gridGapX);
        const y = gridMargin + row * (cellSize + gridGapY + captionSpace);

        const imgData = imageCache.get(photo.photoUrl) ?? null;
        if (imgData) {
          // Shadow/frame effect
          doc.setFillColor(230, 225, 218);
          doc.roundedRect(x - 3, y - 3, cellSize + 6, cellSize + 6, 3, 3, "F");
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x - 1, y - 1, cellSize + 2, cellSize + 2, 2, 2, "F");

          // Aspect-fit: center the image within the square cell
          let iw = cellSize;
          let ih = cellSize;
          try {
            const img = new Image();
            img.src = imgData;
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject();
            });
            iw = img.naturalWidth || cellSize;
            ih = img.naturalHeight || cellSize;
          } catch {
            // Fallback to square if image can't be decoded
          }
          const ratio = Math.min(cellSize / iw, cellSize / ih);
          const drawW = iw * ratio;
          const drawH = ih * ratio;
          const drawX = x + (cellSize - drawW) / 2;
          const drawY = y + (cellSize - drawH) / 2;
          doc.addImage(imgData, "JPEG", drawX, drawY, drawW, drawH);
        }

        // Caption below each photo
        if (photo.caption) {
          doc.setFont(bodyFont, "normal");
          doc.setFontSize(8);
          doc.setTextColor(100, 90, 80);
          const captionLines = wrapText(doc, photo.caption, cellSize - 10);
          captionLines.slice(0, 2).forEach((line, k) => {
            doc.text(line, x + cellSize / 2, y + cellSize + 12 + k * 10, { align: "center" });
          });
        }
      }
    }
    } // close else for multi-photo grid
  }

  onProgress?.("Finalizing PDF...", 95);
  // Download
  const filename = `${petName.replace(/[^a-zA-Z0-9]/g, "_")}_Book.pdf`;
  doc.save(filename);
}
