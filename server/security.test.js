import { describe, expect, it } from "vitest";
import {
  extractBearerToken,
  isValidUserId,
  parseAllowedOrigins,
  readOwnUser,
  resolveSessionSecret,
  signAuthToken,
  verifyAuthToken,
} from "./security.js";

describe("SDC-Level-3 server security controls", () => {
  it("rejects wildcard CORS origins and defaults cleanly in production vs dev", () => {
    expect(() => parseAllowedOrigins("*", "development")).toThrow(/Wildcard/);
    expect(parseAllowedOrigins(undefined, "production")).toEqual([]);
    expect(parseAllowedOrigins(undefined, "development")).toContain("http://localhost:8080");
    expect(parseAllowedOrigins("https://chat.example.com/, https://app.example.com", "production")).toEqual([
      "https://chat.example.com",
      "https://app.example.com",
    ]);
  });

  it("enforces SESSION_SECRET in production and verifies HMAC session tokens", () => {
    expect(() => resolveSessionSecret({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
    expect(() => resolveSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "too-short" })).toThrow();

    const secret = "test-secret-key-at-least-32-characters-long-1234";
    const token = signAuthToken("alice_01", secret, 60_000);
    const claims = verifyAuthToken(token, secret);
    expect(claims?.sub).toBe("alice_01");

    expect(verifyAuthToken(`${token}tamper`, secret)).toBeNull();
    expect(verifyAuthToken(token, "wrong-secret-key-at-least-32-chars-123456")).toBeNull();
    expect(verifyAuthToken(token, secret, Date.now() + 120_000)).toBeNull();
    expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
  });

  it("blocks prototype-pollution identifiers when validating and looking up users", () => {
    expect(isValidUserId("toString")).toBe(false);
    expect(isValidUserId("__proto__")).toBe(false);
    expect(isValidUserId("constructor")).toBe(false);
    expect(isValidUserId("ab")).toBe(false);
    expect(isValidUserId("agent_zero")).toBe(true);

    const users = { agent_zero: { hash: "$2b$10$hash" } };
    expect(readOwnUser(users, "toString")).toBeNull();
    expect(readOwnUser(users, "agent_zero")).toEqual({ hash: "$2b$10$hash" });
  });
});
