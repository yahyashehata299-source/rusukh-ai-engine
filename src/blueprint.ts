import { PageText } from "./pdfExtractor";

export type ConceptType =
  | "definition"
  | "pillar"
  | "condition"
  | "nullifier"
  | "ruling"
  | "category"
  | "difference"
  | "evidence"
  | "example"
  | "other";

export interface BlueprintConcept {
  id: string;
  type: ConceptType;
  canonical?: string;
  importance: number; // 0..1
  confidence: number; // 0..1
  page: number;
  snippet: string; // primary sentence
  context?: string; // surrounding sentences
  raw?: any;
}

let idCounter = 1;
function nextId() { return `c-${idCounter++}`; }

function sentenceSplit(text: string): string[] {
  return text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
}

// High-precision pattern matching for definitions, pillars, rulings, lists
export function buildBlueprint(pages: PageText[]): BlueprintConcept[] {
  const candidates: BlueprintConcept[] = [];
  for (const p of pages) {
    const blocks = sentenceSplit(p.text);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const lower = b.toLowerCase();

      // Definition patterns
      const defRegexes = [ /تعريف\s*[:\-]\s*(.+)$/i, /(?:يعرف|يُعرَف|يُعرف)\s*(.+?)\s*(?:بأنه|بـ|:)/i, /معنى\s*(.+?)[:\-]/i ];
      for (const re of defRegexes) {
        const m = b.match(re);
        if (m) {
          const term = (m[1] || "").replace(/^"|'|«|»/g, "").trim();
          candidates.push({
            id: nextId(),
            type: "definition",
            canonical: term || undefined,
            importance: 0.98,
            confidence: 0.9,
            page: p.pageNumber,
            snippet: b,
            context: [blocks[Math.max(0, i-1)], blocks[i], blocks[Math.min(blocks.length-1, i+1)]].filter(Boolean).join(" \n ")
          });
        }
      }

      // Pillar / list patterns (أركان، شروط، موانع، أركان الصلاة)
      if (/\bأركان\b|\bشروط\b|\bموانع\b|\bأسباب\b|\bأقسام\b|\bأجزاء\b/i.test(b)) {
        // next block(s) may include list items separated by newlines or commas
        const items: string[] = [];
        // try to parse following blocks as list
        for (let j = i + 1; j < Math.min(i + 5, blocks.length); j++) {
          const blk = blocks[j];
          // simple item pattern: starts with (1) or أ- or - or • or newline
          const parts = blk.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
          for (const pitem of parts) {
            if (/[\u0600-\u06FF]/.test(pitem)) {
              items.push(pitem);
            }
          }
        }
        if (items.length > 0) {
          for (const item of items) {
            candidates.push({
              id: nextId(),
              type: "pillar",
              canonical: undefined,
              importance: 0.95,
              confidence: 0.85,
              page: p.pageNumber,
              snippet: item,
              context: b
            });
          }
        }
      }

      // Ruling / hukm patterns
      if (/\bحكم\b|\bيجوز\b|\bلا يجوز\b|\bواجب\b|\bيتوجب\b|\bيبطل\b|\bفرض\b/i.test(b)) {
        candidates.push({
          id: nextId(),
          type: "ruling",
          importance: 0.9,
          confidence: 0.7,
          page: p.pageNumber,
          snippet: b,
          context: [blocks[Math.max(0, i-1)], blocks[i], blocks[Math.min(blocks.length-1, i+1)]].filter(Boolean).join(" \n ")
        });
      }

      // Evidence markers
      if (/\bدليل\b|\bآية\b|\bحديث\b|\bقال\b|\bورد\b/i.test(b)) {
        candidates.push({
          id: nextId(),
          type: "evidence",
          importance: 0.7,
          confidence: 0.6,
          page: p.pageNumber,
          snippet: b,
          context: blocks[Math.max(0, i-1)]
        });
      }

      // Generic short example markers
      if (/\bمثال\b/i.test(b)) {
        candidates.push({
          id: nextId(),
          type: "example",
          importance: 0.5,
          confidence: 0.6,
          page: p.pageNumber,
          snippet: b,
          context: blocks[Math.max(0, i-1)]
        });
      }

    }
  }

  // De-duplicate by snippet
  const seen = new Set();
  const uniq = candidates.filter(c => {
    const key = (c.snippet || "").slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniq;
}
