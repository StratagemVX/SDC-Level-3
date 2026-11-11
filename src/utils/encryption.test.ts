import { describe, expect, it } from "vitest";
import { decryptMessage, encryptMessage, hashSecretKey, sanitizeFileName } from "./encryption";

describe("SDC-Level-3 client encryption utilities", () => {
  it("encrypts and decrypts payloads only with the matching passphrase", () => {
    const cipher = encryptMessage("classified briefing", "Alpha-Passphrase-99!");
    expect(cipher).not.toContain("classified briefing");
    expect(decryptMessage(cipher, "Alpha-Passphrase-99!")).toBe("classified briefing");
    expect(() => decryptMessage(cipher, "wrong-passphrase")).toThrow();
  });

  it("hashes keys deterministically and strips path separators / control chars from filenames", () => {
    expect(hashSecretKey("secret")).toBe(hashSecretKey("secret"));
    expect(hashSecretKey("secret")).not.toBe(hashSecretKey("different"));
    expect(sanitizeFileName("../etc/passwd\u0007.txt")).toBe("..-etc-passwd.txt");
  });
});
