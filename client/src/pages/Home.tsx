// MODIFIED BY AI: 2026-02-12 - localize Home page text to Russian with clearer action hints
// FILE: client/src/pages/Home.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/contexts/ChatContext";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const API_BASE = String(import.meta.env.VITE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

const glassCardClass =
  "rounded-3xl border border-white/12 bg-[#0f1016]/82 backdrop-blur-xl shadow-[0_12px_40px_rgba(2,10,22,0.45)]";

const cardTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

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
  const { settings, updateSettings, clearHistory } = useChat();
  const [route, setRoute] = useState(settings.route || "244");
  const [number, setNumber] = useState(settings.number || "521AV05");
  const [price, setPrice] = useState(settings.price || "120₸");
  const [terminal, setTerminal] = useState("");
  const [loadingOnay, setLoadingOnay] = useState(false);
  const [lastOnay, setLastOnay] = useState<{
    route?: string | null;
    plate?: string | null;
    cost?: number | null;
    terminal?: string | null;
  } | null>(null);
  const [isOnayPanelOpen, setIsOnayPanelOpen] = useState(false);
  const [, setLocation] = useLocation();

  const formatCost = (cost?: number | null) => {
    if (typeof cost === "number") {
      const kzt = (cost / 100).toFixed(0);
      return `${kzt}₸`;
    }
    return price || "120₸";
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
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Сообщения</h1>
            <p className="text-sm text-gray-400">Выберите режим: через API или вручную.</p>
            <p className="text-xs text-gray-500">
              Для API нажмите «Открыть», для ручного режима нажмите «В чат».
            </p>
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
              <div className="text-base font-semibold">Чат через API</div>
              <div className="text-sm text-gray-400">Нажмите «Открыть» для запроса в Onay</div>
            </div>
            <Button
              onClick={goApiChat}
              className="h-10 rounded-xl bg-ios-blue px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
            >
              Открыть
            </Button>
          </div>
        </motion.section>

        <motion.section
          className={`${glassCardClass} space-y-4 p-4`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...cardTransition, delay: 0.08 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Ручной режим</div>
              <div className="text-sm text-gray-400">Нажмите «В чат» для локальной генерации</div>
            </div>
            <Button
              onClick={goManualChat}
              disabled={!canOpenManualChat}
              className="h-10 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/15 active:scale-[0.98]"
            >
              В чат
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="ml-1 text-sm text-gray-300">Маршрут</label>
              <Input
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="244"
                className="h-12 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:border-white/25"
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm text-gray-300">Гос. номер</label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value.toUpperCase())}
                placeholder="521AV05"
                className="h-12 rounded-2xl border border-white/12 bg-[#191c24]/80 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:border-white/25 uppercase"
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm text-gray-300">Цена</label>
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
              <span>Подтянуть данные из Onay перед входом в чат</span>
              <span className="text-xs text-gray-400">{isOnayPanelOpen ? "Скрыть" : "Показать"}</span>
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
                    <div>Маршрут: {lastOnay.route || "-"}</div>
                    <div>Гос. номер: {lastOnay.plate || "-"}</div>
                    <div>Цена: {formatCost(lastOnay.cost)}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Button
              onClick={goManualChat}
              disabled={!canOpenManualChat}
              className="h-12 w-full rounded-2xl bg-ios-blue text-base font-semibold transition-all duration-200 active:scale-[0.99]"
            >
              Открыть ручной чат
            </Button>

            <Button
              onClick={clearHistory}
              className="h-11 w-full rounded-2xl border border-red-400/25 bg-red-500/15 text-sm font-semibold text-red-200 transition-all duration-200 hover:bg-red-500/20 active:scale-[0.99]"
            >
              Очистить историю
            </Button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
