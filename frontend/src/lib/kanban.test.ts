import { moveCard, createId, type Column } from "@/lib/kanban";

describe("kanban utilities", () => {
  describe("moveCard", () => {
    const baseColumns: Column[] = [
      { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
      { id: "col-b", title: "B", cardIds: ["card-3"] },
    ];

    it("reorders cards in the same column", () => {
      const result = moveCard(baseColumns, "card-2", "card-1");
      expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
    });

    it("moves cards to another column", () => {
      const result = moveCard(baseColumns, "card-2", "card-3");
      expect(result[0].cardIds).toEqual(["card-1"]);
      expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
    });

    it("drops cards to the end of a column", () => {
      const result = moveCard(baseColumns, "card-1", "col-b");
      expect(result[0].cardIds).toEqual(["card-2"]);
      expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
    });

    it("handles invalid card id gracefully", () => {
      const result = moveCard(baseColumns, "invalid-card", "card-1");
      expect(result).toEqual(baseColumns);
    });

    it("handles card already in target position", () => {
      const result = moveCard(baseColumns, "card-1", "card-1");
      expect(result).toEqual(baseColumns);
    });

    it("handles multiple columns correctly", () => {
      const multiColumns: Column[] = [
        { id: "col-1", title: "Col1", cardIds: ["card-1", "card-2"] },
        { id: "col-2", title: "Col2", cardIds: ["card-3"] },
        { id: "col-3", title: "Col3", cardIds: ["card-4"] },
      ];
      const result = moveCard(multiColumns, "card-1", "col-3");
      expect(result[0].cardIds).toEqual(["card-2"]);
      expect(result[2].cardIds).toEqual(["card-4", "card-1"]);
    });

    it("moves card when card id matches a column id (API integer ids)", () => {
      // Real-world case: column ids and card ids are both "1","2","3"...
      const apiColumns: Column[] = [
        { id: "1", title: "Backlog", cardIds: ["1", "2"] },
        { id: "2", title: "Discovery", cardIds: ["3"] },
        { id: "3", title: "In Progress", cardIds: [] },
      ];
      // Move card "1" (same id as column "1") to column "3"
      const result = moveCard(apiColumns, "1", "3");
      expect(result[0].cardIds).toEqual(["2"]);
      expect(result[2].cardIds).toEqual(["1"]);
    });

    it("moves card with api ids after it was already moved once", () => {
      // card "3" was moved to column "1" — cardIds no longer match column ids
      const apiColumns: Column[] = [
        { id: "1", title: "Backlog", cardIds: ["3"] },
        { id: "2", title: "Discovery", cardIds: [] },
        { id: "3", title: "In Progress", cardIds: [] },
      ];
      // Move card "3" (same id as column "3") from column "1" to column "2"
      const result = moveCard(apiColumns, "3", "2");
      expect(result[0].cardIds).toEqual([]);
      expect(result[1].cardIds).toEqual(["3"]);
    });
  });

  describe("createId", () => {
    it("generates unique ids with correct prefix", () => {
      const id1 = createId("test");
      const id2 = createId("test");

      expect(id1).toMatch(/^test-/);
      expect(id2).toMatch(/^test-/);
      expect(id1).not.toEqual(id2);
    });

    it("generates ids for cards", () => {
      const id = createId("card");
      expect(id).toMatch(/^card-/);
    });

    it("generates ids for columns", () => {
      const id = createId("col");
      expect(id).toMatch(/^col-/);
    });

    it("generates different ids on subsequent calls", () => {
      const ids = new Set();
      for (let i = 0; i < 10; i++) {
        ids.add(createId("card"));
      }
      expect(ids.size).toBe(10);
    });
  });
});
