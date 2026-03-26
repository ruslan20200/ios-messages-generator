// MODIFIED BY AI: 2026-03-26 - group 2505 transports by route while keeping local ticket generation unchanged
// FILE: client/src/lib/chat2505.ts

import type { Message as SharedChatMessage } from "@/contexts/ChatContext";
import { format } from "date-fns";
import { nanoid } from "nanoid";

export type Chat2505Transport = {
  id: string;
  code: string;
  plate: string;
};

export type Chat2505Route = {
  id: string;
  name: string;
  transports: Chat2505Transport[];
};

export type Chat2505Settings = {
  phone: string;
  routes: Chat2505Route[];
};

export type Chat2505Message = SharedChatMessage;

export const CHAT2505_SETTINGS_STORAGE_KEY = "ios_msg_2505_settings";
export const CHAT2505_MESSAGES_STORAGE_KEY = "ios_msg_history_2505";
export const CHAT2505_MESSAGES_SESSION_STORAGE_KEY = "ios_msg_history_2505_session";
export const MAX_PERSISTED_2505_MESSAGES = 140;

const TRANSPORT_2505_INPUT_PATTERN =
  /^(\d{5})\(([0-9]{3}[A-Z\u0410-\u042f\u0401]{2}[0-9]{2})\)$/;
const TRANSPORT_2505_COMPAT_PATTERN =
  /^(\d{5})\(([0-9]{3}[A-Z\u0410-\u042f\u0401]{2})[OО0]([0-9])\)$/;
const ROUTE_2505_NAME_PATTERN = /^[0-9A-Z\u0410-\u042f\u0401-]{1,12}$/;
const DEFAULT_2505_ROUTE_NAME = "5";

const DEFAULT_2505_TRANSPORT_SEED = [
  { code: "26011", plate: "554ВН05" },
  { code: "26014", plate: "556ВН05" },
  { code: "26020", plate: "567ВН05" },
  { code: "26019", plate: "573ВН05" },
  { code: "26036", plate: "615ВН05" },
  { code: "26010", plate: "628ВН05" },
  { code: "26027", plate: "870ВН05" },
] as const;

const COMPANY_LINES = ["ТОО АЛМАТЫ ОБЛЫСЫНЫҢ", "ЖОЛАУШЫЛАРДЫ ТАСЫМА"] as const;

const REPLY_LINES = {
  ticket: "БИЛЕТ",
  amount: "СУММА",
  date: "ДАТА",
  transport: "ТРАНСПОРТ",
  phone: "ТЕЛ",
  transaction: "ТРАНЗАКЦИЯ",
} as const;

const MISSING_TRANSPORT_ERROR =
  "Ошибка. Код транспорта не найден в сохранённых транспортах.";

const toUpperCompact = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "");

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

export const normalizeChat2505Phone = (value: string) => value.replace(/\D+/g, "").slice(0, 10);

export const normalizeChat2505RouteName = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "");

export const isValidChat2505Phone = (value: string) => normalizeChat2505Phone(value).length === 10;

export const isValidChat2505RouteName = (value: string) =>
  ROUTE_2505_NAME_PATTERN.test(normalizeChat2505RouteName(value));

export const maskChat2505Phone = (value: string) => {
  const phone = normalizeChat2505Phone(value);
  if (phone.length !== 10) return "Не указан";
  return `${phone.slice(0, 3)}XXX${phone.slice(6)}`;
};

export const normalizeChat2505Plate = (value: string) => {
  const normalized = toUpperCompact(value).replace(/[^0-9A-Z\u0410-\u042f\u0401]/g, "");
  const compatMatch = normalized.match(/^(\d{3}[A-Z\u0410-\u042f\u0401]{2})[OО0]([0-9])$/);

  if (compatMatch) {
    return `${compatMatch[1]}0${compatMatch[2]}`;
  }

  return normalized;
};

export const parseChat2505TransportInput = (value: string) => {
  const normalized = toUpperCompact(value);
  const compatMatch = normalized.match(TRANSPORT_2505_COMPAT_PATTERN);
  const strictCandidate = compatMatch
    ? `${compatMatch[1]}(${compatMatch[2]}0${compatMatch[3]})`
    : normalized;
  const match = strictCandidate.match(TRANSPORT_2505_INPUT_PATTERN);

  if (!match) return null;

  return {
    code: match[1],
    plate: match[2],
  };
};

export const formatChat2505TransportDraft = (value: string) => {
  const normalized = toUpperCompact(value);
  const compatMatch = normalized.match(TRANSPORT_2505_COMPAT_PATTERN);
  const strictCandidate = compatMatch
    ? `${compatMatch[1]}(${compatMatch[2]}0${compatMatch[3]})`
    : normalized;
  const exactMatch = strictCandidate.match(TRANSPORT_2505_INPUT_PATTERN);

  if (exactMatch) {
    return `${exactMatch[1]}(${exactMatch[2]})`;
  }

  const compact = normalized.replace(/[^0-9A-Z\u0410-\u042f\u0401]/g, "");
  const code = compact.slice(0, 5).replace(/\D/g, "");

  if (code.length < 5) {
    return code;
  }

  const remainder = normalizeChat2505Plate(
    compact.slice(5).replace(/[^0-9A-Z\u0410-\u042f\u0401]/g, "").slice(0, 7),
  );

  if (!remainder) {
    return `${code}(`;
  }

  if (remainder.length < 7) {
    return `${code}(${remainder}`;
  }

  return `${code}(${remainder})`;
};

export const formatChat2505Transport = (transport: Pick<Chat2505Transport, "code" | "plate">) =>
  `${transport.code}(${transport.plate})`;

export const countChat2505Transports = (settings: Chat2505Settings) =>
  settings.routes.reduce((sum, route) => sum + route.transports.length, 0);

const createSeedTransports = (): Chat2505Transport[] =>
  DEFAULT_2505_TRANSPORT_SEED.map((transport) => ({
    id: nanoid(),
    code: transport.code,
    plate: transport.plate,
  }));

const createDefaultRoutes = (): Chat2505Route[] => [
  {
    id: nanoid(),
    name: DEFAULT_2505_ROUTE_NAME,
    transports: createSeedTransports(),
  },
];

export const createDefaultChat2505Settings = (): Chat2505Settings => ({
  phone: "",
  routes: createDefaultRoutes(),
});

const sanitizeStoredTransport = (entry: unknown): Chat2505Transport | null => {
  const record = asRecord(entry);
  if (!record) return null;

  const code = typeof record.code === "string" ? record.code.trim() : "";
  const plate = typeof record.plate === "string" ? record.plate.trim().toUpperCase() : "";
  if (!code || !plate) return null;

  const parsed = parseChat2505TransportInput(`${code}(${plate})`);
  if (!parsed) return null;

  return {
    id: typeof record.id === "string" && record.id ? record.id : nanoid(),
    code: parsed.code,
    plate: parsed.plate,
  };
};

const sanitizeStoredRoutes = (value: unknown): Chat2505Route[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;

      const name = normalizeChat2505RouteName(typeof record.name === "string" ? record.name : "");
      if (!name || !ROUTE_2505_NAME_PATTERN.test(name)) return null;

      const rawTransports = Array.isArray(record.transports) ? record.transports : [];
      const transports = rawTransports
        .map((transport) => sanitizeStoredTransport(transport))
        .filter((transport): transport is Chat2505Transport => Boolean(transport));

      return {
        id: typeof record.id === "string" && record.id ? record.id : nanoid(),
        name,
        transports,
      };
    })
    .filter((route): route is Chat2505Route => Boolean(route));
};

const migrateLegacyTransports = (value: unknown): Chat2505Route[] => {
  if (!Array.isArray(value)) return [];

  const transports = value
    .map((transport) => sanitizeStoredTransport(transport))
    .filter((transport): transport is Chat2505Transport => Boolean(transport));

  if (transports.length === 0) return [];

  return [
    {
      id: nanoid(),
      name: DEFAULT_2505_ROUTE_NAME,
      transports,
    },
  ];
};

export const getChat2505Routes = (settings: Chat2505Settings) => settings.routes;

export const getChat2505Transports = (settings: Chat2505Settings) =>
  settings.routes.flatMap((route) =>
    route.transports.map((transport) => ({
      ...transport,
      routeName: route.name,
      routeId: route.id,
    })),
  );

export const readChat2505Settings = (): Chat2505Settings => {
  if (typeof window === "undefined") {
    return createDefaultChat2505Settings();
  }

  const saved = localStorage.getItem(CHAT2505_SETTINGS_STORAGE_KEY);
  if (!saved) {
    return createDefaultChat2505Settings();
  }

  try {
    const parsed = JSON.parse(saved) as {
      phone?: unknown;
      routes?: unknown;
      transports?: unknown;
    };

    const routesFromGroups = sanitizeStoredRoutes(parsed.routes);
    const routesFromLegacy =
      routesFromGroups.length > 0 ? [] : migrateLegacyTransports(parsed.transports);

    return {
      phone: normalizeChat2505Phone(typeof parsed.phone === "string" ? parsed.phone : ""),
      routes:
        routesFromGroups.length > 0
          ? routesFromGroups
          : routesFromLegacy.length > 0
            ? routesFromLegacy
            : createDefaultRoutes(),
    };
  } catch {
    return createDefaultChat2505Settings();
  }
};

export const saveChat2505Settings = (settings: Chat2505Settings) => {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    CHAT2505_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      phone: normalizeChat2505Phone(settings.phone),
      routes: sanitizeStoredRoutes(settings.routes),
    }),
  );
};

export const clearChat2505Storage = () => {
  if (typeof window === "undefined") return;

  localStorage.removeItem(CHAT2505_SETTINGS_STORAGE_KEY);
  localStorage.removeItem(CHAT2505_MESSAGES_STORAGE_KEY);
  sessionStorage.removeItem(CHAT2505_MESSAGES_SESSION_STORAGE_KEY);
};

export const restoreChat2505Messages = (): Chat2505Message[] => {
  if (typeof window === "undefined") return [];

  const saved =
    sessionStorage.getItem(CHAT2505_MESSAGES_SESSION_STORAGE_KEY) ||
    localStorage.getItem(CHAT2505_MESSAGES_STORAGE_KEY);

  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(-MAX_PERSISTED_2505_MESSAGES).map((message: any) => ({
      ...message,
      timestamp: new Date(message.timestamp),
    }));
  } catch {
    return [];
  }
};

export const trimChat2505Messages = (messages: Chat2505Message[]) =>
  messages.length > MAX_PERSISTED_2505_MESSAGES
    ? messages.slice(-MAX_PERSISTED_2505_MESSAGES)
    : messages;

const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

export const generateChat2505Ticket = () => `0${randomDigits(3)}:15:${randomDigits(4)}`;

export const generateChat2505Transaction = () => randomDigits(10);

const buildChat2505ReplyPayload = ({
  code,
  plate,
  phone,
  now = new Date(),
}: {
  code: string;
  plate: string;
  phone: string;
  now?: Date;
}) => {
  const ticket = generateChat2505Ticket();
  const transactionId = generateChat2505Transaction();
  const maskedPhone = maskChat2505Phone(phone);
  const formattedDate = format(now, "dd.MM.yyyy HH:mm:ss");

  return {
    text: [
      `${REPLY_LINES.ticket}: ${ticket}`,
      `${REPLY_LINES.amount}: 120 ТГ.`,
      `${REPLY_LINES.date}: ${formattedDate}`,
      `${REPLY_LINES.transport}: ${code} (${plate})`,
      `${REPLY_LINES.phone}: ${maskedPhone}`,
      `${REPLY_LINES.transaction}: ${transactionId}`,
      ...COMPANY_LINES,
    ].join("\n"),
    transactionId,
  };
};

export const buildChat2505ReplyText = ({
  code,
  plate,
  phone,
  now = new Date(),
}: {
  code: string;
  plate: string;
  phone: string;
  now?: Date;
}) => buildChat2505ReplyPayload({ code, plate, phone, now }).text;

export const findChat2505Transport = (settings: Chat2505Settings, code: string) => {
  for (const route of settings.routes) {
    const transport = route.transports.find((entry) => entry.code === code);
    if (transport) {
      return { route, transport };
    }
  }

  return null;
};

export const createChat2505Conversation = ({
  code,
  settings,
  now = new Date(),
}: {
  code: string;
  settings: Chat2505Settings;
  now?: Date;
}) => {
  const userMessage: Chat2505Message = {
    id: nanoid(),
    text: code,
    isMe: true,
    timestamp: now,
  };

  const transportEntry = findChat2505Transport(settings, code);

  if (!transportEntry) {
    return {
      userMessage,
      responseMessage: {
        id: nanoid(),
        text: MISSING_TRANSPORT_ERROR,
        isMe: false,
        timestamp: now,
      } satisfies Chat2505Message,
    };
  }

  const payload = buildChat2505ReplyPayload({
    code: transportEntry.transport.code,
    plate: transportEntry.transport.plate,
    phone: settings.phone,
    now,
  });

  return {
    userMessage,
    responseMessage: {
      id: nanoid(),
      text: payload.text,
      isMe: false,
      timestamp: now,
      details: {
        kind: "2505",
        route: transportEntry.route.name,
        number: transportEntry.transport.plate,
        transportCode: transportEntry.transport.code,
        transportPlate: transportEntry.transport.plate,
        transactionId: payload.transactionId,
      },
    } satisfies Chat2505Message,
  };
};
