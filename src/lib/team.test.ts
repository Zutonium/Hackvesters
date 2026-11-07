import { describe, expect, it } from "vitest";

import raw from "@/data/dashboard.json";
import { topPerformingTeam, totalStaff } from "./models";
import type { DashboardData } from "./types";

const data = raw as unknown as DashboardData;

describe("Overview team cards", () => {
  it("top performing team is the café with the most profit per team member", () => {
    const top = topPerformingTeam(data.stores)!;
    expect(top.store.store_id).toBe("S02");
    expect(Math.round(top.profitPerHead)).toBe(13527);
  });

  it("staff size counts everyone across the 12 cafés", () => {
    expect(totalStaff(data.stores)).toBe(187);
  });
});
