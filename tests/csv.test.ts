import { describe, it, expect } from "vitest";
import { csvEscape, toCsv } from "@/lib/csv";

describe("csv export helpers", () => {
  it("leaves plain values unquoted", () => {
    expect(csvEscape("FG-SENSOR-001")).toBe("FG-SENSOR-001");
    expect(csvEscape(42)).toBe("42");
  });

  it("quotes values with commas, quotes or newlines and doubles quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders null/undefined as empty", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("builds CRLF rows with a header and trailing newline", () => {
    const csv = toCsv(["a", "b"], [["1", "2,x"], ["3", null]]);
    expect(csv).toBe('a,b\r\n1,"2,x"\r\n3,\r\n');
  });
});
