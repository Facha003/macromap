import { describe, expect, it } from "vitest";
import { parseMenuText } from "@/lib/menuParse";

describe("parseMenuText", () => {
  it("parses a delivery-app style menu with categories, descriptions and prices", () => {
    const text = `Populære
Wraps
Chicken kebab wrap
Grilled chicken, iceberg, tomato and garlic sauce
kr 159,00
Falafel wrap
kr 139,00
Plates
Kebab plate with rice
Döner meat with rice, salad and garlic sauce
199,-
Add`;
    expect(parseMenuText(text)).toEqual([
      { name: "Chicken kebab wrap", description: "Grilled chicken, iceberg, tomato and garlic sauce", priceNok: 159 },
      { name: "Falafel wrap", description: null, priceNok: 139 },
      { name: "Kebab plate with rice", description: "Döner meat with rice, salad and garlic sauce", priceNok: 199 },
    ]);
  });

  it("handles name and price on one line", () => {
    expect(parseMenuText("Salmon nigiri (8 pcs) 189 kr\nCalifornia roll ...... 149,-")).toEqual([
      { name: "Salmon nigiri (8 pcs)", description: null, priceNok: 189 },
      { name: "California roll", description: null, priceNok: 149 },
    ]);
  });

  it("falls back to one dish per short line without prices", () => {
    expect(parseMenuText("Margherita\ntomato, mozzarella, basil\nPepperoni")).toEqual([
      { name: "Margherita", description: "tomato, mozzarella, basil", priceNok: null },
      { name: "Pepperoni", description: null, priceNok: null },
    ]);
  });

  it("treats decimal commas as part of the name, not a description", () => {
    expect(parseMenuText("Drikke\nCoca-Cola 0,5 l\nkr 39,00")).toEqual([{ name: "Coca-Cola 0,5 l", description: null, priceNok: 39 }]);
  });

  it("reads labelled price lines (takeaway / eat-in, small / large)", () => {
    const text = "Kylling\nTomatsaus, mozzarella, kylling\nTakeaway:209 ,- Spise her:224,-\nMARGARITA\nTomatsaus, mozzarella\nLiten 129 / Stor 189";
    expect(parseMenuText(text)).toEqual([
      { name: "Kylling", description: "Tomatsaus, mozzarella, kylling", priceNok: 209 },
      { name: "MARGARITA", description: "Tomatsaus, mozzarella", priceNok: 129 },
    ]);
  });

  it("de-duplicates and ignores noise", () => {
    expect(parseMenuText("Most ordered\nPad thai\n189 kr\nPad thai\n189 kr\nSold out")).toHaveLength(1);
  });
});
