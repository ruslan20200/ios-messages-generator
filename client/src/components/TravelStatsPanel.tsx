// MODIFIED BY AI: 2026-03-19 - add animated local travel statistics panel for saved payment history
// FILE: client/src/components/TravelStatsPanel.tsx

import {
  buildTravelStats,
  type TravelGroupedStat,
  type TravelPeriod,
  type TravelTimelinePoint,
} from "@/lib/travelStats";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const PERIOD_OPTIONS: Array<{ label: string; value: TravelPeriod }> = [
  { label: "День", value: "day" },
  { label: "Неделя", value: "week" },
  { label: "Месяц", value: "month" },
  { label: "Год", value: "year" },
];

const formatKzt = (amount: number) => `${new Intl.NumberFormat("ru-RU").format(amount)} ₸`;

const periodCaption: Record<TravelPeriod, string> = {
  day: "сегодня",
  week: "за 7 дней",
  month: "за месяц",
  year: "за год",
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
    x: Number((index * step).toFixed(2)),
    y: Number((usableHeight - (point.total / maxValue) * usableHeight + 9).toFixed(2)),
  }));

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x ?? width} ${height} L 0 ${height} Z`;

  return { areaPath, linePath, coordinates };
};

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
          <div className="text-xs text-white/45">{item.rides} поездок</div>
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

export function TravelStatsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [period, setPeriod] = useState<TravelPeriod>("week");
  const [revision, setRevision] = useState(0);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

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
  }, [period, refreshKey, revision]);

  const stats = useMemo(() => buildTravelStats(period), [period, refreshKey, revision]);
  const sparkline = useMemo(() => buildSparkline(stats.timeline), [stats.timeline]);
  const timelineMax = Math.max(...stats.timeline.map((point) => point.total), 0);
  const visibleRoutes = showAllRoutes ? stats.routeStats : stats.routeStats.slice(0, 4);
  const labelStart = stats.timeline[0]?.label || "—";
  const labelMiddle = stats.timeline[Math.floor(stats.timeline.length / 2)]?.label || "—";
  const labelEnd = stats.timeline[stats.timeline.length - 1]?.label || "—";

  if (stats.allRides.length === 0) {
    return (
      <motion.section
        className="rounded-3xl border border-white/12 bg-[#0f1016]/82 p-4 backdrop-blur-xl shadow-[0_12px_40px_rgba(2,10,22,0.45)]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-base font-semibold text-white">Личная статистика поездок</div>
        <div className="mt-2 text-sm text-white/55">
          Когда в истории появятся успешные поездки, здесь автоматически покажутся траты, любимые
          маршруты и динамика по периодам.
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
          <div className="text-[12px] uppercase tracking-[0.28em] text-cyan-200/55">Travel stats</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-white">Сколько вы потратили</div>
          <div className="mt-1 text-sm text-white/55">
            Локальная статистика по успешным поездкам из вашей истории сообщений.
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2">
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
      </div>

      {/* MODIFIED BY AI: 2026-03-19 - remove the share ring and keep the spending summary tighter on mobile */}
      {/* FILE: client/src/components/TravelStatsPanel.tsx */}
      <div className="mt-4 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(69,220,173,0.24),transparent_36%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),linear-gradient(160deg,rgba(17,23,35,0.98),rgba(11,15,24,0.96))] p-4">
        <div>
          <div className="text-sm text-white/52">{periodCaption[period]}</div>
          <div className="mt-2 text-[36px] font-black leading-none tracking-tight text-white">
            {formatKzt(stats.totalSpent)}
          </div>
          <div className="mt-2 text-sm text-white/60">
            {stats.rideCount} поездок • средний чек {formatKzt(stats.averageFare)}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[18px] border border-white/8 bg-white/6 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Всего</div>
            <div className="mt-1 text-lg font-bold text-white">{formatKzt(stats.totalSpentAllTime)}</div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/6 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Маршруты</div>
            <div className="mt-1 text-lg font-bold text-white">{stats.routesCount}</div>
          </div>
          <div className="rounded-[18px] border border-white/8 bg-white/6 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Пик</div>
            <div className="mt-1 text-lg font-bold text-white">{formatKzt(timelineMax)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard
          label="Любимый маршрут"
          value={stats.topRoute?.key || "—"}
          hint={stats.topRoute ? `${formatKzt(stats.topRoute.total)} • ${stats.topRoute.rides} поездок` : "Пока нет данных"}
          accent="linear-gradient(90deg,#71f5b1,#2ec9ff)"
        />
        <MetricCard
          label="Чаще номер"
          value={stats.topPlate?.key || "—"}
          hint={stats.topPlate ? `${formatKzt(stats.topPlate.total)} • ${stats.topPlate.rides} поездок` : "Пока нет данных"}
          accent="linear-gradient(90deg,#ffb761,#ff6bb3,#8476ff)"
        />
      </div>

      <motion.div
        className="mt-4 rounded-[28px] border border-white/10 bg-[#10151f]/86 p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.04 }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-white">Динамика трат</div>
            <div className="text-sm text-white/48">Только успешные поездки за выбранный период</div>
          </div>
          <div className="shrink-0 whitespace-nowrap rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-1 text-xs font-medium text-cyan-100/78">
            {stats.rideCount} поездок
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
            <span>{labelStart}</span>
            <span>{labelMiddle}</span>
            <span>{labelEnd}</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="mt-4 rounded-[28px] border border-white/10 bg-[#0f141d]/86 p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.08 }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-white">Где вы ездили чаще</div>
            <div className="text-sm text-white/48">Маршруты с самым большим расходом</div>
          </div>
          <div className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/6 px-4 py-1 text-xs font-medium text-white/64">
            {stats.routeStats.length} маршрутов
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
              {showAllRoutes ? "Показать меньше" : `Показать все (${stats.routeStats.length})`}
            </button>
          ) : null}

          {visibleRoutes.length > 0 ? (
            <div className={cn("space-y-3", showAllRoutes && "max-h-[280px] overflow-y-auto pr-1") }>
              {visibleRoutes.map((item, index) => (
                <RouteBar key={item.key} item={item} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-4 text-sm text-white/55">
              Пока нет успешных поездок за выбранный период.
            </div>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}
