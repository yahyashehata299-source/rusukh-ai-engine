import { BlueprintConcept } from "./blueprint";
import { v4 as uuidv4 } from "uuid";

export interface Card {
  id: string;
  front: string;
  back: string;
  explanation: string;
  example?: string;
  tags: string[];
  provenance: { page: number; snippet: string };
  confidence: number;
}

function escapeForCloze(term: string): string {
  return `{{c1::${term}}}`;
}

function chooseCardType(concept: BlueprintConcept): "cloze" | "qa" {
  if (concept.type === "definition" || concept.type === "pillar" || concept.type === "category") return "cloze";
  if (concept.type === "ruling" || concept.type === "difference" || concept.type === "evidence") return "qa";
  return concept.importance >= 0.9 ? "cloze" : "qa";
}

function synthesizeExplanation(concept: BlueprintConcept): string {
  // Minimal teacher-style explanation scaffold using context + snippet
  const meaning = `ماذا يعني: ${concept.snippet}`;
  const why = `لما��ا: يُستدلُّ على هذا لأنّ... (راجع السّياق)`;
  const how = `كيف يُطبَّق: في الحالات العملية مثل ...`;
  const misunderstanding = `مفارقة شائعة: لا تخلط بين ...`;
  const important = `أهميّة: مهم لحفظ وجوب/تفريع في ...`;
  return [meaning, why, how, misunderstanding, important].join("\n");
}

export function generateCards(blueprint: BlueprintConcept[]): Card[] {
  const cards: Card[] = [];
  for (const c of blueprint) {
    // Skip low-importance concepts by default
    if (c.importance < 0.5) continue;

    const cardType = chooseCardType(c);
    let front = "";
    let back = "";

    if (cardType === "cloze") {
      // try to get a short canonical term
      const term = c.canonical || extractTermFromSnippet(c.snippet) || c.snippet.split(" ").slice(0,3).join(" ");
      front = c.snippet.replace(term, escapeForCloze(term));
      back = term;
    } else {
      // QA
      const q = questionForConcept(c);
      front = q;
      back = extractAnswerFromSnippet(c.snippet) || c.snippet;
    }

    const explanation = synthesizeExplanation(c);
    const example = extractExampleFromContext(c.context || "") || undefined;

    cards.push({
      id: uuidv4(),
      front,
      back,
      explanation,
      example,
      tags: [c.type],
      provenance: { page: c.page, snippet: c.snippet },
      confidence: c.confidence
    });
  }
  return cards;
}

function extractTermFromSnippet(sn: string): string | null {
  // heuristics: term before colon or right after 'تعريف' or 'معنى'
  let m = sn.match(/^(.*?)[:\-]/);
  if (m && m[1]) return m[1].trim().split(" ").slice(0,5).join(" ");
  m = sn.match(/معنى\s+([^:]+)[:\-]/i);
  if (m && m[1]) return m[1].trim();
  return null;
}

function questionForConcept(c: BlueprintConcept): string {
  if (c.type === "ruling") return `ما حكم ${shorten(c.snippet, 40)}؟`;
  if (c.type === "evidence") return `ما الدليل المتقدّم؟`;
  return `ما معنى: ${shorten(c.snippet, 60)}؟`;
}

function extractAnswerFromSnippet(sn: string): string | null {
  // attempt to strip leading phrase like 'حكم: ...' or extract clause after 'هو' or ':'
  const m = sn.match(/(?:هو|هي|:|\-)(.*)$/i);
  if (m && m[1]) return m[1].trim();
  return null;
}

function shorten(s: string, max = 80) {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}

function extractExampleFromContext(ctx: string): string | null {
  if (!ctx) return null;
  const m = ctx.match(/مثال[:\-]?(.*)$/i);
  if (m && m[1]) return m[1].trim();
  return null;
}
