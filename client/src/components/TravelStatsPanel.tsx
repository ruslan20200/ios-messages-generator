// MODIFIED BY AI: 2026-03-27 - add calendar day picker and detailed day zoom for travel spend chart
// FILE: client/src/components/TravelStatsPanel.tsx

import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TRAVEL_STATS_MIN_DATE,
  buildTravelStats,
  type TravelGroupedStat,
  type TravelPeriod,
  type TravelRide,
  type TravelTimelinePoint,
} from "@/lib/travelStats";
import { cn } from "@/lib/utils";
import { endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { motion } from "framer-motion";
import { CalendarDays, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PERIOD_OPTIONS: Array<{ label: string; value: TravelPeriod }> = [
  { label: "\u0414\u0435\u043d\u044c", value: "day" },
  { label: "\u041d\u0435\u0434\u0435\u043b\u044f", value: "week" },
  { label: "\u041c\u0435\u0441\u044f\u0446", value: "month" },
  { label: "\u0413\u043e\u0434", value: "year" },
];

const formatKzt = (amount: number) =>
  `${new Intl.NumberFormat("ru-RU").format(amount)} \u20b8`;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatPaymentCount = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} \u043e\u043f\u043b\u0430\u0442\u0430`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} \u043e\u043f\u043b\u0430\u0442\u044b`;
  }

  return `${count} \u043e\u043f\u043b\u0430\u0442`;
};

const buildSparkline = (points: TravelTimelinePoint[], width = 300, height = 132) => {
  if (points.length === 0) {
    return {
      areaPath: "",
      linePath: "",
      coordinates: [] as Array<{ x: number; y: number }>,
    };
  }

  const maxValue = Math.max(...points.map((point) => point.total), 1);
  const usableHeight = height - 18;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coordinates = points.map((point, index) => ({
    x: Number(((points.length === 1 ? width / 2 : index * step)).toFixed(2)),
    y: Number((usableHeight - (point.total / maxValue) * usableHeight + 9).toFixed(2)),
  }));

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${
    coordinates[coordinates.length - 1]?.x ?? width
  } ${height} L ${coordinates[0]?.x ?? 0} ${height} Z`;

  return { areaPath, linePath, coordinates };
};

const buildDetailedDayTimeline = (rides: TravelRide[]): TravelTimelinePoint[] =>
  rides.map((ride) => ({
    label: format(ride.timestamp, "HH:mm"),
    total: ride.amount,
    rides: 1,
  }));

const formatPeriodCaption = (
  period: TravelPeriod,
  anchorDate: Date,
  rangeStart: Date,
  rangeEnd: Date,
) => {
  if (period === "day") {
    return capitalize(format(anchorDate, "d MMMM yyyy", { locale: ru }));
  }

  if (period === "week") {
    return `${format(rangeStart, "d MMM", { locale: ru })} - ${format(rangeEnd, "d MMM", {
      locale: ru,
    })}`;
  }

  if (period === "month") {
    return capitalize(format(anchorDate, "LLLL yyyy", { locale: ru }));
  }

  return `${format(anchorDate, "yyyy")} \u0433\u043e\u0434`;
};

const formatSelectedDateLabel = (date: Date) =>
  capitalize(format(date, "d MMM yyyy", { locale: ru }));

const formatRideMoment = (ride: TravelRide) => format(ride.timestamp, "HH:mm:ss");

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <motion.div
      className="rounded-[24px] border border-white/10 bg-[#10141d]/82 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="text-[11px] uppercase tracking-[0.26em] text-white/45">{label}</div>
      <div className="mt-2 text-[26px] font-bold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/58">{hint}</div>
      <div className="mt-4 h-1.5 rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: "100%", background: accent }} />
      </div>
    </motion.div>
  );
}

function RouteBar({ item, index }: { item: TravelGroupedStat; index: number }) {
  return (
    <motion.div
      className="space-y-1.5"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04 }}
    >
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">{item.key}</div>
          <div className="text-xs text-white/45">{item.rides} {"\u043f\u043e\u0435\u0437\u0434\u043e\u043a"}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="whitespace-nowrap font-semibold text-white">{formatKzt(item.total)}</div>
          <div className="text-xs text-cyan-200/70">{Math.round(item.share * 100)}%</div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,#6ef0b6_0%,#26c7ff_58%,#ffb156_100%)]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(6, Math.round(item.share * 100))}%` }}
          transition={{ duration: 0.55, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </motion.div>
  );
}

function ChartMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/38">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-white/42">{hint}</div>
    </div>
  );
}

export function TravelStatsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [period, setPeriod] = useState<TravelPeriod>("week");
  const [revision, setRevision] = useState(0);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDayZoomed, setIsDayZoomed] = useState(false);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    setShowAllRoutes(false);
    setIsDayZoomed(false);
  }, [period, refreshKey, revision, selectedDate]);

  const maxSelectableDate = useMemo(() => endOfDay(new Date()), [revision]);
  const minSelectableDate = useMemo(() => startOfDay(TRAVEL_STATS_MIN_DATE), []);

  const stats = useMemo(
    () => buildTravelStats(period, { anchorDate: selectedDate }),
    [period, refreshKey, revision, selectedDate],
  );

  const chartTimeline = useMemo(() => {
    if (period === "day" && isDayZoomed) {
      return buildDetailedDayTimeline(stats.filteredRides);
    }

    return stats.timeline;
  }, [isDayZoomed, period, stats.filteredRides, stats.timeline]);

  const sparkline = useMemo(() => buildSparkline(chartTimeline), [chartTimeline]);
  const visibleRoutes = showAllRoutes ? stats.routeStats : stats.routeStats.slice(0, 4);
  const labelStart = chartTimeline[0]?.label || "\u2014";
  const labelMiddle = chartTimeline[Math.floor(chartTimeline.length / 2)]?.label || "\u2014";
  const labelEnd = chartTimeline[chartTimeline.length - 1]?.label || "\u2014";
  const periodCaption = formatPeriodCaption(
    period,
    stats.anchorDate,
    stats.rangeStart,
    stats.rangeEnd,
  );
  const selectedDateLabel = formatSelectedDateLabel(selectedDate);
  const hasDetailedDayPoints = period === "day" && stats.filteredRides.length > 0;
  const nonZeroPoints = chartTimeline.filter((point) => point.total > 0);
  const peakPoint = nonZeroPoints.reduce<TravelTimelinePoint | null>(
    (current, point) => (!current || point.total > current.total ? point : current),
    null,
  );
  const lastActivePoint = [...nonZeroPoints].reverse()[0] || null;
  const chartSummary = [
    {
      label: "\u041f\u0438\u043a",
      value: peakPoint ? peakPoint.label : "\u2014",
      hint:
        period === "week"
          ? "\u0414\u0435\u043d\u044c \u0441 \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c\u043e\u043c"
          : "\u0412\u0440\u0435\u043c\u044f \u043f\u0438\u043a\u043e\u0432\u043e\u0439 \u043e\u043f\u043b\u0430\u0442\u044b",
    },
    {
      label: "\u041e\u043f\u043b\u0430\u0442",
      value: stats.rideCount > 0 ? formatPaymentCount(stats.rideCount) : "\u2014",
      hint: "\u0423\u0441\u043f\u0435\u0448\u043d\u043e \u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434",
    },
    {
      label: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f",
      value: lastActivePoint ? lastActivePoint.label : "\u2014",
      hint:
        period === "week"
          ? "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0434\u0435\u043d\u044c \u0441 \u043e\u043f\u043b\u0430\u0442\u043e\u0439"
          : "\u041a\u043e\u0433\u0434\u0430 \u0431\u044b\u043b\u0430 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u043e\u043f\u043b\u0430\u0442\u0430",
    },
  ];

  if (stats.allRides.length === 0) {
    return (
      <motion.section
        className="rounded-3xl border border-white/12 bg-[#0f1016]/82 p-4 backdrop-blur-xl shadow-[0_12px_40px_rgba(2,10,22,0.45)]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-base font-semibold text-white">
          {"\u041b\u0438\u0447\u043d\u0430\u044f \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u043e\u0435\u0437\u0434\u043e\u043a"}
        </div>
        <div className="mt-2 text-sm text-white/55">
          {
            "\u041a\u043e\u0433\u0434\u0430 \u0432 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0443\u0441\u043f\u0435\u0448\u043d\u044b\u0435 \u043f\u043e\u0435\u0437\u0434\u043a\u0438, \u0437\u0434\u0435\u0441\u044c \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u043f\u043e\u043a\u0430\u0436\u0443\u0442\u0441\u044f \u0442\u0440\u0430\u0442\u044b, \u043b\u044e\u0431\u0438\u043c\u044b\u0435 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u044b \u0438 \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u043f\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c."
          }
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      className="rounded-[30px] border border-white/12 bg-[#0d1018]/88 p-4 backdrop-blur-xl shadow-[0_22px_65px_rgba(0,0,0,0.42)]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.28em] text-cyan-200/55">
            Travel stats
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-white">
            {"\u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0432\u044b \u043f\u043e\u0442\u0440\u0430\u0442\u0438\u043b\u0438"}
          </div>
          <div className="mt-1 text-sm text-white/55">
            {
              "\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u0430\u044f \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u043e \u0443\u0441\u043f\u0435\u0448\u043d\u044b\u043c \u043f\u043e\u0435\u0437\u0434\u043a\u0430\u043c \u0438\u0437 \u0432\u0430\u0448\u0435\u0439 \u0438\u0441\u0442\u043e\u0440\u0438\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439."
            }
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="grid grid-cols-2 gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                  period === option.value
                    ? "bg-white text-[#090b12] shadow-[0_8px_20px_rgba(255,255,255,0.2)]"
                    : "bg-white/6 text-white/68 hover:bg-white/10",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/8 px-3 py-1.5 text-xs font-medium text-cyan-50/85 transition-colors hover:bg-cyan-300/12"
          >
            <CalendarDays className="size-3.5" />
            <span>{selectedDateLabel}</span>
          </button>
        </div>
      </div>

      {/* MODIFIED BY AI: 2026-03-19 - remove the share ring and keep the spending summary tighter on mobile */}
      {/* FILE: client/src/components/TravelStatsPanel.tsx */}
      <div className="mt-4 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(69,220,173,0.24),transparent_36%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),linear-gradient(160deg,rgba(17,23,35,0.98),rgba(11,15,24,0.96))] p-4">
        <div>
          <div className="text-sm text-white/52">{periodCaption}</div>
          <div className="mt-2 text-[36px] font-black leading-none tracking-tight text-white">
            {formatKzt(stats.totalSpent)}
          </div>
          <div className="mt-2 text-sm text-white/60">
            {formatPaymentCount(stats.rideCount)} {"\u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[18px] border border-white/8 bg-white/6 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">
              {"\u0412\u0441\u0435\u0433\u043e"}
            </div>
            <div className="mt-1 text-lg font-bold text-white">
              {formatKzt(stats.totalSpentAllTime)}
            </div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/6 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">
              {"\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044b"}
            </div>
            <div className="mt-1 text-lg font-bold text-white">{stats.routesCount}</div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/6 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">
              {"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f"}
            </div>
            <div className="mt-1 text-lg font-bold text-white">{lastActivePoint?.label || "\u2014"}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard
          label={"\u041b\u044e\u0431\u0438\u043c\u044b\u0439 \u043c\u0430\u0440\u0448\u0440\u0443\u0442"}
          value={stats.topRoute?.key || "\u2014"}
          hint={
            stats.topRoute
              ? `${formatKzt(stats.topRoute.total)} \u2022 ${stats.topRoute.rides} ${"\u043f\u043e\u0435\u0437\u0434\u043e\u043a"}`
              : "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445"
          }
          accent="linear-gradient(90deg,#71f5b1,#2ec9ff)"
        />
        <MetricCard
          label={"\u0427\u0430\u0449\u0435 \u043d\u043e\u043c\u0435\u0440"}
          value={stats.topPlate?.key || "\u2014"}
          hint={
            stats.topPlate
              ? `${formatKzt(stats.topPlate.total)} \u2022 ${stats.topPlate.rides} ${"\u043f\u043e\u0435\u0437\u0434\u043e\u043a"}`
              : "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445"
          }
          accent="linear-gradient(90deg,#ffb761,#ff6bb3,#8476ff)"
        />
      </div>

      <motion.div
        className="mt-4 rounded-[28px] border border-white/10 bg-[#10151f]/86 p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.04 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-white">
              {"\u0414\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u0442\u0440\u0430\u0442"}
            </div>
            <div className="text-sm text-white/48">
              {period === "day" && isDayZoomed
                ? "\u0422\u043e\u0447\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u043a\u0430\u0436\u0434\u043e\u0439 \u043e\u043f\u043b\u0430\u0442\u044b \u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0434\u0435\u043d\u044c"
                : "\u0421\u0443\u043c\u043c\u044b \u043f\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438 \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e \u0443\u0441\u043f\u0435\u0448\u043d\u044b\u043c \u043e\u043f\u043b\u0430\u0442\u0430\u043c"}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="whitespace-nowrap rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-1 text-xs font-medium text-cyan-100/78">
              {formatPaymentCount(stats.rideCount)}
            </div>

            {hasDetailedDayPoints ? (
              <button
                type="button"
                onClick={() => setIsDayZoomed((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-medium text-white/75 transition-colors hover:bg-white/10"
              >
                {isDayZoomed ? <ZoomOut className="size-3.5" /> : <ZoomIn className="size-3.5" />}
                <span>
                  {isDayZoomed
                    ? "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c"
                    : "\u041f\u0440\u0438\u0431\u043b\u0438\u0437\u0438\u0442\u044c"}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-3 py-3">
          <svg viewBox="0 0 300 132" className="h-[148px] w-full">
            <defs>
              <linearGradient id="travelAreaFill" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(70,233,176,0.42)" />
                <stop offset="100%" stopColor="rgba(17,26,39,0)" />
              </linearGradient>
              <linearGradient id="travelLineStroke" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#8CFFB4" />
                <stop offset="48%" stopColor="#1CD8FF" />
                <stop offset="100%" stopColor="#FFAF52" />
              </linearGradient>
            </defs>

            {Array.from({ length: 4 }).map((_, index) => {
              const y = 22 + index * 28;
              return (
                <line
                  key={index}
                  x1="0"
                  y1={y}
                  x2="300"
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="4 6"
                />
              );
            })}

            {sparkline.areaPath ? <path d={sparkline.areaPath} fill="url(#travelAreaFill)" /> : null}
            {sparkline.linePath ? (
              <path
                d={sparkline.linePath}
                fill="none"
                stroke="url(#travelLineStroke)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {sparkline.coordinates.map((point, index) => (
              <circle
                key={`${point.x}-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === sparkline.coordinates.length - 1 ? 4.5 : 3}
                fill={index === sparkline.coordinates.length - 1 ? "#ffffff" : "#9ef5c3"}
              />
            ))}
          </svg>

          <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/36">
            {period === "week" ? (
              <div className="grid w-full grid-cols-7 gap-1 text-center">
                {chartTimeline.map((point) => (
                  <span key={point.label} className="truncate">
                    {point.label}
                  </span>
                ))}
              </div>
            ) : (
              <>
                <span>{labelStart}</span>
                <span>{labelMiddle}</span>
                <span>{labelEnd}</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {chartSummary.map((item) => (
            <ChartMetric
              key={item.label}
              label={item.label}
              value={item.value}
              hint={item.hint}
            />
          ))}
        </div>

        {period === "day" && !isDayZoomed && stats.filteredRides.length > 0 ? (
          <div className="mt-3 rounded-[18px] border border-white/8 bg-white/4 px-3 py-2 text-xs text-white/58">
            {
              "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u041f\u0440\u0438\u0431\u043b\u0438\u0437\u0438\u0442\u044c\u00bb, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0442\u043e\u0447\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u043a\u0430\u0436\u0434\u043e\u0439 \u043e\u043f\u043b\u0430\u0442\u044b \u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0434\u0435\u043d\u044c."
            }
          </div>
        ) : null}

        {period === "day" && isDayZoomed && stats.filteredRides.length > 0 ? (
          <div className="mt-3 rounded-[20px] border border-white/8 bg-[#0c1119]/88 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">
                {"\u0422\u043e\u0447\u043d\u044b\u0435 \u043e\u043f\u043b\u0430\u0442\u044b"}
              </div>
              <div className="text-xs text-white/42">{selectedDateLabel}</div>
            </div>

            <div className="mt-3 max-h-[180px] space-y-2 overflow-y-auto pr-1">
              {stats.filteredRides.map((ride) => (
                <div
                  key={ride.id}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-white/6 bg-white/4 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{formatRideMoment(ride)}</div>
                    <div className="truncate text-xs text-white/48">
                      {"\u041c\u0430\u0440\u0448\u0440\u0443\u0442"} {ride.route} {"\u2022"} {ride.plate}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-cyan-100">
                    {formatKzt(ride.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </motion.div>

      <motion.div
        className="mt-4 rounded-[28px] border border-white/10 bg-[#0f141d]/86 p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.08 }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-white">
              {"\u0413\u0434\u0435 \u0432\u044b \u0435\u0437\u0434\u0438\u043b\u0438 \u0447\u0430\u0449\u0435"}
            </div>
            <div className="text-sm text-white/48">
              {"\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044b \u0441 \u0441\u0430\u043c\u044b\u043c \u0431\u043e\u043b\u044c\u0448\u0438\u043c \u0440\u0430\u0441\u0445\u043e\u0434\u043e\u043c"}
            </div>
          </div>
          <div className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/6 px-4 py-1 text-xs font-medium text-white/64">
            {stats.routeStats.length} {"\u043c\u0430\u0440\u0448\u0440\u0443\u0442\u043e\u0432"}
          </div>
        </div>

        {/* MODIFIED BY AI: 2026-03-19 - keep long route history compact with a short preview, toggle, and internal scroll */}
        {/* FILE: client/src/components/TravelStatsPanel.tsx */}
        <div className="mt-4 space-y-3">
          {stats.routeStats.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAllRoutes((value) => !value)}
              className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/72 transition-colors hover:bg-white/10"
            >
              {showAllRoutes
                ? "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043c\u0435\u043d\u044c\u0448\u0435"
                : `${"\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435"} (${stats.routeStats.length})`}
            </button>
          ) : null}

          {visibleRoutes.length > 0 ? (
            <div className={cn("space-y-3", showAllRoutes && "max-h-[280px] overflow-y-auto pr-1")}>
              {visibleRoutes.map((item, index) => (
                <RouteBar key={item.key} item={item} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-4 text-sm text-white/55">
              {
                "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0443\u0441\u043f\u0435\u0448\u043d\u044b\u0445 \u043f\u043e\u0435\u0437\u0434\u043e\u043a \u0437\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434."
              }
            </div>
          )}
        </div>
      </motion.div>

      <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <DialogContent className="max-w-[360px] rounded-[28px] border border-white/10 bg-[#0f131c] p-0 text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-white">
              {"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u043d\u044c"}
            </DialogTitle>
            <DialogDescription className="text-white/55">
              {
                "\u041c\u043e\u0436\u043d\u043e \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0434\u0430\u0442\u0443 \u0442\u043e\u043b\u044c\u043a\u043e \u0441 1 \u044f\u043d\u0432\u0430\u0440\u044f 2025 \u0433\u043e\u0434\u0430 \u043f\u043e \u0441\u0435\u0433\u043e\u0434\u043d\u044f\u0448\u043d\u0438\u0439 \u0434\u0435\u043d\u044c. \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u0432\u043e\u043a\u0440\u0443\u0433 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u0434\u0430\u0442\u044b."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 pb-3">
            <Calendar
              mode="single"
              locale={ru}
              selected={selectedDate}
              onSelect={(date) => {
                if (!date) return;
                setSelectedDate(date);
                setIsCalendarOpen(false);
              }}
              fromDate={minSelectableDate}
              toDate={maxSelectableDate}
              disabled={[{ before: minSelectableDate }, { after: maxSelectableDate }]}
              captionLayout="dropdown"
              fromYear={2025}
              toYear={maxSelectableDate.getFullYear()}
              className="mx-auto rounded-[24px] border border-white/8 bg-[#0b1018] p-3"
            />

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setSelectedDate(today);
                  setIsCalendarOpen(false);
                }}
                className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/78 transition-colors hover:bg-white/10"
              >
                {"\u0421\u0435\u0433\u043e\u0434\u043d\u044f"}
              </button>

              <div className="text-xs text-white/42">
                {isSameDay(selectedDate, new Date())
                  ? "\u0412\u044b\u0431\u0440\u0430\u043d \u0441\u0435\u0433\u043e\u0434\u043d\u044f\u0448\u043d\u0438\u0439 \u0434\u0435\u043d\u044c"
                  : selectedDateLabel}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}

