export type OnayQrParseResult =
  | { ok: true; terminalId: string }
  | { ok: false; error: string };

const TERMINAL_ID_PATTERN = /^\d+$/;

export function extractOnayTerminalId(rawValue: string): OnayQrParseResult {
  const value = String(rawValue || "").trim();

  if (!value) {
    return { ok: false, error: "Пустое содержимое QR" };
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false,
      error: "Невалидный QR: ожидается ссылка формата http://c.onay.kz/{TERMINAL_ID}",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "c.onay.kz") {
    return {
      ok: false,
      error: "Невалидный QR: домен должен быть c.onay.kz",
    };
  }

  const normalizedPath = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalizedPath) {
    return { ok: false, error: "Terminal ID отсутствует" };
  }

  if (!TERMINAL_ID_PATTERN.test(normalizedPath)) {
    return {
      ok: false,
      error: "Невалидный QR: Terminal ID должен содержать только цифры",
    };
  }

  return { ok: true, terminalId: normalizedPath };
}
