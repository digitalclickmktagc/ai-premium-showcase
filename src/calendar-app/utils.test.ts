import { describe, expect, it } from "vitest";
import { safeExternalUrl, shareToken } from "./utils";

describe("safeExternalUrl — hardening of the client-facing link", () => {
  it("rejects script-bearing schemes", () => {
    // These would run in the client's browser if rendered as an href.
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("  JaVaScRiPt:alert(1)  ")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
  });

  it("accepts ordinary web and mail links", () => {
    expect(safeExternalUrl("https://drive.google.com/file/x")).toBe(
      "https://drive.google.com/file/x",
    );
    expect(safeExternalUrl("http://exemplo.com.br")).toBe("http://exemplo.com.br/");
    expect(safeExternalUrl("mailto:contato@agencia.com")).toBe(
      "mailto:contato@agencia.com",
    );
  });

  it("assumes https for a bare host instead of rejecting it", () => {
    expect(safeExternalUrl("drive.google.com/file/x")).toBe(
      "https://drive.google.com/file/x",
    );
  });

  it("treats empty input as no link", () => {
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("shareToken — the only credential guarding a client calendar", () => {
  it("is long, URL-safe and unique across many draws", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const t = shareToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe, no padding
      expect(t.length).toBeGreaterThanOrEqual(22); // 18 bytes ≈ 144 bits
      tokens.add(t);
    }
    expect(tokens.size).toBe(500); // no collisions
  });
});
