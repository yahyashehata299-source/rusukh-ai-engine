import fs from "fs";
import path from "path";
import minimist from "minimist";
import { extractTextFromPdf } from "./pdfExtractor";
import { cleanExtractedText } from "./cleaner";
import { buildBlueprint } from "./blueprint";
import { generateCards } from "./generator";
import { exportJsonlCsv } from "./exporter";

async function main() {
  const argv = minimist(process.argv.slice(2));
  const pdfPath = argv.pdf || argv.p;
  const outPath = argv.out || argv.o || "out/cards.jsonl";
  if (!pdfPath) {
    console.error("Usage: npm start -- --pdf path/to/book.pdf --out out/cards.jsonl");
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found:", pdfPath);
    process.exit(1);
  }

  console.log("Extracting text from PDF...", pdfPath);
  const rawPages = await extractTextFromPdf(pdfPath);
  console.log("Cleaning and reconstructing pages...");
  const pages = cleanExtractedText(rawPages);
  console.log("Building learning blueprint (concept extraction)...");
  const blueprint = buildBlueprint(pages);
  console.log(`Found ${blueprint.length} candidate concepts (pre-filter).`);
  console.log("Generating flashcards from blueprint...");
  const cards = generateCards(blueprint);
  console.log(`Generated ${cards.length} cards.`);

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  exportJsonlCsv(cards, outPath);
  console.log("Exported cards to", outPath, "and CSV at same location with .csv extension.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
