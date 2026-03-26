// MODIFIED BY AI: 2026-03-26 - switch 2505 settings from a flat transport list to route groups with nested transports
// FILE: client/src/components/Chat2505Card.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countChat2505Transports,
  formatChat2505Transport,
  formatChat2505TransportDraft,
  getChat2505Routes,
  isValidChat2505Phone,
  isValidChat2505RouteName,
  maskChat2505Phone,
  normalizeChat2505Phone,
  normalizeChat2505RouteName,
  parseChat2505TransportInput,
  readChat2505Settings,
  saveChat2505Settings,
  type Chat2505Route,
  type Chat2505Transport,
} from "@/lib/chat2505";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, FolderPlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const glassCardClass =
  "rounded-3xl border border-white/12 bg-[#0f1016]/82 backdrop-blur-xl shadow-[0_12px_40px_rgba(2,10,22,0.45)]";

const cardTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

type Chat2505CardProps = {
  resetKey: number;
  onOpen: () => void;
};

export function Chat2505Card({ resetKey, onOpen }: Chat2505CardProps) {
  const [settings, setSettings] = useState(readChat2505Settings);
  const [isExpanded, setIsExpanded] = useState(false);
  const [routeInput, setRouteInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [routeTransportDrafts, setRouteTransportDrafts] = useState<Record<string, string>>({});
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    saveChat2505Settings(settings);
  }, [settings]);

  useEffect(() => {
    const restored = readChat2505Settings();
    setSettings(restored);
    setRouteInput("");
    setSearchValue("");
    setRouteTransportDrafts({});
    setExpandedRoutes(Object.fromEntries(restored.routes.map((route) => [route.id, false])));
    setIsExpanded(false);
  }, [resetKey]);

  useEffect(() => {
    if (Object.keys(expandedRoutes).length > 0) return;

    setExpandedRoutes(Object.fromEntries(settings.routes.map((route) => [route.id, false])));
  }, [expandedRoutes, settings.routes]);

  const routeCount = settings.routes.length;
  const totalTransports = countChat2505Transports(settings);
  const canOpenChat = isValidChat2505Phone(settings.phone) && totalTransports > 0;

  const filteredRoutes = useMemo(() => {
    const query = searchValue.trim().toUpperCase();
    if (!query) return getChat2505Routes(settings);

    return settings.routes
      .map((route) => {
        const routeMatches = route.name.includes(query);
        const transports = route.transports.filter(
          (transport) =>
            transport.code.includes(query) || transport.plate.toUpperCase().includes(query),
        );

        if (!routeMatches && transports.length === 0) {
          return null;
        }

        return routeMatches ? route : { ...route, transports };
      })
      .filter((route): route is Chat2505Route => Boolean(route));
  }, [searchValue, settings]);

  const toggleRoute = (routeId: string) => {
    setExpandedRoutes((prev) => ({
      ...prev,
      [routeId]: !prev[routeId],
    }));
  };

  const handleAddRoute = () => {
    const normalizedRoute = normalizeChat2505RouteName(routeInput);

    if (!isValidChat2505RouteName(normalizedRoute)) {
      toast.error("Неверный формат маршрута", {
        description: "Используйте короткий номер маршрута, например 5 или 12A.",
      });
      return;
    }

    if (settings.routes.some((route) => route.name === normalizedRoute)) {
      toast.error("Такой маршрут уже есть", {
        description: `Маршрут ${normalizedRoute} уже добавлен в список.`,
      });
      return;
    }

    const nextRoute: Chat2505Route = {
      id: crypto.randomUUID(),
      name: normalizedRoute,
      transports: [],
    };

    setSettings((prev) => ({
      ...prev,
      routes: [...prev.routes, nextRoute],
    }));
    setExpandedRoutes((prev) => ({
      ...prev,
      [nextRoute.id]: true,
    }));
    setRouteInput("");
    toast.success(`Маршрут ${normalizedRoute} создан`);
  };

  const handleAddTransport = (routeId: string) => {
    const route = settings.routes.find((entry) => entry.id === routeId);
    if (!route) return;

    const parsed = parseChat2505TransportInput(routeTransportDrafts[routeId] || "");

    if (!parsed) {
      toast.error("Неверный формат транспорта", {
        description: "Используйте формат 26010(628ВН05).",
      });
      return;
    }

    if (
      settings.routes.some((entry) =>
        entry.transports.some((transport) => transport.code === parsed.code),
      )
    ) {
      toast.error("Такой код уже сохранён", {
        description: `Код ${parsed.code} уже есть в одном из маршрутов.`,
      });
      return;
    }

    const nextTransport: Chat2505Transport = {
      id: crypto.randomUUID(),
      code: parsed.code,
      plate: parsed.plate,
    };

    setSettings((prev) => ({
      ...prev,
      routes: prev.routes.map((entry) =>
        entry.id === routeId
          ? { ...entry, transports: [...entry.transports, nextTransport] }
          : entry,
      ),
    }));
    setRouteTransportDrafts((prev) => ({
      ...prev,
      [routeId]: "",
    }));
    setExpandedRoutes((prev) => ({
      ...prev,
      [routeId]: true,
    }));
    toast.success(`Транспорт добавлен в маршрут ${route.name}`);
  };

  const handleDeleteTransport = (routeId: string, transportId: string) => {
    setSettings((prev) => ({
      ...prev,
      routes: prev.routes.map((route) =>
        route.id === routeId
          ? {
              ...route,
              transports: route.transports.filter((transport) => transport.id !== transportId),
            }
          : route,
      ),
    }));
  };

  return (
    <motion.section
      className={`${glassCardClass} p-4`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...cardTransition, delay: 0.06 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1 pr-1">
          <div className="text-base font-semibold text-white sm:text-[17px]">Чат с 2505</div>
          <div className="max-w-[34rem] text-sm leading-[1.35] text-gray-400">
            Локальный билет по сохранённым маршрутам и кодам транспорта.
          </div>
        </div>

        <Button
          onClick={onOpen}
          disabled={!canOpenChat}
          className="h-10 shrink-0 rounded-xl bg-ios-blue px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-ios-blue/90 disabled:bg-ios-blue/35 disabled:text-white/70"
        >
          Открыть
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-[#151925]/70 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Телефон</div>
          <div className="mt-1 truncate text-[clamp(13px,3.65vw,16px)] font-semibold tracking-[-0.02em] text-white">
            {maskChat2505Phone(settings.phone)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#151925]/70 px-4 py-3">
          <div className="pl-[1px] text-[10px] uppercase tracking-[0.2em] text-gray-500">
            Маршрутов
          </div>
          <div className="mt-1 text-base font-semibold text-white">{routeCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#151925]/70 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">Кодов</div>
          <div className="mt-1 text-base font-semibold text-white">{totalTransports}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#11141d]/80 px-4 py-3 text-left text-sm font-medium text-gray-100 transition-colors hover:bg-[#161a24]"
      >
        <span>{isExpanded ? "Свернуть настройки" : "Развернуть настройки"}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="chat-2505-settings"
            initial={{ opacity: 0, height: 0, y: 8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="ml-1 text-sm text-gray-300">Номер телефона</label>
                <Input
                  value={settings.phone}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      phone: normalizeChat2505Phone(event.target.value),
                    }))
                  }
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="7770001111"
                  className="h-12 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:border-white/25 focus-visible:ring-0"
                />
                <div className="text-xs text-gray-500">
                  Формат: 10 цифр, например 7770001111.
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm text-gray-300">Создать маршрут</label>
                <div className="flex gap-2">
                  <Input
                    value={routeInput}
                    onChange={(event) => setRouteInput(event.target.value.toUpperCase())}
                    placeholder="5"
                    className="h-12 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:border-white/25 focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    onClick={handleAddRoute}
                    className="h-12 rounded-2xl bg-ios-blue px-4 text-sm font-semibold"
                  >
                    <FolderPlus className="mr-1 h-4 w-4" />
                    Создать
                  </Button>
                </div>
                <div className="text-xs text-gray-500">
                  Сначала создайте маршрут, потом добавляйте коды транспорта внутрь него.
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm text-gray-300">Поиск по маршрутам и кодам</label>
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Поиск по маршруту, коду или номеру"
                  className="h-12 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:border-white/25 focus-visible:ring-0"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#11141d]/80 p-2">
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {filteredRoutes.length > 0 ? (
                    filteredRoutes.map((route) => {
                      const isRouteExpanded = expandedRoutes[route.id] ?? false;
                      const draftValue = routeTransportDrafts[route.id] || "";

                      return (
                        <div
                          key={route.id}
                          className="rounded-2xl border border-white/8 bg-[#171b24]/85"
                        >
                          <button
                            type="button"
                            onClick={() => toggleRoute(route.id)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">
                                Маршрут {route.name}
                              </div>
                              <div className="text-xs text-gray-400">
                                {route.transports.length} кодов транспорта
                              </div>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-gray-300 transition-transform duration-200 ${isRouteExpanded ? "rotate-180" : ""}`}
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {isRouteExpanded ? (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden border-t border-white/8"
                              >
                                <div className="space-y-3 px-3 py-3">
                                  <div className="flex gap-2">
                                    <Input
                                      value={draftValue}
                                      onChange={(event) =>
                                        setRouteTransportDrafts((prev) => ({
                                          ...prev,
                                          [route.id]: formatChat2505TransportDraft(
                                            event.target.value,
                                          ),
                                        }))
                                      }
                                      autoCapitalize="characters"
                                      autoCorrect="off"
                                      spellCheck={false}
                                      placeholder="26010(628ВН05)"
                                      className="h-11 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:border-white/25 focus-visible:ring-0"
                                    />
                                    <Button
                                      type="button"
                                      onClick={() => handleAddTransport(route.id)}
                                      className="h-11 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
                                    >
                                      <Plus className="mr-1 h-4 w-4" />
                                      Добавить
                                    </Button>
                                  </div>

                                  {route.transports.length > 0 ? (
                                    <div className="space-y-2">
                                      {route.transports.map((transport) => (
                                        <div
                                          key={transport.id}
                                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#12161f]/90 px-3 py-3"
                                        >
                                          <div className="min-w-0">
                                            <div className="text-sm font-semibold text-white">
                                              {transport.code}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                              {formatChat2505Transport(transport)}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteTransport(route.id, transport.id)
                                            }
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-400/20 bg-red-500/10 text-red-200 transition-colors hover:bg-red-500/20"
                                            aria-label={`Удалить ${transport.code}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-sm text-gray-400">
                                      В этом маршруте пока нет кодов транспорта.
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-gray-400">
                      По вашему запросу ничего не найдено.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
