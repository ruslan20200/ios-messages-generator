// MODIFIED BY AI: 2026-03-26 - count 2505 rides by real route and plate while keeping api/manual stats intact
// FILE: client/src/lib/travelStats.ts

import { normalizeChat2505Plate } from "@/lib/chat2505";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameHour,
  isSameMonth,
  isValid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { enUS, ru } from "date-fns/locale";

export type TravelPeriod = "day" | "week" | "month" | "year";

type StoredMessage = {
  id: string;
  text?: string;
  isMe: boolean;
  timestamp: string | Date;
  details?: {
    kind?: "api" | "2505";
    route?: string;
    number?: string;
    price?: string;
    transportCode?: string;
    transportPlate?: string;
  };
};

export type TravelRide = {
  id: string;
  amount: number;
  route: string;
  plate: string;
  timestamp: Date;
};

export type TravelTimelinePoint = {
  label: string;
  total: number;
  rides: number;
};

export type TravelGroupedStat = {
  key: string;
  total: number;
  rides: number;
  share: number;
};

export type TravelStats = {
  period: TravelPeriod;
  anchorDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
  allRides: TravelRide[];
  filteredRides: TravelRide[];
  totalSpent: number;
  totalSpentAllTime: number;
  rideCount: number;
  averageFare: number;
  routesCount: number;
  timeline: TravelTimelinePoint[];
  routeStats: TravelGroupedStat[];
  plateStats: TravelGroupedStat[];
  topRoute: TravelGroupedStat | null;
  topPlate: TravelGroupedStat | null;
};

const STORAGE_KEY_MESSAGES = "ios_msg_history";
const SESSION_STORAGE_KEY_MESSAGES = "ios_msg_history_session";
const STORAGE_KEY_MESSAGES_API = "ios_msg_history_api";
const SESSION_STORAGE_KEY_MESSAGES_API = "ios_msg_history_api_session";
const STORAGE_KEY_MESSAGES_2505 = "ios_msg_history_2505";
const SESSION_STORAGE_KEY_MESSAGES_2505 = "ios_msg_history_2505_session";
export const TRAVEL_STATS_MIN_DATE = new Date(2025, 0, 1);

const pricePattern = /(\d[\d\s]*)\s*(?:₸|в‚ё)/;

const readStoredMessages = (sessionKey: string, localKey: string): StoredMessage[] => {
  if (typeof window === "undefined") return [];

  const saved = sessionStorage.getItem(sessionKey) || localStorage.getItem(localKey);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseAmount = (price: string | undefined) => {
  if (!price) return 0;

  const matched = price.match(pricePattern);
  if (matched?.[1]) {
    return Number(matched[1].replace(/[^\d]/g, "")) || 0;
  }

  return Number(price.replace(/[^\d]/g, "")) || 0;
};

const toRide = (message: StoredMessage): TravelRide | null => {
  if (message.isMe || !message.details) return null;

  const is2505Ride = message.details.kind === "2505";
  const amount = is2505Ride ? 120 : parseAmount(message.details.price);
  if (!amount) return null;

  const timestamp = new Date(message.timestamp);
  if (Number.isNaN(timestamp.getTime())) return null;

  const route =
    (
      message.details.route ||
      (is2505Ride ? message.details.transportCode : undefined) ||
      "—"
    )
      .trim() || "—";

  const plate =
    (is2505Ride
      ? normalizeChat2505Plate(
          message.details.number || message.details.transportPlate || "—",
        )
      : (
          message.details.number ||
          message.details.transportPlate ||
          "—"
        )
          .trim()
          .toUpperCase()) || "—";

  return {
    id: message.id,
    amount,
    route,
    plate,
    timestamp,
  };
};

export const readTravelRides = (): TravelRide[] => {
  const manualMessages = readStoredMessages(SESSION_STORAGE_KEY_MESSAGES, STORAGE_KEY_MESSAGES);
  const apiMessages = readStoredMessages(SESSION_STORAGE_KEY_MESSAGES_API, STORAGE_KEY_MESSAGES_API);
  const chat2505Messages = readStoredMessages(
    SESSION_STORAGE_KEY_MESSAGES_2505,
    STORAGE_KEY_MESSAGES_2505,
  );

  return [...manualMessages, ...apiMessages, ...chat2505Messages]
    .map((message) => toRide(message))
    .filter((ride): ride is TravelRide => Boolean(ride))
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};

const clampAnchorDate = (value: Date) => {
  const today = new Date();
  const minDate = startOfDay(TRAVEL_STATS_MIN_DATE);
  const maxDate = endOfDay(today);

  if (!isValid(value)) {
    return today;
  }

  if (value < minDate) {
    return minDate;
  }

  if (value > maxDate) {
    return today;
  }

  return value;
};

const clampRange = (range: { start: Date; end: Date }) => {
  const minDate = startOfDay(TRAVEL_STATS_MIN_DATE);
  const maxDate = endOfDay(new Date());

  return {
    start: range.start < minDate ? minDate : range.start,
    end: range.end > maxDate ? maxDate : range.end,
  };
};

const getPeriodRange = (period: TravelPeriod, anchorDate: Date) => {
  let range: { start: Date; end: Date };

  switch (period) {
    case "day":
      range = { start: startOfDay(anchorDate), end: endOfDay(anchorDate) };
      break;
    case "week":
      range = {
        start: startOfWeek(anchorDate, { weekStartsOn: 1 }),
        end: endOfWeek(anchorDate, { weekStartsOn: 1 }),
      };
      break;
    case "month":
      range = { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
      break;
    case "year":
      range = { start: startOfYear(anchorDate), end: endOfYear(anchorDate) };
      break;
  }

  return clampRange(range);
};

const createTimeline = (
  rides: TravelRide[],
  period: TravelPeriod,
  anchorDate: Date,
): TravelTimelinePoint[] => {
  if (period === "day") {
    const dayStart = startOfDay(anchorDate);
    return Array.from({ length: 24 }, (_, hourIndex) => {
      const bucketDate = new Date(dayStart);
      bucketDate.setHours(hourIndex, 0, 0, 0);
      const bucketRides = rides.filter((ride) => isSameHour(ride.timestamp, bucketDate));

      return {
        label: format(bucketDate, "HH:mm"),
        total: bucketRides.reduce((sum, ride) => sum + ride.amount, 0),
        rides: bucketRides.length,
      };
    });
  }

  if (period === "week") {
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const bucketDate = addDays(weekStart, dayIndex);
      const bucketRides = rides.filter((ride) => isSameDay(ride.timestamp, bucketDate));

      return {
        label: format(bucketDate, "EEE", { locale: enUS }).toUpperCase(),
        total: bucketRides.reduce((sum, ride) => sum + ride.amount, 0),
        rides: bucketRides.length,
      };
    });
  }

  if (period === "month") {
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);
    const daysInMonth = monthEnd.getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const bucketDate = addDays(monthStart, index);
      const bucketRides = rides.filter((ride) => isSameDay(ride.timestamp, bucketDate));

      return {
        label: format(bucketDate, "d"),
        total: bucketRides.reduce((sum, ride) => sum + ride.amount, 0),
        rides: bucketRides.length,
      };
    });
  }

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const bucketDate = new Date(anchorDate.getFullYear(), monthIndex, 1);
    const bucketRides = rides.filter((ride) => isSameMonth(ride.timestamp, bucketDate));

    return {
      label: format(bucketDate, "LLL", { locale: ru }),
      total: bucketRides.reduce((sum, ride) => sum + ride.amount, 0),
      rides: bucketRides.length,
    };
  });
};

const createGroupedStats = (
  rides: TravelRide[],
  pickKey: (ride: TravelRide) => string,
): TravelGroupedStat[] => {
  const totalSpent = rides.reduce((sum, ride) => sum + ride.amount, 0);
  const grouped = new Map<string, { total: number; rides: number }>();

  rides.forEach((ride) => {
    const key = pickKey(ride);
    const current = grouped.get(key) || { total: 0, rides: 0 };
    current.total += ride.amount;
    current.rides += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => ({
      key,
      total: value.total,
      rides: value.rides,
      share: totalSpent > 0 ? value.total / totalSpent : 0,
    }))
    .sort((left, right) => right.total - left.total);
};

export const buildTravelStats = (
  period: TravelPeriod,
  options?: { anchorDate?: Date },
): TravelStats => {
  const anchorDate = clampAnchorDate(options?.anchorDate ?? new Date());
  const allRides = readTravelRides();
  const { start, end } = getPeriodRange(period, anchorDate);
  const filteredRides = allRides.filter((ride) => ride.timestamp >= start && ride.timestamp <= end);

  const totalSpent = filteredRides.reduce((sum, ride) => sum + ride.amount, 0);
  const totalSpentAllTime = allRides.reduce((sum, ride) => sum + ride.amount, 0);
  const rideCount = filteredRides.length;
  const routeStats = createGroupedStats(filteredRides, (ride) => ride.route);
  const plateStats = createGroupedStats(filteredRides, (ride) => ride.plate);

  return {
    period,
    anchorDate,
    rangeStart: start,
    rangeEnd: end,
    allRides,
    filteredRides,
    totalSpent,
    totalSpentAllTime,
    rideCount,
    averageFare: rideCount > 0 ? Math.round(totalSpent / rideCount) : 0,
    routesCount: routeStats.length,
    timeline: createTimeline(filteredRides, period, anchorDate),
    routeStats,
    plateStats,
    topRoute: routeStats[0] || null,
    topPlate: plateStats[0] || null,
  };
};
