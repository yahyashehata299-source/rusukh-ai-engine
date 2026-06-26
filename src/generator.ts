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
  needsEnhancement?: boolean;
}

function escapeForCloze(term: string): string {
  return `{{c1::${term}}}`;
}

function chooseCardType(concept: BlueprintConcept): "cloze" | "qa" {
  if (concept.type === "definition" || concept.type === "pillar" || concept.type === "category")
    return "cloze";
  if (concept.type === "ruling" || concept.type === "difference" || concept.type === "evidence")
    return "qa";
  return concept.importance >= 0.9 ? "cloze" : "qa";
}

// Extract deterministic explanation ONLY from source context
function synthesizeExplanation(concept: BlueprintConcept): { explanation: string; needsEnhancement: boolean } {
  const parts: string[] = [];
  let needsEnhancement = false;

  // What: From the snippet itself
  if (concept.snippet && concept.snippet.length > 0) {
    const what = `ماذا: ${concept.snippet.substring(0, 200)}`;
    parts.push(what);
  }

  // Why/Basis: From context if available
  if (concept.context && concept.context.length > 0) {
    const context = concept.context.substring(0, 300);
    const why = `السياق: ${context}`;
    parts.push(why);
  }

  // Type-specific derived explanations (all deterministic from source)
  if (concept.type === "definition" && concept.title) {
    parts.push(`التعريف الأساسي: ${concept.title}`);
  }

  if (concept.type === "ruling") {
    // Extract ruling direction if possible
    const rulingMatch = concept.snippet.match(/(?:واجب|مندوب|مكروه|حرام|مباح)/);
    if (rulingMatch) {
      parts.push(`الحكم الشرعي: ${rulingMatch[0]}`);
    }
  }

  if (concept.type === "pillar" || concept.type === "condition") {
    parts.push(`مكون أساسي: ${concept.snippet.substring(0, 150)}`);
  }

  if (concept.type === "evidence") {
    const quranic = concept.snippet.match(/(سورة|آية|الآية)\s+([^\n]+)/i);
    const hadith = concept.snippet.match(/(حديث|حديث)\s+([^\n]+)/i);

    if (quranic) {
      parts.push(`دليل قرآني: ${quranic[0].substring(0, 100)}`);
    } else if (hadith) {
      parts.push(`دليل حديثي: ${hadith[0].substring(0, 100)}`);
    } else {
      parts.push(`دليل من المصدر: ${concept.snippet.substring(0, 100)}`);
    }
  }

  if (concept.type === "example") {
    parts.push(`مثال عملي: ${concept.snippet.substring(0, 150)}`);
  }

  if (concept.type === "difference") {
    parts.push(`نقطة تمييز: ${concept.snippet.substring(0, 150)}`);
  }

  if (concept.type === "category") {
    parts.push(`تصنيف: ${concept.snippet.substring(0, 150)}`);
  }

  // If we have minimal information, mark for enhancement
  if (parts.length < 2) {
    needsEnhancement = true;
  }

  const explanation = parts.join("\n\n");
  return { 
    explanation: explanation.length > 0 ? explanation : "معلومات من المصدر متاحة في البطاقة.",
    needsEnhancement 
  };
}

export function generateCards(blueprint: BlueprintConcept[]): Card[] {
  const cards: Card[] = [];

  for (const c of blueprint) {
    // Skip very low-importance concepts
    if (c.importance < 0.5) continue;

    const cardType = chooseCardType(c);
    let front = "";
    let back = "";

    if (cardType === "cloze") {
      // Cloze deletion: blank out the term
      const term = c.title || c.canonical || extractTermFromSnippet(c.snippet) || c.snippet.split(" ").slice(0, 3).join(" ");
      front = c.snippet.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, "g"), escapeForCloze(term));
      back = term;
    } else {
      // QA format
      const q = questionForConcept(c);
      front = q;
      back = extractAnswerFromSnippet(c.snippet) || c.snippet.substring(0, 200);
    }

    const { explanation, needsEnhancement } = synthesizeExplanation(c);
    const example = extractExampleFromContext(c.context || "") || undefined;

    const card: Card = {
      id: uuidv4(),
      front,
      back,
      explanation,
      example,
      tags: [c.type, `confidence:${Math.round(c.confidence * 100)}`],
      provenance: { page: c.page, snippet: c.snippet },
      confidence: c.confidence,
    };

    if (needsEnhancement) {
      card.needsEnhancement = true;
    }

    cards.push(card);
  }

  return cards;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTermFromSnippet(sn: string): string | null {
  // Heuristic: term before colon or after تعريف/معنى
  let m = sn.match(/^([^:\-\n]{3,80})[:\-]/);
  if (m && m[1]) {
    const term = m[1].trim();
    if (term.length > 2 && term.length < 80) return term;
  }

  m = sn.match(/(?:معنى|تعريف)\s+(?:الـ)?([^:\-\n]{3,80})/i);
  if (m && m[1]) return m[1].trim();

  return null;
}

function questionForConcept(c: BlueprintConcept): string {
  if (c.type === "ruling") {
    const ruling = c.title || shorten(c.snippet, 40);
    return `ما حكم ${ruling}؟`;
  }

  if (c.type === "evidence") {
    return `ما الدليل المذكور؟`;
  }

  if (c.type === "difference") {
    return `ما الفرق المقصود؟`;
  }

  if (c.type === "definition") {
    const term = c.title || shorten(c.snippet, 40);
    return `ما تعريف: ${term}؟`;
  }

  if (c.type === "example") {
    return `ما المثال المعطى؟`;
  }

  // Default question
  return `ما معنى: ${shorten(c.snippet, 60)}؟`;
}

function extractAnswerFromSnippet(sn: string): string | null {
  // Try to find answer after specific markers
  let m = sn.match(/(?:بأنه|هو|هي|:|\-)\s*(.+?)(?=\n|$)/i);
  if (m && m[1]) {
    const ans = m[1].trim();
    if (ans.length > 3) return ans.substring(0, 250);
  }

  // Otherwise return first 200 chars
  return sn.substring(0, 200);
}

function shorten(s: string, max = 80): string {
  if (s.length <= max) return s;
  return s.substring(0, max - 3) + "...";
}

function extractExampleFromContext(ctx: string): string | null {
  if (!ctx) return null;

  // Look for example markers
  const m = ctx.match(/(?:مثال|أمثلة)[:\-]?\s*([^\n]+)/i);
  if (m && m[1]) {
    const ex = m[1].trim();
    if (ex.length > 3) return ex.substring(0, 200);
  }

  return null;
}
