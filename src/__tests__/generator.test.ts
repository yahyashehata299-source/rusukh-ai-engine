import { generateCards } from "../src/generator";
import { BlueprintConcept } from "../src/blueprint";

describe("Card Generator", () => {
  test("should generate cloze cards for definitions", () => {
    const concepts: BlueprintConcept[] = [
      {
        id: "c-1",
        type: "definition",
        title: "الطهارة",
        importance: 0.98,
        confidence: 0.9,
        page: 1,
        snippet: "الطهارة: إزالة النجاسة من البدن",
        context: "تعريف الطهارة في الفقه",
      },
    ];

    const cards = generateCards(concepts);
    expect(cards.length).toBe(1);
    expect(cards[0].front).toContain("{{c1::");
  });

  test("should generate QA cards for rulings", () => {
    const concepts: BlueprintConcept[] = [
      {
        id: "c-1",
        type: "ruling",
        importance: 0.9,
        confidence: 0.85,
        page: 1,
        snippet: "حكم الطهارة: واجبة قبل الصلاة",
        context: "الأحكام الشرعية",
      },
    ];

    const cards = generateCards(concepts);
    expect(cards.length).toBe(1);
    expect(cards[0].front).toContain("ما حكم");
  });

  test("should skip low-importance concepts", () => {
    const concepts: BlueprintConcept[] = [
      {
        id: "c-1",
        type: "example",
        importance: 0.3,
        confidence: 0.5,
        page: 1,
        snippet: "مثال قليل الأهمية",
      },
    ];

    const cards = generateCards(concepts);
    expect(cards.length).toBe(0);
  });

  test("should include provenance information", () => {
    const concepts: BlueprintConcept[] = [
      {
        id: "c-1",
        type: "definition",
        title: "الطهارة",
        importance: 0.98,
        confidence: 0.9,
        page: 5,
        snippet: "تعريف الطهارة",
      },
    ];

    const cards = generateCards(concepts);
    expect(cards[0].provenance.page).toBe(5);
    expect(cards[0].provenance.snippet).toBe("تعريف الطهارة");
  });

  test("should generate deterministic explanations from context", () => {
    const concepts: BlueprintConcept[] = [
      {
        id: "c-1",
        type: "definition",
        title: "الطهارة",
        importance: 0.98,
        confidence: 0.9,
        page: 1,
        snippet: "الطهارة: إزالة النجاسة",
        context: "السياق التاريخي والشرعي",
      },
    ];

    const cards = generateCards(concepts);
    expect(cards[0].explanation.length).toBeGreaterThan(0);
    expect(cards[0].explanation).toContain("ماذا");
  });

  test("should tag cards with concept type", () => {
    const concepts: BlueprintConcept[] = [
      {
        id: "c-1",
        type: "pillar",
        importance: 0.95,
        confidence: 0.88,
        page: 1,
        snippet: "النية هي ركن من أركان الوضوء",
      },
    ];

    const cards = generateCards(concepts);
    expect(cards[0].tags).toContain("pillar");
  });

  test("should mark cards needing enhancement when context is minimal", () => {
    const concepts: BlueprintConcept[] = [
      {
        id: "c-1",
        type: "evidence",
        importance: 0.75,
        confidence: 0.8,
        page: 1,
        snippet: "الدليل",
      },
    ];

    const cards = generateCards(concepts);
    expect(cards[0].needsEnhancement).toBe(true);
  });

  test("should generate unique card IDs", () => {
    const concepts: BlueprintConcept[] = [\n      {\n        id: \"c-1\",\n        type: \"definition\",\n        title: \"الطهارة\",\n        importance: 0.98,\n        confidence: 0.9,\n        page: 1,\n        snippet: \"الطهارة: إزالة النجاسة\",\n      },\n      {\n        id: \"c-2\",\n        type: \"definition\",\n        title: \"الوضوء\",\n        importance: 0.95,\n        confidence: 0.9,\n        page: 2,\n        snippet: \"الوضوء: غسل الأعضاء بالماء\",\n      },\n    ];\n\n    const cards = generateCards(concepts);\n    const ids = new Set(cards.map((c) => c.id));\n    expect(ids.size).toBe(cards.length);\n  });\n});
