import { nanoid } from "nanoid";
import {
  findChat2505Transport,
  generateChat2505Ticket,
  generateChat2505Transaction,
  readChat2505Settings,
} from "@/lib/chat2505";
import type { TicketData, TicketSource } from "./types";

// v2: old records stored a JSON qrPayload and are incompatible with the new card.
const HISTORY_STORAGE_KEY = "kasper-2505-ticket-history-v2";
const PHONE_STORAGE_KEY = "kasper-ticket-phone";
const DEFAULT_PHONE = "+7 (777) 777-77-77";
const DEFAULT_PHONE_MASKED = "777XXX7777";
const COMPANY = "ТОО АЛМАТЫ ОБЛЫСЫНЫҢ ЖОЛАУШЫЛАРДЫ ТАСЫМА";
const BIN = "220440025242";

// Single phone used on every ticket (9909 and 2505), set on the Home screen.
export function readKasperPhone(): string {
  try {
    return localStorage.getItem(PHONE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveKasperPhone(digits: string) {
  try {
    localStorage.setItem(PHONE_STORAGE_KEY, digits.replace(/\D/g, "").slice(0, 10));
  } catch {
    // ignore storage errors
  }
}

// Same QR code shape as the API chat (5 chars A-Z0-9, e.g. "QWAE5").
const SUFFIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const generateSuffix = () =>
  Array.from(
    { length: 5 },
    () => SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)],
  ).join("");

const formatPhone = (raw: string) => {
  const d = nationalDigits(raw);
  if (d.length !== 10) return "";
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
};

const API_BASE = String(import.meta.env.VITE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

const pad = (value: number) => String(value).padStart(2, "0");
const formatDate = (date: Date) =>
  `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
const formatTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const formatTimeWithSeconds = (date: Date) =>
  `${formatTime(date)}:${pad(date.getSeconds())}`;

const nationalDigits = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && /^[78]/.test(d)) d = d.slice(1);
  return d.slice(0, 10);
};

const maskPhone = (raw: string) => {
  const d = nationalDigits(raw);
  if (d.length < 10) return "";
  return `${d.slice(0, 3)}XXX${d.slice(-4)}`;
};

type BuildArgs = {
  source: TicketSource;
  code: string;
  transportCode: string;
  plate: string;
  amount: string;
};

const buildTicket = (args: BuildArgs): TicketData => {
  const now = new Date();
  // 9909 tickets last 2 hours, 2505 tickets last 1 hour.
  const validHours = args.source === "9909" ? 2 : 1;
  const expiry = new Date(now.getTime() + validHours * 60 * 60 * 1000);
  const ticketNumber = generateChat2505Ticket();
  const transaction = generateChat2505Transaction();
  const savedPhone = readKasperPhone();

  return {
    id: nanoid(),
    source: args.source,
    requestedCode: args.code,
    status: "active",
    expiresAt: expiry.toISOString(),
    amount: args.amount,
    paymentDate: formatDate(now),
    paymentTime: formatTime(now),
    paymentAt: `${formatDate(now)} ${formatTimeWithSeconds(now)}`,
    phone: formatPhone(savedPhone) || DEFAULT_PHONE,
    phoneMasked: maskPhone(savedPhone) || DEFAULT_PHONE_MASKED,
    transportCode: args.transportCode,
    plate: args.plate,
    ticketNumber,
    transaction,
    transport: args.plate
      ? `${args.transportCode} (${args.plate})`
      : args.transportCode,
    company: COMPANY,
    bin: BIN,
    qrPayload: generateSuffix(),
    createdAt: now.toISOString(),
  };
};

/**
 * 9909 — real Onay backend. Same endpoint the API chat uses.
 * Needs the dev:api server (and Onay credentials) reachable via the /api proxy.
 */
export async function requestApiTicket(terminal: string): Promise<TicketData> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(apiUrl("/api/onay/qr-start"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminal }),
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "Превышено время ожидания. Проверьте соединение и повторите."
        : "Нет соединения с сервером. Проверьте интернет.",
    );
  } finally {
    window.clearTimeout(timeout);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Код отклонён (${response.status})`);
  }

  const data = body.data ?? {};
  if (!data.route && !data.plate) {
    throw new Error("Услуга временно недоступна, попробуйте позже.");
  }

  const amount =
    typeof data.cost === "number" ? `${Math.round(data.cost / 100)} ₸` : "120 ₸";

  return buildTicket({
    source: "9909",
    code: terminal,
    transportCode: data.route || `26${terminal.slice(-3).padStart(3, "0")}`,
    plate: data.plate || "",
    amount,
  });
}

/**
 * 2505 — local. Looks the transport code up in the saved 2505 routes
 * (shared storage with the main 2505 chat) and builds the ticket locally.
 */
export function createLocalTicket(code: string): TicketData {
  const settings = readChat2505Settings();
  const found = findChat2505Transport(settings, code);

  if (!found) {
    throw new Error(
      "Ошибка. Код транспорта не найден в сохранённых транспортах.",
    );
  }

  return buildTicket({
    source: "2505",
    code,
    transportCode: found.transport.code,
    plate: found.transport.plate,
    amount: "120 ₸",
  });
}

// A valid card needs a short QR code (not the legacy JSON payload).
const isValidTicket = (t: unknown): t is TicketData =>
  Boolean(t) &&
  typeof (t as TicketData).qrPayload === "string" &&
  (t as TicketData).qrPayload.length <= 16 &&
  !(t as TicketData).qrPayload.includes("{");

export function readTicketHistory(): TicketData[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidTicket) : [];
  } catch {
    return [];
  }
}

export function saveTicketHistory(tickets: TicketData[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(tickets));
}

// --- PWA state restore: last open ticket + active tab ---
const OPEN_TICKET_KEY = "kasper-open-ticket";
const ACTIVE_TAB_KEY = "kasper-active-tab";

export function readOpenTicket(): TicketData | null {
  try {
    const raw = localStorage.getItem(OPEN_TICKET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidTicket(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOpenTicket(ticket: TicketData | null) {
  try {
    if (ticket) localStorage.setItem(OPEN_TICKET_KEY, JSON.stringify(ticket));
    else localStorage.removeItem(OPEN_TICKET_KEY);
  } catch {
    // ignore storage errors
  }
}

export function readActiveTab(): TicketSource {
  try {
    return localStorage.getItem(ACTIVE_TAB_KEY) === "2505" ? "2505" : "9909";
  } catch {
    return "9909";
  }
}

export function saveActiveTab(tab: TicketSource) {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  } catch {
    // ignore storage errors
  }
}
