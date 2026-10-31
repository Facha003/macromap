import { describe, expect, it } from "vitest";
import { extractJsonLdMenu, htmlToText, looksLikeMenu, menuFileName, menuLinks, robotsAllows, validateAiDishes } from "@/lib/websiteMenu";

describe("extractJsonLdMenu", () => {
  it("reads schema.org Menu → MenuSection → MenuItem with prices", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Restaurant",
      hasMenu: {
        "@type": "Menu",
        hasMenuSection: [
          {
            "@type": "MenuSection",
            hasMenuItem: [
              { "@type": "MenuItem", name: "Kyllingwrap", description: "Kylling, salat, hvitløksdressing", offers: { "@type": "Offer", price: "159.00", priceCurrency: "NOK" } },
              { "@type": "MenuItem", name: "Falafel", offers: { price: 129 } },
            ],
          },
        ],
      },
    })}</script>`;
    expect(extractJsonLdMenu(html)).toEqual([
      { name: "Kyllingwrap", description: "Kylling, salat, hvitløksdressing", priceNok: 159 },
      { name: "Falafel", description: null, priceNok: 129 },
    ]);
  });

  it("ignores invalid JSON-LD", () => {
    expect(extractJsonLdMenu('<script type="application/ld+json">{oops</script>')).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("keeps visible blocks on separate lines and drops scripts/nav/footer", () => {
    const html = "<nav>Hjem Meny Kontakt</nav><h2>Pizza</h2><p>Margherita<br>Tomat, mozzarella</p><p>kr 189,-</p><script>x=1</script><footer>© 2026</footer>";
    expect(htmlToText(html)).toBe("Pizza\nMargherita\nTomat, mozzarella\nkr 189,-");
  });
});

describe("menuLinks", () => {
  it("finds same-site menu pages and PDFs, skipping other sites and unrelated pages", () => {
    const html = `
      <a href="/meny">Meny</a>
      <a href="/files/lunsjmeny.pdf">Lunsj (PDF)</a>
      <a href="https://wolt.com/x">Bestill på Wolt</a>
      <a href="/kontakt">Kontakt</a>
      <a href="/drikkemeny">Drikke</a>`;
    expect(menuLinks(html, "https://www.example.no/")).toEqual(["https://www.example.no/meny", "https://www.example.no/files/lunsjmeny.pdf"]);
  });
});

describe("robotsAllows", () => {
  it("follows the * group with longest-match precedence", () => {
    const robots = "User-agent: *\nDisallow: /admin\nAllow: /admin/public\n\nUser-agent: BadBot\nDisallow: /";
    expect(robotsAllows(robots, "/meny")).toBe(true);
    expect(robotsAllows(robots, "/admin/x")).toBe(false);
    expect(robotsAllows(robots, "/admin/public/meny")).toBe(true);
  });
  it("honours a group naming our bot", () => {
    expect(robotsAllows("User-agent: MacroMapBot\nDisallow: /\n\nUser-agent: *\nDisallow:", "/meny")).toBe(false);
  });
});

describe("AI output validation", () => {
  const page = "Våre retter\nKebab tallerken\nkr 189\nFalafel wrap\nkr 139";
  it("keeps only dishes that appear in the page text", () => {
    const raw = { dishes: [{ name: "Kebab tallerken", price_nok: 189 }, { name: "Lobster thermidor", price_nok: 699 }, { name: "falafel wrap", description: null, price_nok: 139 }] };
    expect(validateAiDishes(raw, page).map((d) => d.name)).toEqual(["Kebab tallerken", "falafel wrap"]);
  });
  it("rejects malformed output", () => {
    expect(validateAiDishes({ nope: 1 }, page)).toEqual([]);
  });
});

describe("dish quality filter", () => {
  it("drops fragments, add-ons and numbers; strips allergen codes", async () => {
    const { dedupeDishes } = await import("@/lib/websiteMenu");
    const out = dedupeDishes([
      { name: "Potetbåter + 45,- Egg +", description: null, priceNok: 35 },
      { name: "Med krem:", description: null, priceNok: 104 },
      { name: "60 /", description: null, priceNok: 70 },
      { name: "Margherita", description: "(G | M | S)", priceNok: 150 },
      { name: "Linn's special", description: "Tomato sauce, mozzarella", priceNok: 269 },
    ]);
    expect(out).toEqual([
      { name: "Margherita", description: null, priceNok: 150 },
      { name: "Linn's special", description: "Tomato sauce, mozzarella", priceNok: 269 },
    ]);
  });
  it("decodes HTML entities", () => {
    expect(htmlToText("<p>Linn&#039;s special &amp; more</p>")).toBe("Linn's special & more");
  });
});

describe("helpers", () => {
  it("menu gate needs prices and food words", () => {
    expect(looksLikeMenu("Kylling 159 kr\nLaks 189 kr\nBiff 249 kr\nsalat")).toBe(true);
    expect(looksLikeMenu("Velkommen! Åpent 11–22. Ring oss.")).toBe(false);
  });
  it("makes safe file names", () => {
    expect(menuFileName("osm:node/123")).toBe("osm_node_123");
  });
});
