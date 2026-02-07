import jsPDF from "jspdf";

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
    const response = await fetch(url);
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
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [PAGE_SIZE, PAGE_SIZE],
  });

  const textArea = PAGE_SIZE - 2 * SAFE_MARGIN;
  let isFirstPage = true;

  // --- Story Pages ---
  for (const page of storyPages) {
    if (!isFirstPage) doc.addPage([PAGE_SIZE, PAGE_SIZE]);
    isFirstPage = false;

    const imgData = page.illustrationUrl ? await loadImageAsDataUrl(page.illustrationUrl) : null;

    if (page.pageType === "cover") {
      // Cover: full illustration with title overlay
      if (imgData) {
        doc.addImage(imgData, "PNG", 0, 0, PAGE_SIZE, PAGE_SIZE);
      } else {
        doc.setFillColor(255, 248, 235); // warm cream
        doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      }
      // Title overlay at bottom
      if (page.textContent) {
        doc.setFillColor(255, 255, 255, 0.7);
        doc.rect(0, PAGE_SIZE - 120, PAGE_SIZE, 120, "F");
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
      // Dedication: centered text, soft background
      if (imgData) {
        doc.addImage(imgData, "PNG", 0, 0, PAGE_SIZE, PAGE_SIZE);
        doc.setFillColor(255, 255, 255, 0.85);
        doc.rect(SAFE_MARGIN, PAGE_SIZE * 0.3, textArea, PAGE_SIZE * 0.4, "F");
      } else {
        doc.setFillColor(255, 250, 240);
        doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");
      }
      if (page.textContent) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(16);
        doc.setTextColor(80, 80, 80);
        const lines = wrapText(doc, page.textContent, textArea - 60);
        const startY = PAGE_SIZE / 2 - (lines.length * 12);
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, startY + i * 24, { align: "center" });
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
      // Story / closing pages: top 70% illustration, bottom 30% text
      const illustrationHeight = PAGE_SIZE * 0.7;
      const textAreaHeight = PAGE_SIZE * 0.3;

      if (imgData) {
        doc.addImage(imgData, "PNG", 0, 0, PAGE_SIZE, illustrationHeight);
      } else {
        doc.setFillColor(245, 240, 230);
        doc.rect(0, 0, PAGE_SIZE, illustrationHeight, "F");
      }

      // Text area with white background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, illustrationHeight, PAGE_SIZE, textAreaHeight, "F");

      if (page.textContent) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.setTextColor(50, 50, 50);
        const lines = wrapText(doc, page.textContent, textArea - 20);
        const lineHeight = 22;
        const totalTextHeight = lines.length * lineHeight;
        const startY = illustrationHeight + (textAreaHeight - totalTextHeight) / 2 + 10;
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
    doc.text("Just as they really were", PAGE_SIZE / 2, PAGE_SIZE / 2 + 20, { align: "center" });

    // Individual photo pages
    for (const photo of galleryPhotos) {
      doc.addPage([PAGE_SIZE, PAGE_SIZE]);
      doc.setFillColor(255, 252, 248); // very light warm white
      doc.rect(0, 0, PAGE_SIZE, PAGE_SIZE, "F");

      const imgData = await loadImageAsDataUrl(photo.photoUrl);
      if (imgData) {
        // Photo centered with frame effect
        const photoMargin = 60;
        const photoSize = PAGE_SIZE - 2 * photoMargin;
        const photoTop = photo.caption ? 50 : (PAGE_SIZE - photoSize) / 2;

        // Shadow/frame effect
        doc.setFillColor(230, 225, 218);
        doc.roundedRect(photoMargin - 4, photoTop - 4, photoSize + 8, photoSize + 8, 4, 4, "F");
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(photoMargin - 2, photoTop - 2, photoSize + 4, photoSize + 4, 3, 3, "F");

        doc.addImage(imgData, "JPEG", photoMargin, photoTop, photoSize, photoSize);
      }

      // Caption below photo
      if (photo.caption) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(12);
        doc.setTextColor(100, 90, 80);
        const lines = wrapText(doc, photo.caption, textArea - 40);
        const captionY = PAGE_SIZE - 60;
        lines.forEach((line, i) => {
          doc.text(line, PAGE_SIZE / 2, captionY + i * 18, { align: "center" });
        });
      }
    }
  }

  // Download
  const filename = `${petName.replace(/[^a-zA-Z0-9]/g, "_")}_Book.pdf`;
  doc.save(filename);
}
