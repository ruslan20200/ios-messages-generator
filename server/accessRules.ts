// MODIFIED BY AI: 2026-02-12 - add pure device binding and expiry access rules
// FILE: server/accessRules.ts

export const ACCOUNT_EXPIRED_MESSAGE = "Срок действия аккаунта истек";
export const DEVICE_IN_USE_MESSAGE =
  "Этот аккаунт уже используется на другом устройстве";

export type AccessDecision = {
  ok: boolean;
  shouldBindDevice: boolean;
  status: number;
  message?: string;
};

const parseExpiry = (expiresAt: string | Date | null | undefined): Date | null => {
  if (!expiresAt) return null;
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const isExpiredAt = (
  expiresAt: string | Date | null | undefined,
  now = new Date(),
) => {
  const parsed = parseExpiry(expiresAt);
  if (!parsed) return false;
  return parsed.getTime() <= now.getTime();
};

export const evaluateDeviceAccess = (params: {
  userDeviceId: string | null;
  requestDeviceId: string;
  expiresAt: string | Date | null;
  now?: Date;
}): AccessDecision => {
  const now = params.now ?? new Date();

  if (isExpiredAt(params.expiresAt, now)) {
    return {
      ok: false,
      shouldBindDevice: false,
      status: 410,
      message: ACCOUNT_EXPIRED_MESSAGE,
    };
  }

  if (!params.userDeviceId) {
    return {
      ok: true,
      shouldBindDevice: true,
      status: 200,
    };
  }

  if (params.userDeviceId === params.requestDeviceId) {
    return {
      ok: true,
      shouldBindDevice: false,
      status: 200,
    };
  }

  return {
    ok: false,
    shouldBindDevice: false,
    status: 403,
    message: DEVICE_IN_USE_MESSAGE,
  };
};
