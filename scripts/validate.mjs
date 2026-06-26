#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import pipeline functions
import { extractTextFromPdf } from "../dist/pdfExtractor.js";
import { cleanExtractedText } from "../dist/cleaner.js";
import { buildBlueprint } from "../dist/blueprint.js";
import { generateCards } from "../dist/generator.js";
import { exportJsonlCsv } from "../dist/exporter.js";

async function validatePipeline() {
  console.log("=".repeat(80));
  console.log("RUSUKH VERTICAL SLICE VALIDATION");
  console.log("=".repeat(80));

  const samplePath = path.join(__dirname, "../samples/tahara-sample.txt");
  const outDir = path.join(__dirname, "../validation-output");

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    // Step 1: Read sample text as plain text (simulate PDF extraction)
    console.log("\n[STEP 1] Reading sample text...");
    const sampleText = fs.readFileSync(samplePath, "utf8");
    console.log(`✓ Sample text read (${sampleText.length} characters)`);

    // Simulate PDF extraction by creating PageText objects
    const simulatedPages = [
      {
        pageNumber: 1,
        text: sampleText,
        paragraphs: sampleText.split("\n\n").filter(p => p.trim().length > 0)
      }
    ];

    // Step 2: Clean text
    console.log("\n[STEP 2] Cleaning extracted text...");
    const cleanedPages = cleanExtractedText(simulatedPages);
    console.log(`✓ Cleaned ${cleanedPages.length} page(s)`);
    console.log(`  Page 1 length: ${cleanedPages[0].text.length} characters`);

    // Step 3: Build blueprint (extract concepts)
    console.log("\n[STEP 3] Building blueprint (concept extraction)...");
    const concepts = buildBlueprint(cleanedPages);
    console.log(`✓ Extracted ${concepts.length} blueprint concepts`);

    if (concepts.length > 0) {
      console.log("\n  EXTRACTED CONCEPTS:");
      console.log("  " + "-".repeat(76));
      concepts.slice(0, 20).forEach((c, idx) => {
        console.log(`  [${idx + 1}] Type: ${c.type.padEnd(12)} | Confidence: ${(c.confidence * 100).toFixed(0)}% | Page: ${c.page}`);
        console.log(`      Title: ${(c.title || "N/A").substring(0, 60)}`);
        console.log(`      Snippet: ${c.snippet.substring(0, 70)}...`);
        console.log();
      });

      if (concepts.length > 20) {
        console.log(`  ... and ${concepts.length - 20} more concepts`);
      }
    }

    // Step 4: Generate flashcards
    console.log("\n[STEP 4] Generating flashcards...");
    const cards = generateCards(concepts);
    console.log(`✓ Generated ${cards.length} flashcards`);

    if (cards.length > 0) {
      console.log("\n  GENERATED FLASHCARDS:");
      console.log("  " + "-".repeat(76));
      cards.slice(0, 10).forEach((card, idx) => {
        console.log(`  [${idx + 1}] Tags: ${card.tags.join(", ")}`);
        console.log(`      Front: ${card.front.substring(0, 70)}...`);
        console.log(`      Back: ${card.back.substring(0, 70)}...`);
        console.log(`      Confidence: ${(card.confidence * 100).toFixed(0)}%`);
        if (card.needsEnhancement) {
          console.log(`      ⚠ Needs Enhancement`);
        }
        console.log();
      });

      if (cards.length > 10) {
        console.log(`  ... and ${cards.length - 10} more cards`);
      }
    }

    // Step 5: Export JSONL and CSV
    console.log("\n[STEP 5] Exporting to JSONL and CSV...");
    const jsonlPath = path.join(outDir, "tahara-cards.jsonl");
    const csvPath = path.join(outDir, "tahara-cards.csv");

    exportJsonlCsv(cards, jsonlPath);

    const jsonlContent = fs.readFileSync(jsonlPath, "utf8");
    const csvContent = fs.readFileSync(csvPath, "utf8");
    const jsonlLines = jsonlContent.trim().split("\n").length;
    const csvLines = csvContent.trim().split("\n").length;

    console.log(`✓ Exported JSONL: ${jsonlPath}`);
    console.log(`  - Lines: ${jsonlLines}`);
    console.log(`  - Size: ${jsonlContent.length} bytes`);

    console.log(`✓ Exported CSV: ${csvPath}`);
    console.log(`  - Rows: ${csvLines} (including header)`);
    console.log(`  - Size: ${csvContent.length} bytes`);

    // Step 6: Validation summary
    console.log("\n" + "=".repeat(80));
    console.log("VALIDATION SUMMARY");
    console.log("=".repeat(80));

    console.log(`\n✓ Pages processed: ${cleanedPages.length}`);
    console.log(`✓ Concepts extracted: ${concepts.length}`);
    console.log(`✓ Cards generated: ${cards.length}`);
    console.log(`✓ Cards needing enhancement: ${cards.filter(c => c.needsEnhancement).length}`);

    // Breakdown by concept type
    const typeBreakdown = {};
    concepts.forEach(c => {
      typeBreakdown[c.type] = (typeBreakdown[c.type] || 0) + 1;
    });

    console.log(`\n✓ Concept types found:`);
    Object.entries(typeBreakdown)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  - ${type.padEnd(15)}: ${count}`);
      });

    // Breakdown by card type
    const cardTypeBreakdown = {};
    cards.forEach(card => {
      const cardType = card.front.includes("{{c1::") ? "cloze" : "qa";
      cardTypeBreakdown[cardType] = (cardTypeBreakdown[cardType] || 0) + 1;
    });

    console.log(`\n✓ Card types generated:`);
    Object.entries(cardTypeBreakdown).forEach(([type, count]) => {
      console.log(`  - ${type.padEnd(15)}: ${count}`);
    });

    // Confidence distribution
    const confidenceRanges = {
      "0.9-1.0": cards.filter(c => c.confidence >= 0.9).length,
      "0.8-0.9": cards.filter(c => c.confidence >= 0.8 && c.confidence < 0.9).length,
      "0.7-0.8": cards.filter(c => c.confidence >= 0.7 && c.confidence < 0.8).length,
      "<0.7": cards.filter(c => c.confidence < 0.7).length
    };

    console.log(`\n✓ Confidence distribution:`);
    Object.entries(confidenceRanges).forEach(([range, count]) => {
      console.log(`  - ${range.padEnd(10)}: ${count} cards`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("SAMPLE OUTPUTS");
    console.log("=".repeat(80));

    if (cards.length > 0) {
      console.log("\nFirst JSONL entry:");
      const firstCard = JSON.parse(jsonlContent.split("\n")[0]);
      console.log(JSON.stringify(firstCard, null, 2).split("\n").slice(0, 20).join("\n"));
      if (JSON.stringify(firstCard, null, 2).split("\n").length > 20) {
        console.log("...");
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✓ VALIDATION COMPLETE - All systems operational");
    console.log("=".repeat(80));

    return {
      success: true,
      stats: {
        pagesProcessed: cleanedPages.length,
        conceptsExtracted: concepts.length,
        cardsGenerated: cards.length,
        cardsNeedingEnhancement: cards.filter(c => c.needsEnhancement).length
      }
    };

  } catch (err) {
    console.error("\n✗ VALIDATION FAILED");
    console.error("=".repeat(80));
    console.error(err);
    process.exit(1);
  }
}

validatePipeline().then(result => {
  if (!result.success) {
    process.exit(1);
  }
});
