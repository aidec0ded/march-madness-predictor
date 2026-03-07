/**
 * Tests for the generic CSV parser.
 */

import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv-parser";

describe("parseCsv", () => {
  // -------------------------------------------------------------------------
  // Basic parsing
  // -------------------------------------------------------------------------

  it("should parse a simple CSV with a header row", () => {
    const csv = "Name,Score,Grade\nAlice,95,A\nBob,87,B+";
    const result = parseCsv<{ Name: string; Score: string; Grade: string }>(
      csv
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "Alice", Score: "95", Grade: "A" });
    expect(result[1]).toEqual({ Name: "Bob", Score: "87", Grade: "B+" });
  });

  it("should return an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   ")).toEqual([]);
  });

  it("should return an empty array for header-only CSV", () => {
    const csv = "Name,Score,Grade";
    const result = parseCsv(csv);
    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Quoted fields
  // -------------------------------------------------------------------------

  it("should handle quoted fields containing commas", () => {
    const csv =
      'Team,City,Record\n"St. Mary\'s","Oakland, CA","28-5"\nDuke,Durham,"30-3"';
    const result = parseCsv<{ Team: string; City: string; Record: string }>(
      csv
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      Team: "St. Mary's",
      City: "Oakland, CA",
      Record: "28-5",
    });
    expect(result[1]).toEqual({
      Team: "Duke",
      City: "Durham",
      Record: "30-3",
    });
  });

  it("should handle escaped quotes (doubled double-quotes)", () => {
    const csv = 'Name,Nickname\nBob,"""The King"""\nAlice,"The ""Great"" One"';
    const result = parseCsv<{ Name: string; Nickname: string }>(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "Bob", Nickname: '"The King"' });
    expect(result[1]).toEqual({ Name: "Alice", Nickname: 'The "Great" One' });
  });

  it("should handle quoted fields with embedded newlines", () => {
    const csv = 'Name,Bio\nAlice,"Line 1\nLine 2"\nBob,Simple';
    const result = parseCsv<{ Name: string; Bio: string }>(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "Alice", Bio: "Line 1\nLine 2" });
    expect(result[1]).toEqual({ Name: "Bob", Bio: "Simple" });
  });

  // -------------------------------------------------------------------------
  // Empty fields
  // -------------------------------------------------------------------------

  it("should handle empty fields", () => {
    const csv = "A,B,C\n1,,3\n,,\n4,5,";
    const result = parseCsv<{ A: string; B: string; C: string }>(csv);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ A: "1", B: "", C: "3" });
    expect(result[1]).toEqual({ A: "", B: "", C: "" });
    expect(result[2]).toEqual({ A: "4", B: "5", C: "" });
  });

  it("should fill missing trailing fields with empty strings", () => {
    const csv = "A,B,C\n1,2\n1";
    const result = parseCsv<{ A: string; B: string; C: string }>(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ A: "1", B: "2", C: "" });
    expect(result[1]).toEqual({ A: "1", B: "", C: "" });
  });

  // -------------------------------------------------------------------------
  // Numeric string values
  // -------------------------------------------------------------------------

  it("should preserve numeric values as strings", () => {
    const csv =
      "Team,AdjO,AdjD,AdjEM\nDuke,118.5,94.3,24.2\nUConn,121.1,89.7,31.4";
    const result = parseCsv<{
      Team: string;
      AdjO: string;
      AdjD: string;
      AdjEM: string;
    }>(csv);

    expect(result).toHaveLength(2);
    expect(result[0].AdjO).toBe("118.5");
    expect(result[0].AdjD).toBe("94.3");
    expect(result[0].AdjEM).toBe("24.2");
    expect(typeof result[0].AdjO).toBe("string");
  });

  // -------------------------------------------------------------------------
  // Whitespace and line endings
  // -------------------------------------------------------------------------

  it("should trim field values by default", () => {
    const csv = "Name , Score , Grade\n  Alice , 95 , A ";
    const result = parseCsv<{ Name: string; Score: string; Grade: string }>(
      csv
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ Name: "Alice", Score: "95", Grade: "A" });
  });

  it("should preserve whitespace when trimFields is false", () => {
    const csv = "Name,Score\n  Alice , 95 ";
    const result = parseCsv<{ Name: string; Score: string }>(csv, {
      trimFields: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ Name: "  Alice ", Score: " 95 " });
  });

  it("should handle Windows-style CRLF line endings", () => {
    const csv = "Name,Score\r\nAlice,95\r\nBob,87\r\n";
    const result = parseCsv<{ Name: string; Score: string }>(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "Alice", Score: "95" });
    expect(result[1]).toEqual({ Name: "Bob", Score: "87" });
  });

  it("should skip blank lines in the body", () => {
    const csv = "Name,Score\nAlice,95\n\nBob,87\n\n";
    const result = parseCsv<{ Name: string; Score: string }>(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "Alice", Score: "95" });
    expect(result[1]).toEqual({ Name: "Bob", Score: "87" });
  });

  // -------------------------------------------------------------------------
  // Custom delimiter
  // -------------------------------------------------------------------------

  it("should support a custom delimiter", () => {
    const csv = "Name\tScore\nAlice\t95\nBob\t87";
    const result = parseCsv<{ Name: string; Score: string }>(csv, {
      delimiter: "\t",
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ Name: "Alice", Score: "95" });
  });

  // -------------------------------------------------------------------------
  // KenPom-style headers with special characters
  // -------------------------------------------------------------------------

  it("should handle headers with special characters like % and /", () => {
    const csv = "Team,OE-eFG%,3PA/FGA,BenchMin%\nDuke,54.2,35.1,22.5";
    const result = parseCsv<Record<string, string>>(csv);

    expect(result).toHaveLength(1);
    expect(result[0]["OE-eFG%"]).toBe("54.2");
    expect(result[0]["3PA/FGA"]).toBe("35.1");
    expect(result[0]["BenchMin%"]).toBe("22.5");
  });
});
