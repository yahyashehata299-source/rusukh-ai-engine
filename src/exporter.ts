import fs from "fs";
import { stringify } from "csv-stringify/sync";
import { Card } from "./generator";

export function exportJsonlCsv(cards: Card[], outPath: string) {
  const jsonl = cards.map(c => JSON.stringify(c)).join('\n');
  fs.writeFileSync(outPath, jsonl, 'utf8');
  const csvRecords = cards.map(c => ({ front: c.front, back: c.back, explanation: c.explanation, example: c.example || '', tags: c.tags.join(','), page: c.provenance.page }));
  const csv = stringify(csvRecords, { header: true });
  fs.writeFileSync(outPath.replace(/\.jsonl?$/i, '.csv'), csv, 'utf8');
}
