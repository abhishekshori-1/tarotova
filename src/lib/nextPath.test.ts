import { describe, expect, it } from "vitest";
import { safeNextPath, verifyHref } from "./nextPath";

describe("safeNextPath", () => {
  it("accepts same-origin paths", () => {
    expect(safeNextPath("/reading/abc/choose")).toBe("/reading/abc/choose");
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([null, undefined, "", "https://evil.example/", "//evil.example/x", "/\\evil.example", "reading/abc"])("falls back for %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/");
    expect(safeNextPath(raw, "/home")).toBe("/home");
  });
});

describe("verifyHref", () => {
  it("encodes the destination", () => {
    expect(verifyHref("/reading/a b/result")).toBe("/verify?next=%2Freading%2Fa%20b%2Fresult");
  });
});
