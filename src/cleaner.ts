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
    .replace(/٠/g, "0").replace(/١/g, "1").replace(/٢/g, "2").replace(/٣/g, "3")
    .replace(/٤/g, "4").replace(/٥/g, "5").replace(/٦/g, "6").replace(/٧/g, "7")
    .replace(/٨/g, "8").replace(/٩/g, "9");
}

function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
}

// Detect if line is likely a heading (short, often contains Arabic keywords, or formatted distinctly)
function isHeading(line: string): boolean {
  if (line.length > 100) return false;
  
  // Check for heading keywords
  const headingPatterns = [
    /^(فصل|باب|درس|الفصل|الباب|الدرس|المقدمة|الخاتمة|المبحث|الفائدة|الفرع)/i,
    /^(Chapter|Section|Part|Unit|Lesson|Introduction|Conclusion)/i,
    /^[\d\-\.]+\s+[ء-ي]/,  // Numbered sections with Arabic
    /[«»\[\{\(].*[»\]\}\)]/, // Bracketed sections
  ];

  for (const pattern of headingPatterns) {
    if (pattern.test(line)) return true;
  }

  return false;
}

// Detect if line is a list item marker
function isListItem(line: string): boolean {
  // Patterns: "1.", "أ)", "•", "-", "→", etc.
  return /^[\d\u0621-\u064A\u0660-\u0669]{1,3}[\.\)\-\:]|^[\•\→\■]|\s{0,2}^[\d]{1,2}[\.\)]/.test(line);
}

// Detect if line is likely a list continuation (starts with list-like structure)
function looksLikeListStructure(block: string): boolean {
  const lines = block.split(/\n/).map(s => s.trim()).filter(Boolean);
  const listMarkerLines = lines.filter(l => /^[\d\u0621-\u064A]{1,3}[\.\)\-\:]|^[\•\→\■]/.test(l));
  
  // If more than 30% of lines look like list items, it's probably a list
  return listMarkerLines.length > Math.max(1, Math.floor(lines.length * 0.3));
}

// Detect page numbers (common patterns: single digit, "page X", "X-Y" format at end)
function isPageNumber(line: string): boolean {
  return /^(\d+|صفحة\s*\d+|\d+\s*[\-\/]\s*\d+)$/.test(line.trim());
}

// Detect repeated headers and footers across pages
function findRepeatedLines(pages: PageText[], threshold: number = 0.6): Set<string> {
  const lineCounts = new Map<string, number>();
  const pageLines: string[][] = pages.map(p => splitLines(p.text));

  for (const lines of pageLines) {
    const unique = new Set(lines.filter(l => l.length < 100)); // Only consider "short" lines as headers/footers
    for (const l of unique) {
      const key = normalizeArabic(l).replace(/\s+/g, " ");
      lineCounts.set(key, (lineCounts.get(key) || 0) + 1);
    }
  }

  const pageCount = pages.length;
  const repeatedLines = new Set<string>();

  for (const [line, count] of lineCounts.entries()) {
    // A line is considered repeated if it appears on >= threshold of pages
    if (count >= Math.max(2, Math.floor(pageCount * threshold))) {
      repeatedLines.add(line);
    }
  }

  return repeatedLines;
}

export function cleanExtractedText(pages: PageText[]): PageText[] {
  const repeatedLines = findRepeatedLines(pages, 0.5); // 50% threshold for header/footer detection

  const cleaned: PageText[] = pages.map((p) => {
    let lines = splitLines(p.text);

    // Step 1: Remove detected headers/footers
    lines = lines.filter(l => {
      const key = normalizeArabic(l).replace(/\s+/g, " ");
      return !repeatedLines.has(key);
    });

    // Step 2: Remove page numbers
    lines = lines.filter(l => !isPageNumber(l));

    // Step 3: Process lines to preserve structure
    const processed: string[] = [];
    const blankLineCount: number[] = [];
    let consecutiveBlanks = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line should be joined with previous (continuation of wrapped line)
      if (i > 0 && processed.length > 0) {
        const prevLine = processed[processed.length - 1];
        const prevEndsWithPunctuation = /[\.؟!؛:]$/.test(prevLine);
        const curStartsWithArabic = /^[\u0600-\u06FF]/.test(line);

        // If previous line doesn't end with punctuation and this is Arabic, might be continuation
        if (!prevEndsWithPunctuation && curStartsWithArabic && prevLine.length > 10 && line.length > 5) {
          // Join them
          processed[processed.length - 1] = prevLine + " " + line;
          continue;
        }
      }

      processed.push(line);
    }

    // Step 4: Normalize Arabic and join into text with paragraph boundaries
    const final = processed.map(l => normalizeArabic(l)).join("\n");

    return { 
      pageNumber: p.pageNumber, 
      text: final,
      paragraphs: p.paragraphs
    };
  });

  return cleaned;
}
