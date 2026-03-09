/**
 * Tests for the KenPom multi-CSV merger.
 */

import { describe, it, expect } from "vitest";
import { mergeKenPomCsvs } from "./kenpom-csv-merger";

// ---------------------------------------------------------------------------
// Test CSV data (inline strings)
// ---------------------------------------------------------------------------

const MAIN_CSV = `Season,TeamName,Tempo,RankTempo,AdjTempo,RankAdjTempo,OE,RankOE,AdjOE,RankAdjOE,DE,RankDE,AdjDE,RankAdjDE,AdjEM,RankAdjEM,seed
2025,Connecticut,68.1,50,67.8,48,118.5,3,121.1,1,85.2,1,89.7,2,31.4,1,1
2025,Duke,70.2,22,69.5,20,115.3,8,118.0,5,90.1,15,91.5,10,26.5,3,2`;

const OFFENSE_CSV = `Season,TeamName,eFGPct,RankeFGPct,TOPct,RankTOPct,ORPct,RankORPct,FTRate,RankFTRate
2025,Connecticut,55.2,5,16.3,30,34.1,10,36.8,25
2025,Duke,53.8,12,15.1,20,31.5,22,38.2,15`;

const DEFENSE_CSV = `Season,TeamName,eFGPct,RankeFGPct,TOPct,RankTOPct,ORPct,RankORPct,FTRate,RankFTRate
2025,Connecticut,44.1,3,21.5,8,24.3,5,28.9,12
2025,Duke,46.2,10,20.1,15,26.0,12,30.5,20`;

const MISC_CSV = `Season,TeamName,FG2Pct,RankFG2Pct,FG3Pct,RankFG3Pct,FTPct,RankFTPct,BlockPct,RankBlockPct,OppFG2Pct,RankOppFG2Pct,OppFG3Pct,RankOppFG3Pct,OppFTPct,RankOppFTPct,OppBlockPct,RankOppBlockPct,FG3Rate,RankFG3Rate,OppFG3Rate,RankOppFG3Rate,ARate,RankARate,OppARate,RankOppARate,StlRate,RankStlRate,OppStlRate,RankOppStlRate,DFP,NSTRate,RankNSTRate,OppNSTRate,RankOppNSTRate
2025,Connecticut,52.1,5,36.5,15,73.5,30,12.5,8,45.0,3,30.1,5,68.2,20,10.0,40,38.2,25,33.4,30,55.0,10,48.0,15,10.5,12,9.0,20,0.14,35.0,10,32.0,15
2025,Duke,51.0,10,35.0,20,75.0,15,11.0,15,46.5,8,31.5,12,70.0,10,9.5,50,40.0,15,35.0,22,53.0,18,50.0,10,11.0,8,8.5,25,0.22,33.0,18,30.0,20`;

const HEIGHT_CSV = `Season,TeamName,Size,SizeRank,Exp,ExpRank,Bench,BenchRank,Continuity,RankContinuity,HgtEff,HgtEffRank
2025,Connecticut,78.2,15,2.15,20,28.5,30,62.3,18,3.5,10
2025,Duke,79.0,8,1.85,45,32.0,15,55.0,35,4.0,5`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mergeKenPomCsvs", () => {
  it("should merge all 5 CSVs into complete rows with correct field mapping", () => {
    const result = mergeKenPomCsvs({
      main: MAIN_CSV,
      offense: OFFENSE_CSV,
      defense: DEFENSE_CSV,
      misc: MISC_CSV,
      height: HEIGHT_CSV,
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.csvSummary).toEqual({
      main: 2,
      offense: 2,
      defense: 2,
      misc: 2,
      height: 2,
    });

    // Check Connecticut (first row)
    const uconn = result.data.find((r) => r.teamName === "Connecticut")!;
    expect(uconn).toBeDefined();

    // Main CSV fields
    expect(uconn.adjOE).toBe(121.1);
    expect(uconn.adjDE).toBe(89.7);
    expect(uconn.adjEM).toBe(31.4);
    expect(uconn.adjTempo).toBe(67.8);
    expect(uconn.seed).toBe("1");

    // Offense CSV fields
    expect(uconn.offEfgPct).toBe(55.2);
    expect(uconn.offToPct).toBe(16.3);
    expect(uconn.offOrbPct).toBe(34.1);
    expect(uconn.offFtRate).toBe(36.8);

    // Defense CSV fields
    expect(uconn.defEfgPct).toBe(44.1);
    expect(uconn.defToPct).toBe(21.5);
    expect(uconn.defOrbPct).toBe(24.3);
    expect(uconn.defFtRate).toBe(28.9);

    // Misc CSV fields
    expect(uconn.offThreePtPct).toBe(36.5);
    expect(uconn.offFtPct).toBe(73.5);
    expect(uconn.offThreePtRate).toBe(38.2);
    expect(uconn.defThreePtPct).toBe(30.1);
    expect(uconn.defFtPct).toBe(68.2);
    expect(uconn.defThreePtRate).toBe(33.4);
    // DFP column is intentionally ignored — it is NOT 2-Foul Participation
    expect(uconn.twoFoulParticipation).toBeNull();

    // Height CSV fields
    expect(uconn.avgHeight).toBe(78.2);
    expect(uconn.experience).toBe(2.15);
    expect(uconn.benchMinutesPct).toBe(28.5);
    expect(uconn.minutesContinuity).toBe(62.3);

    // Verify Duke too
    const duke = result.data.find((r) => r.teamName === "Duke")!;
    expect(duke).toBeDefined();
    expect(duke.adjOE).toBe(118.0);
    expect(duke.seed).toBe("2");
    expect(duke.twoFoulParticipation).toBeNull(); // DFP is not 2-Foul Participation
  });

  it("should work with main CSV only (optional fields are null)", () => {
    const result = mergeKenPomCsvs({ main: MAIN_CSV });

    expect(result.warnings).toHaveLength(0);
    expect(result.data).toHaveLength(2);
    expect(result.csvSummary).toEqual({
      main: 2,
      offense: 0,
      defense: 0,
      misc: 0,
      height: 0,
    });

    const uconn = result.data.find((r) => r.teamName === "Connecticut")!;

    // Main CSV fields should be present
    expect(uconn.adjOE).toBe(121.1);
    expect(uconn.adjDE).toBe(89.7);
    expect(uconn.adjEM).toBe(31.4);

    // Optional CSV fields should all be null
    expect(uconn.offEfgPct).toBeNull();
    expect(uconn.offToPct).toBeNull();
    expect(uconn.offOrbPct).toBeNull();
    expect(uconn.offFtRate).toBeNull();
    expect(uconn.defEfgPct).toBeNull();
    expect(uconn.defToPct).toBeNull();
    expect(uconn.defOrbPct).toBeNull();
    expect(uconn.defFtRate).toBeNull();
    expect(uconn.offThreePtPct).toBeNull();
    expect(uconn.offFtPct).toBeNull();
    expect(uconn.offThreePtRate).toBeNull();
    expect(uconn.defThreePtPct).toBeNull();
    expect(uconn.defFtPct).toBeNull();
    expect(uconn.defThreePtRate).toBeNull();
    expect(uconn.twoFoulParticipation).toBeNull();
    expect(uconn.avgHeight).toBeNull();
    expect(uconn.experience).toBeNull();
    expect(uconn.benchMinutesPct).toBeNull();
    expect(uconn.minutesContinuity).toBeNull();
  });

  it("should normalize team names with extra whitespace", () => {
    const mainWithSpaces = `Season,TeamName,Tempo,RankTempo,AdjTempo,RankAdjTempo,OE,RankOE,AdjOE,RankAdjOE,DE,RankDE,AdjDE,RankAdjDE,AdjEM,RankAdjEM,seed
2025,  North  Carolina  ,68.0,50,67.5,48,115.0,5,118.0,3,88.0,5,90.0,5,28.0,2,3`;

    const offenseWithSpaces = `Season,TeamName,eFGPct,RankeFGPct,TOPct,RankTOPct,ORPct,RankORPct,FTRate,RankFTRate
2025,  North  Carolina  ,54.0,8,17.0,25,32.0,15,35.0,30`;

    const result = mergeKenPomCsvs({
      main: mainWithSpaces,
      offense: offenseWithSpaces,
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].teamName).toBe("North Carolina");
    expect(result.data[0].adjOE).toBe(118.0);
    expect(result.data[0].offEfgPct).toBe(54.0);
  });

  it("should always ignore DFP column (it is not 2-Foul Participation)", () => {
    const mainCsv = `Season,TeamName,Tempo,RankTempo,AdjTempo,RankAdjTempo,OE,RankOE,AdjOE,RankAdjOE,DE,RankDE,AdjDE,RankAdjDE,AdjEM,RankAdjEM,seed
2025,TestTeam,68.0,50,67.5,48,115.0,5,118.0,3,88.0,5,90.0,5,28.0,2,1`;

    // DFP column present with various values — all should be ignored
    const miscCsv = `Season,TeamName,FG2Pct,RankFG2Pct,FG3Pct,RankFG3Pct,FTPct,RankFTPct,BlockPct,RankBlockPct,OppFG2Pct,RankOppFG2Pct,OppFG3Pct,RankOppFG3Pct,OppFTPct,RankOppFTPct,OppBlockPct,RankOppBlockPct,FG3Rate,RankFG3Rate,OppFG3Rate,RankOppFG3Rate,ARate,RankARate,OppARate,RankOppARate,StlRate,RankStlRate,OppStlRate,RankOppStlRate,DFP,NSTRate,RankNSTRate,OppNSTRate,RankOppNSTRate
2025,TestTeam,50.0,10,35.0,20,72.0,25,11.0,15,47.0,10,32.0,15,69.0,12,10.0,45,39.0,20,34.0,25,54.0,12,49.0,12,10.0,15,9.0,22,0.14,34.0,12,31.0,18`;

    const result = mergeKenPomCsvs({ main: mainCsv, misc: miscCsv });

    // DFP is never mapped to twoFoulParticipation — that stat is only
    // visible on individual KenPom team pages and not in any CSV export
    expect(result.data[0].twoFoulParticipation).toBeNull();

    // Other misc fields should still work
    expect(result.data[0].offThreePtPct).toBe(35.0);
    expect(result.data[0].defFtPct).toBe(69.0);
  });

  it("should handle NULL string in seed and DFP fields", () => {
    const mainCsv = `Season,TeamName,Tempo,RankTempo,AdjTempo,RankAdjTempo,OE,RankOE,AdjOE,RankAdjOE,DE,RankDE,AdjDE,RankAdjDE,AdjEM,RankAdjEM,seed
2025,NoSeedTeam,68.0,50,67.5,48,110.0,30,112.0,28,92.0,30,94.0,28,18.0,25,NULL`;

    const miscCsv = `Season,TeamName,FG2Pct,RankFG2Pct,FG3Pct,RankFG3Pct,FTPct,RankFTPct,BlockPct,RankBlockPct,OppFG2Pct,RankOppFG2Pct,OppFG3Pct,RankOppFG3Pct,OppFTPct,RankOppFTPct,OppBlockPct,RankOppBlockPct,FG3Rate,RankFG3Rate,OppFG3Rate,RankOppFG3Rate,ARate,RankARate,OppARate,RankOppARate,StlRate,RankStlRate,OppStlRate,RankOppStlRate,DFP,NSTRate,RankNSTRate,OppNSTRate,RankOppNSTRate
2025,NoSeedTeam,50.0,10,35.0,20,72.0,25,11.0,15,47.0,10,32.0,15,69.0,12,10.0,45,39.0,20,34.0,25,54.0,12,49.0,12,10.0,15,9.0,22,NULL,34.0,12,31.0,18`;

    const result = mergeKenPomCsvs({ main: mainCsv, misc: miscCsv });

    expect(result.data[0].seed).toBeNull();
    expect(result.data[0].twoFoulParticipation).toBeNull();
  });

  it("should warn when optional CSV teams are not found in main CSV", () => {
    const mainCsv = `Season,TeamName,Tempo,RankTempo,AdjTempo,RankAdjTempo,OE,RankOE,AdjOE,RankAdjOE,DE,RankDE,AdjDE,RankAdjDE,AdjEM,RankAdjEM,seed
2025,Connecticut,68.1,50,67.8,48,118.5,3,121.1,1,85.2,1,89.7,2,31.4,1,1`;

    // Offense CSV has a team not in main
    const offenseCsv = `Season,TeamName,eFGPct,RankeFGPct,TOPct,RankTOPct,ORPct,RankORPct,FTRate,RankFTRate
2025,Connecticut,55.2,5,16.3,30,34.1,10,36.8,25
2025,UnknownTeam,50.0,50,18.0,50,30.0,50,33.0,50`;

    const result = mergeKenPomCsvs({ main: mainCsv, offense: offenseCsv });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("offense");
    expect(result.warnings[0]).toContain("1 team(s) not found in main CSV");

    // Connecticut should still be fully populated
    expect(result.data).toHaveLength(1);
    expect(result.data[0].offEfgPct).toBe(55.2);
  });

  it("should return empty array for empty main CSV", () => {
    const result = mergeKenPomCsvs({ main: "" });

    expect(result.data).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.csvSummary.main).toBe(0);
  });

  it("should return empty array for header-only main CSV", () => {
    const headerOnly = `Season,TeamName,Tempo,RankTempo,AdjTempo,RankAdjTempo,OE,RankOE,AdjOE,RankAdjOE,DE,RankDE,AdjDE,RankAdjDE,AdjEM,RankAdjEM,seed`;

    const result = mergeKenPomCsvs({ main: headerOnly });

    expect(result.data).toHaveLength(0);
    expect(result.csvSummary.main).toBe(0);
  });
});
