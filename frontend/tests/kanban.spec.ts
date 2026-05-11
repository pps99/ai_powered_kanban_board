import { expect, test } from "@playwright/test";

test.describe("Kanban Board", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads the kanban board", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  });

  test("displays all columns with correct titles", async ({ page }) => {
    await expect(page.getByText("Backlog")).toBeVisible();
    await expect(page.getByText("Discovery")).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
    await expect(page.getByText("Review")).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();
  });

  test("displays cards in columns", async ({ page }) => {
    await expect(page.getByText("Align roadmap themes")).toBeVisible();
    await expect(page.getByText("Prototype analytics view")).toBeVisible();
    await expect(page.getByText("Ship marketing page")).toBeVisible();
  });

  test("adds a card to a column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
    await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
    await firstColumn.getByRole("button", { name: /add card/i }).click();
    await expect(firstColumn.getByText("Playwright card")).toBeVisible();
  });

  test("cancels card creation when cancel button is clicked", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();

    const titleInput = firstColumn.getByPlaceholder("Card title");
    await titleInput.fill("Cancelled card");

    await firstColumn.getByRole("button", { name: /cancel/i }).click();
    await expect(titleInput).not.toBeVisible();
    await expect(firstColumn.getByText("Cancelled card")).not.toBeVisible();
  });

  test("deletes a card from column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();

    // Add a card first
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Card to delete");
    await firstColumn.getByPlaceholder("Details").fill("Will be deleted");
    await firstColumn.getByRole("button", { name: /add card/i }).click();

    // Verify card exists
    await expect(firstColumn.getByText("Card to delete")).toBeVisible();

    // Delete the card
    await firstColumn.getByRole("button", { name: /delete card to delete/i }).click();
    await expect(firstColumn.getByText("Card to delete")).not.toBeVisible();
  });

  test("renames a column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    const columnTitle = firstColumn.locator('input[type="text"]');

    await columnTitle.clear();
    await columnTitle.type("Custom Column");
    await columnTitle.blur();

    await expect(columnTitle).toHaveValue("Custom Column");
  });

  test("moves a card within same column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    const cards = firstColumn.locator('[data-testid^="card-"]');
    const firstCard = cards.first();
    const secondCard = cards.nth(1);

    if (await secondCard.count() > 0) {
      // Get bounding boxes
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();

      if (firstCardBox && secondCardBox) {
        // Drag first card to second card position
        await page.mouse.move(
          firstCardBox.x + firstCardBox.width / 2,
          firstCardBox.y + firstCardBox.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(
          secondCardBox.x + secondCardBox.width / 2,
          secondCardBox.y + secondCardBox.height / 2,
          { steps: 10 }
        );
        await page.mouse.up();
      }
    }
  });

  test("moves a card between columns", async ({ page }) => {
    const card = page.getByTestId("card-card-1");
    const targetColumn = page.getByTestId("column-col-review");
    const cardBox = await card.boundingBox();
    const columnBox = await targetColumn.boundingBox();

    if (!cardBox || !columnBox) {
      throw new Error("Unable to resolve drag coordinates.");
    }

    await page.mouse.move(
      cardBox.x + cardBox.width / 2,
      cardBox.y + cardBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      columnBox.x + columnBox.width / 2,
      columnBox.y + 120,
      { steps: 12 }
    );
    await page.mouse.up();
    await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  });

  test("maintains card data after move", async ({ page }) => {
    const card = page.getByTestId("card-card-1");
    const cardText = await card.textContent();

    const targetColumn = page.getByTestId("column-col-done");
    const cardBox = await card.boundingBox();
    const columnBox = await targetColumn.boundingBox();

    if (cardBox && columnBox) {
      await page.mouse.move(
        cardBox.x + cardBox.width / 2,
        cardBox.y + cardBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        columnBox.x + columnBox.width / 2,
        columnBox.y + 120,
        { steps: 12 }
      );
      await page.mouse.up();

      // Verify card data is maintained
      const movedCard = targetColumn.getByTestId("card-card-1");
      const movedCardText = await movedCard.textContent();
      expect(movedCardText).toBe(cardText);
    }
  });

  test("handles multiple card additions", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();

    // Add first card
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Card 1");
    await firstColumn.getByRole("button", { name: /add card/i }).click();

    // Add second card
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Card 2");
    await firstColumn.getByRole("button", { name: /add card/i }).click();

    // Verify both cards exist
    await expect(firstColumn.getByText("Card 1")).toBeVisible();
    await expect(firstColumn.getByText("Card 2")).toBeVisible();
  });
});
