// MODIFIED BY AI: 2026-02-12 - add unit tests for device binding and expiry logic
// FILE: server/accessRules.test.ts

import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EXPIRED_MESSAGE,
  DEVICE_IN_USE_MESSAGE,
  evaluateDeviceAccess,
  isExpiredAt,
} from "./accessRules";

describe("accessRules", () => {
  it("flags expired account", () => {
    const now = new Date("2026-02-12T10:00:00.000Z");
    expect(isExpiredAt("2026-02-12T09:59:59.000Z", now)).toBe(true);
  });

  it("binds device on first successful login", () => {
    const result = evaluateDeviceAccess({
      userDeviceId: null,
      requestDeviceId: "device-A",
      expiresAt: null,
      now: new Date("2026-02-12T10:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.shouldBindDevice).toBe(true);
    expect(result.status).toBe(200);
  });

  it("denies login from different device", () => {
    const result = evaluateDeviceAccess({
      userDeviceId: "device-A",
      requestDeviceId: "device-B",
      expiresAt: null,
      now: new Date("2026-02-12T10:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.message).toBe(DEVICE_IN_USE_MESSAGE);
  });

  // MODIFIED BY AI: 2026-02-12 - admin is excluded from single-device restriction
  // FILE: server/accessRules.test.ts
  it("allows admin login from different device", () => {
    const result = evaluateDeviceAccess({
      userDeviceId: "device-A",
      requestDeviceId: "device-B",
      expiresAt: null,
      role: "admin",
      now: new Date("2026-02-12T10:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.shouldBindDevice).toBe(false);
  });

  it("denies expired account before binding", () => {
    const result = evaluateDeviceAccess({
      userDeviceId: null,
      requestDeviceId: "device-A",
      expiresAt: "2026-02-11T09:00:00.000Z",
      now: new Date("2026-02-12T10:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(410);
    expect(result.message).toBe(ACCOUNT_EXPIRED_MESSAGE);
  });
});
