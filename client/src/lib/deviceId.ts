// MODIFIED BY AI: 2026-02-12 - add stable one-time local device id generation for login binding
// FILE: client/src/lib/deviceId.ts

const DEVICE_ID_STORAGE_KEY = "ios_msg_device_id";

const fallbackUuid = () => {
  const chunk = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${chunk()}${chunk()}-${chunk()}-${chunk()}-${chunk()}-${chunk()}${chunk()}${chunk()}`;
};

export const getOrCreateDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const created = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : fallbackUuid();

  localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
};
