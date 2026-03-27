// MODIFIED BY AI: 2026-02-12 - localize Home page text to Russian with clearer action hints
// FILE: client/src/pages/Home.tsx

import { ChevronDown, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chat2505Card } from "@/components/Chat2505Card";
import { TravelStatsPanel } from "@/components/TravelStatsPanel";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import {
  forgetRememberedPasswordForDevice,
  getRememberedPasswordForDevice,
} from "@/lib/rememberedPassword";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const API_BASE = String(import.meta.env.VITE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

const glassCardClass =
  "rounded-3xl border border-white/12 bg-[#0f1016]/82 backdrop-blur-xl shadow-[0_12px_40px_rgba(2,10,22,0.45)]";

const cardTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };
const HOME_HEADER_OPEN_KEY = "ios_home_header_open";
const HOME_MANUAL_OPEN_KEY = "ios_home_manual_open";

// MODIFIED BY AI: 2026-02-12 - reduce Onay retry delay and add timeout to avoid long waits
// FILE: client/src/pages/Home.tsx
async function fetchWithRetry(
  path: string,
  init: RequestInit,
  attempts = 2,
  delayMs = 800,
  timeoutMs = 12000,
) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(apiUrl(path), { ...init, signal: controller.signal });
      if (resp.status >= 500 && i < attempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      return resp;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutHandle);
    }
  }
  throw lastError ?? new Error("Failed to fetch");
}

export default function Home() {
  const { user, logout } = useAuth();
  const { settings, updateSettings, setAutoScanEnabled, clearHistory } = useChat();
  const [route, setRoute] = useState(settings.route || "244");
  const [number, setNumber] = useState(settings.number || "521AV05");
  const [price, setPrice] = useState(() => {
    const rawPrice = settings.price || "120";
    const normalizedDigits = rawPrice.replace(/\D+/g, "");
    return `${normalizedDigits || "120"}\u20b8`;
  });
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [terminal, setTerminal] = useState("");
  const [loadingOnay, setLoadingOnay] = useState(false);
  const [lastOnay, setLastOnay] = useState<{
    route?: string | null;
    plate?: string | null;
    cost?: number | null;
    terminal?: string | null;
  } | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHomeHeaderOpen, setIsHomeHeaderOpen] = useState(() => {
    if (typeof window === "undefined") return true;

    const saved = window.localStorage.getItem(HOME_HEADER_OPEN_KEY);
    return saved === null ? true : saved === "true";
  });
  const [isManualPanelOpen, setIsManualPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;

    const saved = window.localStorage.getItem(HOME_MANUAL_OPEN_KEY);
    return saved === null ? true : saved === "true";
  });
  const [rememberedPasswordRefreshKey, setRememberedPasswordRefreshKey] = useState(0);
  const [showRememberedPassword, setShowRememberedPassword] = useState(false);
  const [isOnayPanelOpen, setIsOnayPanelOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [, setLocation] = useLocation();
  const autoScanEnabled = settings.autoScan === true;
  const rememberedPassword = useMemo(
    () => (user?.login ? getRememberedPasswordForDevice(user.login) : null),
    [user?.login, rememberedPasswordRefreshKey],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOME_HEADER_OPEN_KEY, String(isHomeHeaderOpen));
  }, [isHomeHeaderOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOME_MANUAL_OPEN_KEY, String(isManualPanelOpen));
  }, [isManualPanelOpen]);

  const accountPeriod = useMemo(() => {
    if (!user?.expiresAt) {
      return {
        title: "\u0411\u0435\u0441\u0441\u0440\u043e\u0447\u043d\u044b\u0439",
        subtitle: "\u0411\u0435\u0437 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f \u043f\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438",
        toneClass: "text-emerald-300",
      };
    }

    const expiresAt = new Date(user.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return {
        title: "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e",
        subtitle: "\u0414\u0430\u0442\u0430 \u043f\u0435\u0440\u0438\u043e\u0434\u0430 \u043d\u0435 \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d\u0430",
        toneClass: "text-amber-300",
      };
    }

    const fullDate = expiresAt.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (expiresAt.getTime() <= Date.now()) {
      return {
        title: "\u0421\u0440\u043e\u043a \u0438\u0441\u0442\u0451\u043a",
        subtitle: fullDate,
        toneClass: "text-red-300",
      };
    }

    return {
      title: "\u0410\u043a\u0442\u0438\u0432\u0435\u043d \u0434\u043e",
      subtitle: fullDate,
      toneClass: "text-sky-300",
    };
  }, [user?.expiresAt]);

  const formatCost = (cost?: number | null) => {
    if (typeof cost === "number") {
      const kzt = (cost / 100).toFixed(0);
      return `${kzt}\u20b8`;
    }
    return price || "120\u20b8";
  };

  const canOpenManualChat = useMemo(
    () => route.trim().length > 0 && number.trim().length > 0,
    [route, number],
  );

  const goManualChat = () => {
    if (!canOpenManualChat) return;
    updateSettings(route.trim(), number.trim().toUpperCase(), price);
    setLocation("/chat?mode=manual");
  };

  const goApiChat = () => {
    setLocation("/chat?mode=api");
  };

  // MODIFIED BY AI: 2026-03-19 - keep local travel statistics in sync when saved ride history is cleared
  // FILE: client/src/pages/Home.tsx
  const handleClearHistory = () => {
    clearHistory();
    setStatsRefreshKey((value) => value + 1);
  };

  const handleOnayFetch = async () => {
    if (!terminal.trim()) {
      toast.error("Введите код терминала");
      return;
    }

    setLoadingOnay(true);
    try {
      const response = await fetchWithRetry(
        "/api/onay/qr-start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terminal: terminal.trim() }),
        },
        2,
        800,
        12000,
      );

      const body = await response.json();

      if (!response.ok || !body.success) {
        const message = body?.message || `Onay request failed (${response.status})`;
        throw new Error(message);
      }

      const data = body.data || {};
      const nextRoute = data.route || route;
      const nextPlate = (data.plate || number || "").toString().toUpperCase();
      const nextPrice = formatCost(data.cost);

      setRoute(nextRoute);
      setNumber(nextPlate);
      setPrice(nextPrice);
      setLastOnay({
        route: data.route,
        plate: data.plate,
        cost: data.cost,
        terminal: data.terminal,
      });

      updateSettings(nextRoute, nextPlate, nextPrice);

      toast.success("Данные обновлены", {
        description: `${nextRoute}, ${nextPlate} - ${nextPrice}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось получить данные терминала";
      toast.error("Запрос Onay не удался", { description: message });
    } finally {
      setLoadingOnay(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLocation("/login");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const handleForgetRememberedPassword = () => {
    if (!user?.login) return;

    forgetRememberedPasswordForDevice(user.login);
    setRememberedPasswordRefreshKey((value) => value + 1);
    setShowRememberedPassword(false);
    toast.success("Пароль удалён с этого устройства");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04050a] text-white safe-area-top safe-area-bottom">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-[-10%] h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-20 bottom-[-15%] h-80 w-80 rounded-full bg-blue-600/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <motion.section
          className={`${glassCardClass} p-4`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">{"Сообщения"}</h1>
                <p className="text-sm text-gray-400">
                  {"Добро пожаловать, "}
                  <span className="font-semibold text-white">
                    {user?.login || "пользователь"}
                  </span>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsHomeHeaderOpen((prev) => !prev)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10"
              >
                <span>{isHomeHeaderOpen ? "Свернуть" : "Развернуть"}</span>
                <motion.span
                  animate={{ rotate: isHomeHeaderOpen ? 180 : 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  <ChevronDown size={14} />
                </motion.span>
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isHomeHeaderOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-white/10 bg-[#151925]/70 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">{"Имя"}</div>
                        <div className="mt-1 truncate text-[15px] font-semibold text-white">
                          {user?.login || "Пользователь"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#151925]/70 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{"Период"}</div>
                        <div className={`mt-1 text-[14px] font-semibold ${accountPeriod.toneClass}`}>
                          {accountPeriod.title}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-[1.35] text-gray-400">
                          {accountPeriod.subtitle}
                        </div>
                      </div>

                      {user?.role === "admin" ? (
                        <button
                          type="button"
                          onClick={() => setLocation("/admin")}
                          className="col-span-2 flex items-center justify-between rounded-2xl border border-[#0A84FF]/20 bg-[linear-gradient(135deg,rgba(16,22,36,0.88),rgba(9,16,28,0.82))] px-4 py-3 text-left transition-all duration-200 hover:border-[#0A84FF]/35 hover:bg-[linear-gradient(135deg,rgba(18,26,42,0.92),rgba(10,18,32,0.88))] active:scale-[0.99]"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-[0.22em] text-[#7fb8ff]">{"Доступ"}</div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                                admin
                              </span>
                              <span className="truncate text-[14px] font-semibold text-white">
                                {"Открыть админ панель"}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] leading-[1.35] text-gray-400">
                              {"Управление пользователями и Onay из одного места"}
                            </div>
                          </div>
                          <div className="ml-3 shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                            {"Войти"}
                          </div>
                        </button>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#151925]/70 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300">
                          {rememberedPassword && showRememberedPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{"Пароль на этом устройстве"}</div>
                          <div className="mt-1 text-[14px] font-semibold text-white">
                            {rememberedPassword
                              ? showRememberedPassword
                                ? rememberedPassword
                                : "••••••••"
                              : "Не сохранён"}
                          </div>
                          <div className="mt-1 text-[12px] leading-5 text-gray-400">
                            {rememberedPassword
                              ? "Пароль был сохранён локально по желанию клиента. Это менее безопасно, чем не хранить его вообще."
                              : "Если клиент сам этого хочет, включите опцию запомнить пароль на экране входа."}
                          </div>
                          {rememberedPassword ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setShowRememberedPassword((prev) => !prev)}
                                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
                              >
                                {showRememberedPassword ? "Скрыть" : "Показать"}
                              </button>
                              <button
                                type="button"
                                onClick={handleForgetRememberedPassword}
                                className="rounded-full border border-red-400/25 bg-red-500/12 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-500/18"
                              >
                                {"Удалить с устройства"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-[#12151f]/72 px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setIsGuideOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white">{"Инструкция"}</div>
                          <div className="mt-0.5 text-xs text-gray-400">
                            {isGuideOpen
                              ? "Сверните, если уже всё понятно"
                              : "Разверните, чтобы посмотреть, как пользоваться приложением"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-200">
                          <span>{isGuideOpen ? "Скрыть" : "Развернуть"}</span>
                          <motion.span
                            animate={{ rotate: isGuideOpen ? 180 : 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="flex items-center justify-center"
                          >
                            <ChevronDown size={14} />
                          </motion.span>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isGuideOpen ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
                              <div className="rounded-2xl border border-white/8 bg-[#0f1219]/70 px-3 py-3">
                                <div className="text-sm font-semibold text-white">1. {"Чат через API"}</div>
                                <div className="mt-1 text-xs leading-5 text-gray-400">
                                  {"Нажмите "}
                                  <span className="font-semibold text-white">{"«Открыть»"}</span>
                                  {", если хотите получить данные из Onay автоматически. В чате можно ввести код терминала или отсканировать QR, а приложение само подставит ответ."}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/8 bg-[#0f1219]/70 px-3 py-3">
                                <div className="text-sm font-semibold text-white">2. {"Чат с 2505"}</div>
                                <div className="mt-1 text-xs leading-5 text-gray-400">
                                  {"Этот режим работает локально на телефоне. Вы сохраняете маршруты и коды, а потом просто открываете чат 2505, вводите код транспорта и получаете готовый билет."}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/8 bg-[#0f1219]/70 px-3 py-3">
                                <div className="text-sm font-semibold text-white">3. {"Ручной режим"}</div>
                                <div className="mt-1 text-xs leading-5 text-gray-400">
                                  {"Если нужен локальный шаблон без API, заполните маршрут и госномер ниже, затем "}
                                  <span className="font-semibold text-white">{"«В чат»"}</span>
                                  {"."}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/8 bg-[#0f1219]/70 px-3 py-3">
                                <div className="text-sm font-semibold text-white">4. {"Полезные функции"}</div>
                                <div className="mt-1 text-xs leading-5 text-gray-400">
                                  {"Долгое нажатие на сообщение открывает меню действий. Кнопка "}
                                  <span className="font-semibold text-white">{"«Очистить историю»"}</span>
                                  {" удаляет сохранённые переписки и локальные данные чатов с устройства."}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.section>
        <motion.section
          className={`${glassCardClass} p-4`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...cardTransition, delay: 0.04 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold">{"Чат через API"}</div>
              <div className="text-sm text-gray-400">{"Нажмите «Открыть» для запроса в Onay"}</div>
            </div>
            <Button
              onClick={goApiChat}
              className="h-10 rounded-xl bg-ios-blue px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
            >
              {"Открыть"}
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#11141d]/80 px-3 py-2.5">
            <div className="pr-3">
              <div className="text-sm font-medium text-gray-100">{"Авто сканирование"}</div>
              <div className="text-xs text-gray-400">
                {"После QR-кода терминал подставится и отправится сразу"}
              </div>
            </div>
            <Switch
              checked={autoScanEnabled}
              onCheckedChange={setAutoScanEnabled}
              aria-label="Переключить авто сканирование"
              className="h-8 w-[56px] border border-white/15 bg-[#2b2f3b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] data-[state=checked]:bg-ios-blue data-[state=checked]:shadow-[0_0_0_1px_rgba(10,132,255,0.35)] data-[state=unchecked]:bg-[#2b2f3b]"
              thumbClassName="size-7 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] data-[state=checked]:translate-x-[calc(100%-5px)] data-[state=unchecked]:translate-x-[1px]"
            />
          </div>
        </motion.section>

        {/* MODIFIED BY AI: 2026-03-26 - add a separate Home entry for the local 2505 transport chat directly below the API card */}
        {/* FILE: client/src/pages/Home.tsx */}
        <Chat2505Card
          resetKey={statsRefreshKey}
          onOpen={() => setLocation("/chat?mode=2505")}
        />

        {/* MODIFIED BY AI: 2026-03-19 - place API entry above the local stats block as requested */}
        {/* FILE: client/src/pages/Home.tsx */}
                <TravelStatsPanel refreshKey={statsRefreshKey} />

        <motion.section
          className={`${glassCardClass} p-4`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...cardTransition, delay: 0.08 }}
        >
          {/* MODIFIED BY AI: 2026-03-27 - make manual mode collapsible and keep only one chat-open action */}
          {/* FILE: client/src/pages/Home.tsx */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">{"Ручной режим"}</div>
              <div className="text-sm text-gray-400">
                {isManualPanelOpen
                  ? "Заполните шаблон ниже и нажмите «В чат»."
                  : "Разверните блок, если нужно изменить маршрут, номер или подтянуть данные из Onay."}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setIsManualPanelOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:bg-white/10"
              >
                <span>{isManualPanelOpen ? "Скрыть" : "Развернуть"}</span>
                <motion.span
                  animate={{ rotate: isManualPanelOpen ? 180 : 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  <ChevronDown size={14} />
                </motion.span>
              </button>
              <Button
                onClick={goManualChat}
                disabled={!canOpenManualChat}
                className="h-10 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/15 active:scale-[0.98]"
              >
                {"В чат"}
              </Button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isManualPanelOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4 border-t border-white/8 pt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="ml-1 text-sm text-gray-300">{"Маршрут"}</label>
                      <Input
                        value={route}
                        onChange={(e) => setRoute(e.target.value)}
                        placeholder="244"
                        className="h-12 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:border-white/25"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="ml-1 text-sm text-gray-300">{"Гос. номер"}</label>
                      <Input
                        value={number}
                        onChange={(e) => setNumber(e.target.value.toUpperCase())}
                        placeholder="521AV05"
                        className="h-12 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:border-white/25 uppercase"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="ml-1 text-sm text-gray-300">{"Цена"}</label>
                      <div className="flex h-12 items-center rounded-2xl border border-white/10 bg-[#151925]/70 px-4 text-base text-gray-200">
                        {price}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#12151f]/75 p-3">
                    <button
                      type="button"
                      onClick={() => setIsOnayPanelOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left text-sm font-medium text-gray-200"
                    >
                      <span>{"Подтянуть данные из Onay перед входом в чат"}</span>
                      <span className="text-xs text-gray-400">
                        {isOnayPanelOpen ? "Скрыть" : "Показать"}
                      </span>
                    </button>

                    {isOnayPanelOpen ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={terminal}
                            onChange={(e) => setTerminal(e.target.value)}
                            placeholder="Код терминала"
                            className="h-11 rounded-xl border border-white/12 bg-[#171a23]/85 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:border-white/25"
                          />
                          <Button
                            type="button"
                            onClick={handleOnayFetch}
                            disabled={loadingOnay}
                            className="h-11 rounded-xl bg-ios-blue px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                          >
                            {loadingOnay ? "Загрузка..." : "Получить"}
                          </Button>
                        </div>

                        {lastOnay ? (
                          <div className="rounded-xl border border-white/8 bg-[#0f131c]/80 p-3 text-sm text-gray-300">
                            <div>{"Маршрут:"} {lastOnay.route || "-"}</div>
                            <div>{"Гос. номер:"} {lastOnay.plate || "-"}</div>
                            <div>{"Цена:"} {formatCost(lastOnay.cost)}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
            <Button
              onClick={handleClearHistory}
              className="h-11 w-full rounded-2xl border border-red-400/25 bg-red-500/15 text-sm font-semibold text-red-200 transition-all duration-200 hover:bg-red-500/20 active:scale-[0.99]"
            >
              {"Очистить историю"}
            </Button>

            {/* MODIFIED BY AI: 2026-03-19 - provide one shared logout action on Home for every authenticated user */}
            {/* FILE: client/src/pages/Home.tsx */}
            <Button
              onClick={() => setShowLogoutConfirm(true)}
              className="h-11 w-full rounded-2xl border border-white/20 bg-white/5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 active:scale-[0.99]"
            >
              {"\u0412\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430"}
            </Button>
          </div>
        </motion.section>
        <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <DialogContent className="border-white/10 bg-[#0d1017] text-white sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{"\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0432\u044b\u0445\u043e\u0434"}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {"\u0412\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0432\u044b\u0439\u0442\u0438 \u0438\u0437 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430 \u043d\u0430 \u044d\u0442\u043e\u043c \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0435?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                {"\u041e\u0442\u043c\u0435\u043d\u0430"}
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="rounded-xl border border-red-400/35 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
              >
                {isLoggingOut
                  ? "\u0412\u044b\u0445\u043e\u0434\u0438\u043c..."
                  : "\u0412\u044b\u0439\u0442\u0438"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}



