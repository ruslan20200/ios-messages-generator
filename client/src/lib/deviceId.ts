// MODIFIED BY AI: 2026-03-19 - harden deviceId persistence with cookie backup and best-effort persistent storage
// FILE: client/src/lib/deviceId.ts

const DEVICE_ID_STORAGE_KEY = "ios_msg_device_id";
const DEVICE_ID_COOKIE_NAME = "app_device_id";
const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const fallbackUuid = () => {
  const chunk = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${chunk()}${chunk()}-${chunk()}-${chunk()}-${chunk()}-${chunk()}${chunk()}${chunk()}`;
};

const readCookieValue = (name: string) => {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!match) return null;

  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return match.slice(prefix.length);
  }
};

const writeDeviceIdCookie = (deviceId: string) => {
  if (typeof document === "undefined") return;

  const securePart = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${DEVICE_ID_COOKIE_NAME}=${encodeURIComponent(deviceId)}; Path=/; Max-Age=${DEVICE_ID_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${securePart}`;
};

const requestPersistentStorage = () => {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return;

  void navigator.storage.persist().catch(() => {
    // No-op: storage persistence is best-effort and browser-dependent.
  });
};

const syncDeviceId = (deviceId: string) => {
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  writeDeviceIdCookie(deviceId);
  requestPersistentStorage();
  return deviceId;
};

export const getOrCreateDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    writeDeviceIdCookie(existing);
    requestPersistentStorage();
    return existing;
  }

  const cookieDeviceId = readCookieValue(DEVICE_ID_COOKIE_NAME);
  if (cookieDeviceId) {
    return syncDeviceId(cookieDeviceId);
  }

  const created =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : fallbackUuid();

  return syncDeviceId(created);
};
