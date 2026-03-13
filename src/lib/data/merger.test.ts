/**
 * Tests for the multi-source data merger and team name normalization.
 *
 * Covers:
 * - normalizeForMerge: abbreviation normalization rules
 * - mergeTeamData: cross-source merging with inconsistent naming
 * - Priority ordering (KenPom > Torvik > Evan Miya)
 * - Name mapping table integration
 */

import { describe, it, expect } from "vitest";
import { normalizeForMerge, mergeTeamData } from "./merger";
import type { MergeSource } from "./merger";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// normalizeForMerge
// ---------------------------------------------------------------------------

describe("normalizeForMerge", () => {
  describe("State / St. normalization", () => {
    it("normalizes 'Ohio St.' to match 'Ohio State'", () => {
      expect(normalizeForMerge("Ohio St.")).toBe(
        normalizeForMerge("Ohio State")
      );
    });

    it("normalizes 'Michigan St.' to match 'Michigan State'", () => {
      expect(normalizeForMerge("Michigan St.")).toBe(
        normalizeForMerge("Michigan State")
      );
    });

    it("normalizes 'Kansas St.' to match 'Kansas State'", () => {
      expect(normalizeForMerge("Kansas St.")).toBe(
        normalizeForMerge("Kansas State")
      );
    });

    it("normalizes 'Iowa St.' to match 'Iowa State'", () => {
      expect(normalizeForMerge("Iowa St.")).toBe(
        normalizeForMerge("Iowa State")
      );
    });

    it("normalizes 'Boise St.' to match 'Boise State'", () => {
      expect(normalizeForMerge("Boise St.")).toBe(
        normalizeForMerge("Boise State")
      );
    });

    it("normalizes 'Penn St.' to match 'Penn State'", () => {
      expect(normalizeForMerge("Penn St.")).toBe(
        normalizeForMerge("Penn State")
      );
    });

    it("normalizes 'Arizona St.' to match 'Arizona State'", () => {
      expect(normalizeForMerge("Arizona St.")).toBe(
        normalizeForMerge("Arizona State")
      );
    });

    it("normalizes 'Mississippi St.' to match 'Mississippi State'", () => {
      expect(normalizeForMerge("Mississippi St.")).toBe(
        normalizeForMerge("Mississippi State")
      );
    });

    it("does not change names without St. (e.g., 'Stanford')", () => {
      // Stanford should not be affected by State/St. rules
      expect(normalizeForMerge("Stanford")).toBe("stanford");
    });
  });

  describe("Saint / St. prefix normalization", () => {
    it("normalizes 'St. Mary's' to match 'Saint Mary's'", () => {
      expect(normalizeForMerge("St. Mary's")).toBe(
        normalizeForMerge("Saint Mary's")
      );
    });

    it("normalizes 'St. John's' to match 'Saint John's'", () => {
      expect(normalizeForMerge("St. John's")).toBe(
        normalizeForMerge("Saint John's")
      );
    });

    it("normalizes 'St. Joseph's' to match 'Saint Joseph's'", () => {
      expect(normalizeForMerge("St. Joseph's")).toBe(
        normalizeForMerge("Saint Joseph's")
      );
    });

    it("normalizes 'St. Peter's' to match 'Saint Peter's'", () => {
      expect(normalizeForMerge("St. Peter's")).toBe(
        normalizeForMerge("Saint Peter's")
      );
    });
  });

  describe("Kaggle-format names (no periods)", () => {
    it("normalizes 'Michigan St' (no period) to match 'Michigan State'", () => {
      expect(normalizeForMerge("Michigan St")).toBe(
        normalizeForMerge("Michigan State")
      );
    });

    it("normalizes 'Iowa St' (no period) to match 'Iowa State'", () => {
      expect(normalizeForMerge("Iowa St")).toBe(
        normalizeForMerge("Iowa State")
      );
    });

    it("normalizes 'St Louis' (no period prefix) to match 'Saint Louis'", () => {
      expect(normalizeForMerge("St Louis")).toBe(
        normalizeForMerge("Saint Louis")
      );
    });

    it("normalizes 'St Bonaventure' (no period) to match 'Saint Bonaventure'", () => {
      expect(normalizeForMerge("St Bonaventure")).toBe(
        normalizeForMerge("Saint Bonaventure")
      );
    });

    it("normalizes 'NC State' to match 'North Carolina State'", () => {
      expect(normalizeForMerge("NC State")).toBe(
        normalizeForMerge("North Carolina State")
      );
    });

    it("normalizes 'N Dakota St' to match 'North Dakota State'", () => {
      expect(normalizeForMerge("N Dakota St")).toBe(
        normalizeForMerge("North Dakota State")
      );
    });

    it("normalizes 'S Dakota St' to match 'South Dakota State'", () => {
      expect(normalizeForMerge("S Dakota St")).toBe(
        normalizeForMerge("South Dakota State")
      );
    });

    it("normalizes 'MS Valley St' to match 'Mississippi Valley State'", () => {
      expect(normalizeForMerge("MS Valley St")).toBe(
        normalizeForMerge("Mississippi Valley State")
      );
    });

    it("normalizes 'Mt St Marys' to match 'Mt. St. Mary's'", () => {
      expect(normalizeForMerge("Mt St Marys")).toBe(
        normalizeForMerge("Mt. St. Mary's")
      );
    });
  });

  describe("common abbreviation normalization", () => {
    it("normalizes UConn → connecticut", () => {
      expect(normalizeForMerge("UConn")).toBe("connecticut");
      expect(normalizeForMerge("Connecticut")).toBe("connecticut");
    });

    it("normalizes BYU → brigham young", () => {
      expect(normalizeForMerge("BYU")).toBe("brigham young");
      expect(normalizeForMerge("Brigham Young")).toBe("brigham young");
    });

    it("normalizes TCU → texas christian", () => {
      expect(normalizeForMerge("TCU")).toBe("texas christian");
      expect(normalizeForMerge("Texas Christian")).toBe("texas christian");
    });

    it("normalizes VCU → virginia commonwealth", () => {
      expect(normalizeForMerge("VCU")).toBe("virginia commonwealth");
      expect(normalizeForMerge("Virginia Commonwealth")).toBe(
        "virginia commonwealth"
      );
    });

    it("normalizes UCF → central florida", () => {
      expect(normalizeForMerge("UCF")).toBe("central florida");
      expect(normalizeForMerge("Central Florida")).toBe("central florida");
    });

    it("normalizes USF → south florida", () => {
      expect(normalizeForMerge("USF")).toBe("south florida");
      expect(normalizeForMerge("South Florida")).toBe("south florida");
    });

    it("normalizes UMass → massachusetts", () => {
      expect(normalizeForMerge("UMass")).toBe("massachusetts");
      expect(normalizeForMerge("Massachusetts")).toBe("massachusetts");
    });

    it("normalizes UNC → north carolina", () => {
      expect(normalizeForMerge("UNC")).toBe("north carolina");
      expect(normalizeForMerge("North Carolina")).toBe("north carolina");
    });

    it("normalizes USC → southern california", () => {
      expect(normalizeForMerge("USC")).toBe("southern california");
      expect(normalizeForMerge("Southern California")).toBe(
        "southern california"
      );
    });
  });

  describe("directional abbreviation normalization", () => {
    it("normalizes 'N.C. State' to match 'North Carolina State'", () => {
      expect(normalizeForMerge("N.C. State")).toBe(
        normalizeForMerge("North Carolina State")
      );
    });

    it("normalizes 'S.C. State' to match 'South Carolina State'", () => {
      expect(normalizeForMerge("S.C. State")).toBe(
        normalizeForMerge("South Carolina State")
      );
    });
  });

  describe("punctuation normalization", () => {
    it("strips apostrophes (Mary's → Marys)", () => {
      const result = normalizeForMerge("Saint Mary's");
      expect(result).not.toContain("'");
      expect(result).toBe("saint marys");
    });

    it("strips periods", () => {
      const result = normalizeForMerge("Appalachian St.");
      expect(result).not.toContain(".");
    });

    it("collapses multiple spaces", () => {
      const result = normalizeForMerge("  Ohio   State  ");
      expect(result).toBe("ohio state");
    });
  });

  describe("teams that should NOT collide", () => {
    it("Ohio and Ohio State produce different keys", () => {
      expect(normalizeForMerge("Ohio")).not.toBe(
        normalizeForMerge("Ohio State")
      );
    });

    it("Michigan and Michigan State produce different keys", () => {
      expect(normalizeForMerge("Michigan")).not.toBe(
        normalizeForMerge("Michigan State")
      );
    });

    it("Penn and Penn State produce different keys", () => {
      expect(normalizeForMerge("Penn")).not.toBe(
        normalizeForMerge("Penn State")
      );
    });

    it("Kansas and Kansas State produce different keys", () => {
      expect(normalizeForMerge("Kansas")).not.toBe(
        normalizeForMerge("Kansas State")
      );
    });
  });
});

// ---------------------------------------------------------------------------
// mergeTeamData — cross-source merging
// ---------------------------------------------------------------------------

describe("mergeTeamData", () => {
  /** Helper to create a minimal partial TeamSeason from a source */
  function makePartial(
    name: string,
    source: "kenpom" | "torvik" | "evanmiya",
    season: number = 2025,
    adjEM: number = 10.0
  ): Partial<TeamSeason> {
    const adjOE = 110 + adjEM * 0.5;
    const adjDE = adjOE - adjEM;

    const ratings: TeamSeason["ratings"] = {};
    ratings[source] = {
      source,
      adjOE,
      adjDE,
      adjEM,
    };

    return {
      season,
      dataSources: [source],
      team: {
        id: "",
        name,
        shortName: name,
        conference: "Big 12",
        campus: { city: "", state: "", latitude: 0, longitude: 0 },
      },
      ratings,
    };
  }

  it("merges KenPom and Torvik records with different name conventions", () => {
    const sources: MergeSource[] = [
      {
        source: "kenpom",
        data: [makePartial("Ohio State", "kenpom", 2025, 20)],
      },
      {
        source: "torvik",
        data: [makePartial("Ohio St.", "torvik", 2025, 19)],
      },
    ];

    const result = mergeTeamData(sources);

    // Should produce 1 merged record, not 2 separate ones
    expect(result).toHaveLength(1);

    // Should have both ratings slots populated
    const merged = result[0];
    expect(merged.ratings?.kenpom).toBeDefined();
    expect(merged.ratings?.torvik).toBeDefined();
    expect(merged.dataSources).toContain("kenpom");
    expect(merged.dataSources).toContain("torvik");
  });

  it("merges UConn / Connecticut across sources", () => {
    const sources: MergeSource[] = [
      {
        source: "kenpom",
        data: [makePartial("Connecticut", "kenpom", 2025, 25)],
      },
      {
        source: "torvik",
        data: [makePartial("UConn", "torvik", 2025, 24)],
      },
    ];

    const result = mergeTeamData(sources);

    expect(result).toHaveLength(1);
    expect(result[0].ratings?.kenpom).toBeDefined();
    expect(result[0].ratings?.torvik).toBeDefined();
  });

  it("merges multiple 'State' teams correctly without cross-contamination", () => {
    const sources: MergeSource[] = [
      {
        source: "kenpom",
        data: [
          makePartial("Ohio State", "kenpom", 2025, 20),
          makePartial("Michigan State", "kenpom", 2025, 22),
          makePartial("Ohio", "kenpom", 2025, 5),
          makePartial("Michigan", "kenpom", 2025, 18),
        ],
      },
      {
        source: "torvik",
        data: [
          makePartial("Ohio St.", "torvik", 2025, 19),
          makePartial("Michigan St.", "torvik", 2025, 21),
          makePartial("Ohio", "torvik", 2025, 4),
          makePartial("Michigan", "torvik", 2025, 17),
        ],
      },
    ];

    const result = mergeTeamData(sources);

    // Should produce exactly 4 merged records
    expect(result).toHaveLength(4);

    // Each should have both ratings
    for (const team of result) {
      expect(team.ratings?.kenpom).toBeDefined();
      expect(team.ratings?.torvik).toBeDefined();
      expect(team.dataSources).toHaveLength(2);
    }
  });

  it("KenPom takes priority for overlapping statistical fields", () => {
    const kenpomRecord = makePartial("Duke", "kenpom", 2025, 25);
    kenpomRecord.adjTempo = 70.0;

    const torvikRecord = makePartial("Duke", "torvik", 2025, 24);
    torvikRecord.adjTempo = 68.5;

    const sources: MergeSource[] = [
      { source: "kenpom", data: [kenpomRecord] },
      { source: "torvik", data: [torvikRecord] },
    ];

    const result = mergeTeamData(sources);

    expect(result).toHaveLength(1);
    // KenPom's tempo should win (it's processed first by priority)
    expect(result[0].adjTempo).toBe(70.0);
  });

  it("handles single-source records without merging", () => {
    const sources: MergeSource[] = [
      {
        source: "kenpom",
        data: [makePartial("Gonzaga", "kenpom", 2025, 23)],
      },
    ];

    const result = mergeTeamData(sources);

    expect(result).toHaveLength(1);
    expect(result[0].ratings?.kenpom).toBeDefined();
    expect(result[0].ratings?.torvik).toBeUndefined();
    expect(result[0].dataSources).toEqual(["kenpom"]);
  });

  it("merges all three sources when names align", () => {
    const sources: MergeSource[] = [
      {
        source: "kenpom",
        data: [makePartial("Duke", "kenpom", 2025, 25)],
      },
      {
        source: "torvik",
        data: [makePartial("Duke", "torvik", 2025, 24)],
      },
      {
        source: "evanmiya",
        data: [makePartial("Duke", "evanmiya", 2025, 26)],
      },
    ];

    const result = mergeTeamData(sources);

    expect(result).toHaveLength(1);
    expect(result[0].ratings?.kenpom).toBeDefined();
    expect(result[0].ratings?.torvik).toBeDefined();
    expect(result[0].ratings?.evanmiya).toBeDefined();
    expect(result[0].dataSources).toHaveLength(3);
  });

  it("keeps records separate when they are genuinely different teams", () => {
    const sources: MergeSource[] = [
      {
        source: "kenpom",
        data: [
          makePartial("Ohio", "kenpom", 2025, 5),
          makePartial("Ohio State", "kenpom", 2025, 20),
        ],
      },
    ];

    const result = mergeTeamData(sources);

    // These are different teams — should NOT be merged
    expect(result).toHaveLength(2);
  });
});
