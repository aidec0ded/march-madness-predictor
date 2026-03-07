/**
 * Generic CSV parser for the March Madness Bracket Predictor.
 *
 * Parses raw CSV strings into typed arrays of objects. Handles common CSV
 * edge cases including quoted fields, embedded commas, escaped quotes,
 * and mixed line endings. Dependency-free -- does not rely on any external
 * CSV library.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for customizing CSV parsing behavior.
 */
export interface CsvParseOptions {
  /** Field delimiter character. Defaults to comma (","). */
  delimiter?: string;
  /** Whether to trim whitespace from field values. Defaults to true. */
  trimFields?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Splits a single CSV line into an array of field values, respecting
 * quoted fields that may contain the delimiter or newlines.
 *
 * @param line - A single logical CSV line (may span multiple raw lines if
 *   a quoted field contains newlines -- that case is handled by the caller).
 * @param delimiter - The field delimiter character.
 * @param trim - Whether to trim whitespace from unquoted fields.
 * @returns An array of string field values.
 */
function parseFields(line: string, delimiter: string, trim: boolean): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Look ahead: doubled quote is an escaped quote inside a field
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // Otherwise, closing quote
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === delimiter) {
        fields.push(trim ? current.trim() : current);
        current = "";
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Push the last field
  fields.push(trim ? current.trim() : current);

  return fields;
}

/**
 * Splits the raw CSV content into logical lines, handling quoted fields
 * that span multiple lines. Also normalizes line endings (CRLF -> LF).
 *
 * @param content - Raw CSV content string.
 * @returns Array of logical CSV lines.
 */
function splitLogicalLines(content: string): string[] {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (char === '"') {
      // Toggle quote state (escaped quotes "" are two toggles in sequence)
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Push the last line if it has content
  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a raw CSV string into an array of typed objects.
 *
 * The first row is treated as the header row. Each subsequent row is
 * converted to an object whose keys are the header values and whose
 * values are the corresponding field strings.
 *
 * @typeParam T - The expected shape of each row object. Field values are
 *   always strings; the caller is responsible for further type conversion.
 * @param csvContent - The raw CSV content as a string.
 * @param options - Optional parsing configuration.
 * @returns An array of parsed row objects typed as `T`.
 *
 * @example
 * ```ts
 * interface Row { Name: string; Score: string; }
 * const rows = parseCsv<Row>("Name,Score\nAlice,95\nBob,87");
 * // [{ Name: "Alice", Score: "95" }, { Name: "Bob", Score: "87" }]
 * ```
 */
export function parseCsv<
  T extends Record<string, string> = Record<string, string>,
>(csvContent: string, options: CsvParseOptions = {}): T[] {
  const { delimiter = ",", trimFields = true } = options;

  if (!csvContent || csvContent.trim().length === 0) {
    return [];
  }

  const logicalLines = splitLogicalLines(csvContent);

  if (logicalLines.length === 0) {
    return [];
  }

  // First line is the header
  const headers = parseFields(logicalLines[0], delimiter, trimFields);

  const results: T[] = [];

  for (let i = 1; i < logicalLines.length; i++) {
    const line = logicalLines[i];

    // Skip empty lines
    if (line.trim().length === 0) {
      continue;
    }

    const values = parseFields(line, delimiter, trimFields);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      // If the row has fewer fields than headers, fill with empty string
      row[header] = j < values.length ? values[j] : "";
    }

    results.push(row as T);
  }

  return results;
}
