import fs from "fs";
import pdf from "pdf-parse";

export interface PageText {
  pageNumber: number;
  text: string;
}

export async function extractTextFromPdf(pdfPath: string): Promise<PageText[]> {
  const dataBuffer = fs.readFileSync(pdfPath);
  try {
    const data = await pdf(dataBuffer, { max: 1e7 });
    // pdf-parse returns text without page boundaries by default; but has meta "text" with page breaks as '\f'
    const raw = data.text || "";
    // split by form feed which often indicates page break
    const pages = raw.split(/\f/);
    const result: PageText[] = pages.map((p, i) => ({ pageNumber: i + 1, text: p.trim() }));
    return result;
  } catch (err) {
    throw new Error(`PDF extraction failed: ${String(err)}`);
  }
}
