import { PageText } from "./pdfExtractor";

function normalizeArabic(text: string): string {
  // Basic Arabic normalization: unify alef forms, remove tatweel, normalize digits
  return text
    .replace(/[\u064B-\u0652]/g, "") // remove tashkeel
    .replace(/ـ/g, "") // tatweel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/٠/g, "0").replace(/١/g, "1").replace(/٢/g, "2").replace(/٣/g, "3").replace(/٤/g, "4").replace(/٥/g, "5").replace(/٦/g, "6").replace(/٧/g, "7").replace(/٨/g, "8").replace(/٩/g, "9");
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

// Very simple heuristic to remove repeated header/footer lines across pages
export function cleanExtractedText(pages: PageText[]): PageText[] {
  // collect line frequency across pages (only consider short lines)
  const lineCounts = new Map<string, number>();
  const pageLines: string[][] = pages.map(p => splitLines(p.text));
  for (const lines of pageLines) {
    const unique = new Set(lines.filter(l => l.length < 80));
    for (const l of unique) {
      const key = l.replace(/\s+/g, " ");
      lineCounts.set(key, (lineCounts.get(key) || 0) + 1);
    }
  }

  const pageCount = pages.length;
  const repeatedLines = new Set<string>();
  for (const [line, count] of lineCounts.entries()) {
    if (count >= Math.max(2, Math.floor(pageCount * 0.2))) {
      // appears on multiple pages -> likely header/footer
      repeatedLines.add(line);
    }
  }

  const cleaned: PageText[] = pages.map((p, idx) => {
    let lines = splitLines(p.text);
    // remove repeated lines
    lines = lines.filter(l => !repeatedLines.has(l.replace(/\s+/g, " ")));

    // remove standalone page numbers
    lines = lines.filter(l => !/^\d+$/.test(l) && !/^\d+\s*[-/]\s*\d+$/.test(l));

    // join broken lines: if a line doesn't end with punctuation, join with next
    const joined: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      let cur = lines[i];
      while (i + 1 < lines.length && !/[\.؟!؛:]$/.test(cur) && /^[a-zA-Z0-9اأإآبتثجحخدذرزسشصضطظعغفقكلمنهويإآةىؤئ]/.test(lines[i + 1])) {
        // join with next line
        cur = cur + " " + lines[i + 1];
        i++;
      }
      joined.push(cur.trim());
    }

    const normalized = joined.map(l => normalizeArabic(l)).join("\n\n");
    return { pageNumber: p.pageNumber, text: normalized };
  });

  return cleaned;
}
