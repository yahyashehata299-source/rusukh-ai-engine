import { PageText } from "./pdfExtractor";

export type ConceptType =
  | "definition"
  | "ruling"
  | "pillar"
  | "condition"
  | "nullifier"
  | "category"
  | "difference"
  | "evidence"
  | "example"
  | "other";

export interface BlueprintConcept {
  id: string;
  type: ConceptType;
  title?: string;
  canonical?: string;
  importance: number; // 0..1
  confidence: number; // 0..1
  page: number;
  snippet: string; // primary sentence
  context?: string; // surrounding sentences
}

let idCounter = 1;
function nextId() { return `c-${idCounter++}`; }

function sentenceSplit(text: string): string[] {
  return text.split(/\n+/).map(s => s.trim()).filter(Boolean);
}

// Extract title from concept (term before colon or specific pattern)
function extractTitle(snippet: string): string | undefined {
  // Match: "word: definition" or "word بـ definition"
  const m = snippet.match(/^([^:\-\n]{2,80})[:\-\s]/);
  if (m && m[1]) {
    const title = m[1].trim();
    if (title.length > 2 && title.length < 80) {
      return title;
    }
  }
  return undefined;
}

// High-precision pattern matching for definitions, pillars, rulings, lists
export function buildBlueprint(pages: PageText[]): BlueprintConcept[] {
  const candidates: BlueprintConcept[] = [];

  for (const p of pages) {
    const blocks = sentenceSplit(p.text);

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];

      // Skip very short blocks or numbers-only blocks
      if (b.length < 3 || /^\d+$/.test(b)) continue;

      // ========== DEFINITION PATTERNS ==========
      const defRegexes = [
        /تعريف\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /(?:يعرف|يُعرَف|يُعرف)\s*(?:ب)?\s*(?:الـ)?([^\n:]+?)\s*(?:بأنه|بـ|:)\s*(.+?)(?=\n|$)/i,
        /معنى\s*(?:الـ)?([^\n:]+?)\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /تعني\s+(?:الـ)?([^\n:]+?)\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /هو\s*(?:الـ)?([^\n:]+?)\s*(?:الذي|الذى|الّذي)\s*(.+?)(?=\n|$)/i,
      ];

      for (const re of defRegexes) {
        const m = b.match(re);
        if (m && m[1]) {
          const term = m[1]
            .replace(/^"|'|«|»/g, "")
            .replace(/الـ|ال/g, "")
            .trim();

          if (term.length > 2 && term.length < 100) {
            candidates.push({
              id: nextId(),
              type: "definition",
              title: term,
              canonical: term,
              importance: 0.98,
              confidence: 0.92,
              page: p.pageNumber,
              snippet: b.substring(0, 300),
              context: [
                blocks[Math.max(0, i - 1)],
                blocks[i],
                blocks[Math.min(blocks.length - 1, i + 1)],
              ]
                .filter(Boolean)
                .join(" | "),
            });
          }
        }
      }

      // ========== RULING/HUKM PATTERNS ==========
      const rulingPatterns = [
        /^(?:الحكم|حكم)\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /(?:يجوز|لا يجوز|لايجوز|لا يجب|لايجب)\s+(.+?)(?=\n|$)/i,
        /(?:واجب|مندوب|مكروه|حرام|مباح)\s+(?:الـ)?(.+?)(?=\n|$)/i,
        /(?:يتوجب|يبطل|يلزم|يستحب)\s+(.+?)(?=\n|$)/i,
        /(?:الحكم|الفتوى)\s*[:]\s*(.+?)(?=\n|$)/i,
      ];

      for (const pattern of rulingPatterns) {
        if (pattern.test(b)) {
          const match = b.match(pattern);
          const ruling = match ? match[1]?.trim() : b;

          if (ruling && ruling.length > 5) {
            candidates.push({
              id: nextId(),
              type: "ruling",
              title: ruling.substring(0, 60),
              importance: 0.92,
              confidence: 0.85,
              page: p.pageNumber,
              snippet: b.substring(0, 300),
              context: [
                blocks[Math.max(0, i - 1)],
                blocks[i],
                blocks[Math.min(blocks.length - 1, i + 1)],
              ]
                .filter(Boolean)
                .join(" | "),
            });
            break;
          }
        }
      }

      // ========== PILLAR/ARKĀN PATTERNS ==========
      if (/\bأركان\b|\bأركان\b/i.test(b)) {
        const items = extractListItems(blocks, i);
        if (items.length > 0) {
          for (const item of items) {
            candidates.push({
              id: nextId(),
              type: "pillar",
              title: item.substring(0, 80),
              importance: 0.95,
              confidence: 0.88,
              page: p.pageNumber,
              snippet: item,
              context: b,
            });
          }
        }
      }

      // ========== CONDITION PATTERNS ==========
      if (/\bشروط\b|\bشرط\b/i.test(b)) {
        const items = extractListItems(blocks, i);
        if (items.length > 0) {
          for (const item of items) {
            candidates.push({
              id: nextId(),
              type: "condition",
              title: item.substring(0, 80),
              importance: 0.90,
              confidence: 0.82,
              page: p.pageNumber,
              snippet: item,
              context: b,
            });
          }
        }
      }

      // ========== NULLIFIER PATTERNS ==========
      if (/\bموانع\b|\bمانع\b|\bيبطل\b/i.test(b)) {
        const items = extractListItems(blocks, i);
        if (items.length > 0) {
          for (const item of items) {
            candidates.push({
              id: nextId(),
              type: "nullifier",
              title: item.substring(0, 80),
              importance: 0.88,
              confidence: 0.80,
              page: p.pageNumber,
              snippet: item,
              context: b,
            });
          }
        }
      }

      // ========== CATEGORY/DIVISION PATTERNS ==========
      if (/\bأقسام\b|\bأنواع\b|\bأنواع\b|\bأصناف\b/i.test(b)) {
        const items = extractListItems(blocks, i);
        if (items.length > 0) {
          for (const item of items) {
            candidates.push({
              id: nextId(),
              type: "category",
              title: item.substring(0, 80),
              importance: 0.85,
              confidence: 0.80,
              page: p.pageNumber,
              snippet: item,
              context: b,
            });
          }
        }
      }

      // ========== DIFFERENCE PATTERNS ==========
      if (/\bالفرق\b|\bالفروق\b|\bفرق\s+بين/i.test(b)) {
        candidates.push({
          id: nextId(),
          type: "difference",
          title: b.substring(0, 100),
          importance: 0.80,
          confidence: 0.75,
          page: p.pageNumber,
          snippet: b.substring(0, 300),
          context: [
            blocks[Math.max(0, i - 1)],
            blocks[i],
            blocks[Math.min(blocks.length - 1, i + 1)],
          ]
            .filter(Boolean)
            .join(" | "),
        });
      }

      // ========== EVIDENCE PATTERNS ==========
      const evidencePatterns = [
        /^(?:الدليل|الأدلة)\s*[:\-]\s*(.+?)(?=\n|$)/i,
        /(?:قال|ورد)\s+(?:في|في)\s+(?:الآية|الحديث|القرآن|السنة)\s*[:\-]?\s*(.+?)(?=\n|$)/i,
        /\((?:سورة|حديث)\s+([^\)]+)\)/i,
        /\[(?:Qur'an|Hadith|Surah)\s+([^\]]+)\]/i,
      ];

      for (const pattern of evidencePatterns) {
        if (pattern.test(b)) {
          const match = b.match(pattern);
          const evidence = match ? match[1]?.trim() : b;

          if (evidence && evidence.length > 5) {
            candidates.push({
              id: nextId(),
              type: "evidence",
              title: evidence.substring(0, 100),
              importance: 0.75,
              confidence: 0.80,
              page: p.pageNumber,
              snippet: b.substring(0, 300),
              context: blocks[Math.max(0, i - 1)],
            });
            break;
          }
        }
      }

      // ========== EXAMPLE PATTERNS ==========
      if (/\bمثال\b|\bأمثلة\b|\bمثلا\b/i.test(b)) {
        // Extract example text (usually after colon or في)
        const exMatch = b.match(/مثال[:\-]?\s*(.+?)(?=\n|$)/i);
        const exText = exMatch ? exMatch[1].trim() : b;

        if (exText.length > 5) {
          candidates.push({
            id: nextId(),
            type: "example",
            title: exText.substring(0, 100),
            importance: 0.60,
            confidence: 0.75,
            page: p.pageNumber,
            snippet: exText.substring(0, 300),
            context: blocks[Math.max(0, i - 1)],
          });
        }
      }
    }
  }

  // De-duplicate by snippet (first 150 chars)
  const seen = new Set<string>();
  const uniq = candidates.filter((c) => {
    const key = (c.snippet || "").substring(0, 150);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by importance * confidence
  uniq.sort((a, b) => (b.importance * b.confidence) - (a.importance * a.confidence));

  return uniq;
}

// Helper: extract list items from following blocks
function extractListItems(blocks: string[], startIdx: number): string[] {
  const items: string[] = [];
  const listMarkerRegex = /^[\d\u0621-\u064A]{1,3}[\.\)\-\:]|^[\•\→\■]/;

  // Look ahead up to 5 blocks for list items
  for (let j = startIdx + 1; j < Math.min(startIdx + 6, blocks.length); j++) {
    const blk = blocks[j];
    const lines = blk.split(/\n/).map((s) => s.trim()).filter(Boolean);

    for (const line of lines) {
      // Check if line looks like a list item
      if (listMarkerRegex.test(line) || line.match(/^\d{1,2}\./)) {
        // Remove marker and add
        const cleaned = line.replace(/^[\d\u0621-\u064A]{1,3}[\.\)\-\:]\s*/, "").replace(/^[\•\→\■]\s*/, "");
        if (cleaned.length > 3) {
          items.push(cleaned);
        }
      } else if (items.length > 0 && line.length > 5 && !line.match(listMarkerRegex)) {
        // Continuation of previous item
        if (items.length > 0) {
          items[items.length - 1] += " " + line;
        }
      } else if (items.length === 0 && line.length > 5) {
        // First non-marker line in section might be an item
        items.push(line);
      }
    }

    // Stop if we hit a non-list block (2+ lines without markers)
    const nonMarkerLines = lines.filter((l) => !listMarkerRegex.test(l) && l.length > 20);
    if (nonMarkerLines.length >= 2 && items.length > 0) break;
  }

  return items.slice(0, 20); // Limit to 20 items per section
}
