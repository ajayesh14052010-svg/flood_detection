import { describe, it, expect } from "vitest";
import { hashDeviceToken, safeEqualHex, hashPassword, verifyPassword } from "@/lib/crypto";
import { signAdminSession, verifyAdminSession } from "@/lib/adminToken";

describe("device authentication (token verification)", () => {
  const pepper = "unit-test-pepper";
  it("produces a stable digest for the same token + pepper", () => {
    expect(hashDeviceToken("fgd_abc", pepper)).toBe(hashDeviceToken("fgd_abc", pepper));
  });
  it("a different pepper changes the stored hash (offline-leak resistance)", () => {
    expect(hashDeviceToken("fgd_abc", pepper)).not.toBe(hashDeviceToken("fgd_abc", "other"));
  });
  it("verification matches only the exact token", () => {
    const stored = hashDeviceToken("fgd_secret", pepper);
    expect(safeEqualHex(hashDeviceToken("fgd_secret", pepper), stored)).toBe(true);
    expect(safeEqualHex(hashDeviceToken("fgd_wrong", pepper), stored)).toBe(false);
  });
  it("safeEqualHex rejects inputs of differing length without throwing", () => {
    expect(safeEqualHex("aaaa", "aaaa")).toBe(true);
    expect(safeEqualHex("aaaa", "bbbb")).toBe(false);
    expect(safeEqualHex("aaaa", "bbb")).toBe(false);
  });
});

describe("admin access control (session tokens)", () => {
  it("round-trips a signed session and recovers the admin identity", async () => {
    const token = await signAdminSession({ id: 7, email: "admin@example.local" });
    const verified = await verifyAdminSession(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(7);
    expect(verified?.email).toBe("admin@example.local");
  });
  it("rejects a tampered token", async () => {
    const token = await signAdminSession({ id: 7, email: "a@b.c" });
    expect(await verifyAdminSession(token + "x")).toBeNull();
  });
  it("rejects a garbage token", async () => {
    expect(await verifyAdminSession("not-a-jwt")).toBeNull();
  });

  it("admin passwords verify against a scrypt hash and reject wrong ones", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(verifyPassword("x", "00:00")).toBe(false); // unknown-user timing path
  });
});
