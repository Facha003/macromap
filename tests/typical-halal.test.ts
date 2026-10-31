import { describe, expect, it } from "vitest";
import { resolveBasis, templateBasis } from "@/lib/nutrition/basis";
import { containsPork, halalStatus, passesHalalFilter } from "@/lib/halal";
import { parseTypicalId, restaurantKind, typicalDishesFor, typicalId } from "@/lib/typicalDishes";

describe("typical dishes", () => {
  it("every typical dish gets a template estimate", () => {
    for (const kind of ["kebab", "pizza", "burger", "sushi", "thai", "coffee_shop", "bubble_tea", "salad"]) {
      const t = typicalDishesFor({ name: "X", cuisines: [kind] })!;
      for (const d of t.dishes) {
        const r = resolveBasis(templateBasis(d.name, d.description));
        expect(r.estimate, `${kind}: ${d.name}`).not.toBeNull();
      }
    }
  });

  it("infers the kind of place from cuisine, then name, then amenity", () => {
    expect(restaurantKind({ name: "Bislett Kebab House", cuisines: [] })).toBe("kebab");
    expect(restaurantKind({ name: "Luigi", cuisines: ["italian"] })).toBe("pizza");
    expect(restaurantKind({ name: "Kaffebrenneriet", cuisines: [] })).toBe("cafe");
    expect(restaurantKind({ name: "Smith & Co", cuisines: [], amenity: "cafe" })).toBe("cafe");
    expect(restaurantKind({ name: "Smith & Co", cuisines: ["indian"] })).toBe("indian");
    expect(restaurantKind({ name: "Smith & Co", cuisines: ["ethiopian"] })).toBeNull();
  });

  it("round-trips ids even though restaurant ids contain colons", () => {
    const id = typicalId("osm:node/123", "durum");
    expect(parseTypicalId(id)).toEqual({ slug: "durum", restaurantId: "osm:node/123" });
    expect(parseTypicalId("demo:x:1")).toBeNull();
  });
});

describe("halal", () => {
  it("separates evidence sources from assumptions", () => {
    expect(halalStatus({ name: "A", cuisines: [], halalTag: "yes" }).status).toBe("osm");
    expect(halalStatus({ name: "A", cuisines: [], statedHalal: true }).status).toBe("restaurant");
    expect(halalStatus({ name: "Best Halal Grill", cuisines: [] }).status).toBe("restaurant");
    expect(halalStatus({ name: "Pizza", cuisines: [] }, "halal").status).toBe("reported");
    expect(halalStatus({ name: "Best Kebab", cuisines: [] }).status).toBe("possible");
    expect(halalStatus({ name: "A", cuisines: ["turkish"] }).status).toBe("possible");
    expect(halalStatus({ name: "Pizza Hut", cuisines: ["pizza"] }).status).toBe("unknown");
    expect(halalStatus({ name: "Best Kebab", cuisines: [] }, "not").status).toBe("not");
  });

  it("strict filter excludes cuisine-only places unless opted in", () => {
    const turkish = halalStatus({ name: "Istanbul Grill", cuisines: ["turkish"] }).status;
    expect(passesHalalFilter(turkish)).toBe(false);
    expect(passesHalalFilter(turkish, true)).toBe(true);
    expect(passesHalalFilter("osm")).toBe(true);
    expect(passesHalalFilter("reported")).toBe(true);
    expect(passesHalalFilter("unknown", true)).toBe(false);
  });

  it("detects pork and alcohol in recipes (used only to hide dishes)", () => {
    expect(containsPork(resolveBasis(templateBasis("Pepperoni pizza", "")).estimate!.components)).toBe(true);
    expect(containsPork(resolveBasis(templateBasis("Margherita pizza", "")).estimate!.components)).toBe(false);
  });
});
