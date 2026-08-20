import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const stateSource = fs.readFileSync(path.join(repoRoot, "js/state.js"), "utf8");

function loadSortingHelpers() {
  const helperSource = stateSource.slice(0, stateSource.indexOf("const state ="));
  const context = vm.createContext({ Intl });
  vm.runInContext(`${helperSource}\nthis.sortChargersForDisplay = sortChargersForDisplay;`, context);
  return context.sortChargersForDisplay;
}

describe("frontend charger display ordering", () => {
  const sortChargers = loadSortingHelpers();

  it("naturally orders leading-zero and non-leading-zero charger numbers", () => {
    const input = ["Charger 10", "Charger 09", "Charger 2", "Charger 01", "Charger 02"]
      .map((name) => ({ name }));

    expect(sortChargers(input).map(({ name }) => name)).toEqual([
      "Charger 01", "Charger 2", "Charger 02", "Charger 09", "Charger 10",
    ]);
  });

  it("orders Charger 01 through Charger 10 regardless of incoming order", () => {
    const input = [10, 8, 9, 1, 5, 3, 7, 2, 6, 4]
      .map((number) => ({ name: `Al Mana AC Charger ${String(number).padStart(2, "0")}`, type: "AC" }));

    expect(sortChargers(input).map(({ name }) => name)).toEqual(
      Array.from({ length: 10 }, (_, index) => `Al Mana AC Charger ${String(index + 1).padStart(2, "0")}`),
    );
  });

  it("groups AC before DC and orders numbers within each group", () => {
    const input = [
      { name: "Al Mana DC Charger 10", type: "DC" },
      { name: "Al Mana AC Charger 10", type: "AC" },
      { name: "Al Mana DC Charger 2", type: "DC" },
      { name: "Al Mana AC Charger 01", type: "AC" },
    ];

    expect(sortChargers(input).map(({ name }) => name)).toEqual([
      "Al Mana AC Charger 01", "Al Mana AC Charger 10",
      "Al Mana DC Charger 2", "Al Mana DC Charger 10",
    ]);
  });

  it("derives AC/DC grouping from the existing name when type is unavailable", () => {
    const input = [
      { name: "Site DC Charger 01" },
      { name: "Site AC Charger 02" },
      { name: "Site AC Charger 01" },
    ];

    expect(sortChargers(input).map(({ name }) => name)).toEqual([
      "Site AC Charger 01", "Site AC Charger 02", "Site DC Charger 01",
    ]);
  });

  it("is stable when display keys are equal and does not mutate the source collection", () => {
    const input = [
      { id: "first", name: "AC Charger 01", type: "AC" },
      { id: "second", name: "AC Charger 01", type: "AC" },
    ];
    const sorted = sortChargers(input);

    expect(sorted.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(sorted).not.toBe(input);
    expect(input.map(({ id }) => id)).toEqual(["first", "second"]);
  });

  it("uses the shared helper for cards and every active charger dropdown", () => {
    const sites = fs.readFileSync(path.join(repoRoot, "frontend/pages/sites/site-profile.js"), "utf8");
    const modals = fs.readFileSync(path.join(repoRoot, "js/modals.js"), "utf8");
    const requests = fs.readFileSync(path.join(repoRoot, "frontend/pages/requests/requests-shared.js"), "utf8");

    expect(sites).toContain("const chargers = sortChargersForDisplay(siteRecord?.chargers || [])");
    expect(modals.match(/sortChargersForDisplay\(/g)).toHaveLength(2);
    expect(requests).toContain("return sortChargersForDisplay(");
  });
});
