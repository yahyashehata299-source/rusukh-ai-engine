import { PageText } from "./pdfExtractor";
import {
  cleanExtractedText as cleanExtractedTextImpl,
} from "./cleaner";

// Re-export the cleaner function
export { cleanExtractedText } from "./cleaner";

export async function processTextFile(
  filePath: string
): Promise<PageText[]> {
  const fs = await import("fs");
  const text = fs.readFileSync(filePath, "utf8");

  // Split by double newlines to simulate pages or just treat whole as one page
  const lines = text.split(/\r?\n/);

  return [
    {
      pageNumber: 1,
      text: text,
      paragraphs: text
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    },
  ];
}
