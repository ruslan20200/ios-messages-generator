import { extractOnayTerminalId } from "@/lib/qr";
import type { TicketSource } from "./types";

export type QrParseResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export type QrDetectResult =
  | { ok: true; source: TicketSource; value: string }
  | { ok: false; error: string };

// Walk an EMVCo TLV string (tag = 2 digits, length = 2 digits, then value)
// and return the value of `tag`, or null if not found / malformed.
function readEmvTag(payload: string, tag: string): string | null {
  let i = 0;
  while (i + 4 <= payload.length) {
    const t = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || len < 0) return null;
    const val = payload.slice(i + 4, i + 4 + len);
    if (val.length < len) return null;
    if (t === tag) return val;
    i += 4 + len;
  }
  return null;
}

/**
 * SMSBUS / Kaspi-QR sticker used for the "2505" flow. The transport code is the
 * EMVCo "Additional Data" bill number (tag 62 → 01), e.g. `...6217010602601902...`
 * → 026019 → 26019. Also accepts the Kaspi pay URL (?4566=CODE) and a plain code.
 */
export function extractSmsbusCode(raw: string): QrParseResult {
  const value = String(raw || "").trim();
  if (!value) return { ok: false, error: "Пустой QR-код" };

  const strip = (code: string) => code.replace(/^0+/, "") || code;

  // Kaspi pay URL: https://kaspi.kz/pay/SMSBUSQR?4566=26019
  try {
    const url = new URL(value);
    const param = url.searchParams.get("4566");
    if (param && /^\d+$/.test(param)) return { ok: true, value: strip(param) };
  } catch {
    // not a URL — fall through to EMVCo parsing
  }

  // EMVCo payload: tag 62 (additional data) → subtag 01 (bill number)
  const additional = readEmvTag(value, "62");
  if (additional) {
    const bill = readEmvTag(additional, "01");
    if (bill && /^\d+$/.test(bill)) return { ok: true, value: strip(bill) };
  }

  // Plain numeric code printed on the sticker
  if (/^\d{4,6}$/.test(value)) return { ok: true, value: strip(value) };

  return {
    ok: false,
    error: "Это не QR-код SMSBUS (2505). Отсканируйте код со стикера.",
  };
}

/**
 * Auto-detects the QR type for autoscan: Onay (c.onay.kz → 9909) or
 * SMSBUS/Kaspi-QR (→ 2505). Onay is checked first because its URL is specific.
 */
export function detectKasperQr(raw: string): QrDetectResult {
  const onay = extractOnayTerminalId(raw);
  if (onay.ok) return { ok: true, source: "9909", value: onay.terminalId };

  const sms = extractSmsbusCode(raw);
  if (sms.ok) return { ok: true, source: "2505", value: sms.value };

  return { ok: false, error: "QR не распознан. Наведите на код Onay или SMSBUS." };
}
