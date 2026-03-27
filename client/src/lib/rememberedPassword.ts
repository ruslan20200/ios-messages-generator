// MODIFIED BY AI: 2026-03-27 — add optional per-device remembered password storage for users who explicitly opt in
// FILE: client/src/lib/rememberedPassword.ts

type RememberedPasswordRecord = {
  login: string;
  password: string;
  updatedAt: number;
};

type RememberedPasswordMap = Record<string, RememberedPasswordRecord>;

const REMEMBERED_PASSWORDS_STORAGE_KEY = "ios_msg_remembered_passwords";
const LAST_REMEMBERED_LOGIN_STORAGE_KEY = "ios_msg_remembered_password_last_login";

const normalizeLoginKey = (login: string) => login.trim().toLowerCase();

const readRememberedPasswords = (): RememberedPasswordMap => {
  try {
    const raw = localStorage.getItem(REMEMBERED_PASSWORDS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as RememberedPasswordMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
};

const writeRememberedPasswords = (nextPasswords: RememberedPasswordMap) => {
  localStorage.setItem(REMEMBERED_PASSWORDS_STORAGE_KEY, JSON.stringify(nextPasswords));
};

export const rememberPasswordForDevice = (login: string, password: string) => {
  const normalizedKey = normalizeLoginKey(login);
  if (!normalizedKey || !password) return;

  const nextPasswords = readRememberedPasswords();
  nextPasswords[normalizedKey] = {
    login: login.trim(),
    password,
    updatedAt: Date.now(),
  };

  writeRememberedPasswords(nextPasswords);
  localStorage.setItem(LAST_REMEMBERED_LOGIN_STORAGE_KEY, normalizedKey);
};

export const forgetRememberedPasswordForDevice = (login: string) => {
  const normalizedKey = normalizeLoginKey(login);
  if (!normalizedKey) return;

  const nextPasswords = readRememberedPasswords();
  delete nextPasswords[normalizedKey];
  writeRememberedPasswords(nextPasswords);

  const lastRemembered = localStorage.getItem(LAST_REMEMBERED_LOGIN_STORAGE_KEY);
  if (lastRemembered === normalizedKey) {
    localStorage.removeItem(LAST_REMEMBERED_LOGIN_STORAGE_KEY);
  }
};

export const getRememberedPasswordForDevice = (login: string): string | null => {
  const normalizedKey = normalizeLoginKey(login);
  if (!normalizedKey) return null;

  const remembered = readRememberedPasswords()[normalizedKey];
  return remembered?.password ?? null;
};

export const getLastRememberedCredentials = (): { login: string; password: string } | null => {
  const lastRemembered = localStorage.getItem(LAST_REMEMBERED_LOGIN_STORAGE_KEY);
  if (!lastRemembered) return null;

  const remembered = readRememberedPasswords()[lastRemembered];
  if (!remembered?.login || !remembered.password) {
    return null;
  }

  return {
    login: remembered.login,
    password: remembered.password,
  };
};
