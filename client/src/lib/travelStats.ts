// MODIFIED BY AI: 2026-03-19 - derive local travel/payment statistics from saved chat history only
// FILE: client/src/lib/travelStats.ts

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
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

export type TravelPeriod = "day" | "week" | "month" | "year";

type StoredMessage = {
  id: string;
  isMe: boolean;
  timestamp: string | Date;
  details?: {
    route?: string;
    number?: string;
    price?: string;
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

const pricePattern = /(\d[\d\s]*)\s*₸/;

const readStoredMessages = (sessionKey: string, localKey: string): StoredMessage[] => {
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

  const amount = parseAmount(message.details.price);
  if (!amount) return null;

  const timestamp = new Date(message.timestamp);
  if (Number.isNaN(timestamp.getTime())) return null;

  return {
    id: message.id,
    amount,
    route: (message.details.route || "—").trim() || "—",
    plate: (message.details.number || "—").trim().toUpperCase() || "—",
    timestamp,
  };
};

export const readTravelRides = (): TravelRide[] => {
  const manualMessages = readStoredMessages(SESSION_STORAGE_KEY_MESSAGES, STORAGE_KEY_MESSAGES);
  const apiMessages = readStoredMessages(SESSION_STORAGE_KEY_MESSAGES_API, STORAGE_KEY_MESSAGES_API);

  return [...manualMessages, ...apiMessages]
    .map((message) => toRide(message))
    .filter((ride): ride is TravelRide => Boolean(ride))
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};

const getPeriodRange = (period: TravelPeriod, now: Date) => {
  switch (period) {
    case "day":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
  }
};

const createTimeline = (rides: TravelRide[], period: TravelPeriod, now: Date): TravelTimelinePoint[] => {
  if (period === "day") {
    const dayStart = startOfDay(now);
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
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const bucketDate = addDays(weekStart, dayIndex);
      const bucketRides = rides.filter((ride) => isSameDay(ride.timestamp, bucketDate));

      return {
        label: format(bucketDate, "EE"),
        total: bucketRides.reduce((sum, ride) => sum + ride.amount, 0),
        rides: bucketRides.length,
      };
    });
  }

  if (period === "month") {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
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
    const bucketDate = new Date(now.getFullYear(), monthIndex, 1);
    const bucketRides = rides.filter((ride) => isSameMonth(ride.timestamp, bucketDate));

    return {
      label: format(bucketDate, "LLL"),
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

export const buildTravelStats = (period: TravelPeriod): TravelStats => {
  const now = new Date();
  const allRides = readTravelRides();
  const { start, end } = getPeriodRange(period, now);
  const filteredRides = allRides.filter((ride) => ride.timestamp >= start && ride.timestamp <= end);

  const totalSpent = filteredRides.reduce((sum, ride) => sum + ride.amount, 0);
  const totalSpentAllTime = allRides.reduce((sum, ride) => sum + ride.amount, 0);
  const rideCount = filteredRides.length;
  const routeStats = createGroupedStats(filteredRides, (ride) => ride.route);
  const plateStats = createGroupedStats(filteredRides, (ride) => ride.plate);

  return {
    period,
    allRides,
    filteredRides,
    totalSpent,
    totalSpentAllTime,
    rideCount,
    averageFare: rideCount > 0 ? Math.round(totalSpent / rideCount) : 0,
    routesCount: routeStats.length,
    timeline: createTimeline(filteredRides, period, now),
    routeStats,
    plateStats,
    topRoute: routeStats[0] || null,
    topPlate: plateStats[0] || null,
  };
};
