import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/contexts/ChatContext";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

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
  const [_, setLocation] = useLocation();

  const formatCost = (cost?: number | null) => {
    if (typeof cost === "number") {
      const kzt = (cost / 100).toFixed(0);
      return `${kzt}₸`;
    }
    return price || "120₸";
  };

  const goManualChat = () => {
    if (route && number) {
      updateSettings(route, number, price);
      setLocation("/chat?mode=manual");
    }
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
      const response = await fetch(apiUrl("/api/onay/qr-start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminal: terminal.trim() }),
      });

      const body = await response.json();

      if (!response.ok || !body.success) {
        const message = body?.message || `Ошибка Onay (${response.status})`;
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
        description: `${nextRoute}, ${nextPlate} • ${nextPrice}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось получить данные";
      toast.error("Onay запрос не удался", { description: message });
    } finally {
      setLoadingOnay(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 safe-area-top safe-area-bottom">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Сообщения</h1>
          <p className="text-gray-500 text-sm">Выберите способ: через API или ручной.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-[#111112] border border-[#1f1f21] rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-lg font-semibold">9909</div>
              <div className="text-sm text-gray-400">Через API — запрос в реальный сервис</div>
            </div>
            <Button onClick={goApiChat} className="h-10 px-4 text-sm font-semibold">Открыть</Button>
          </div>

          <div className="bg-[#111112] border border-[#1f1f21] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">9909</div>
                <div className="text-sm text-gray-400">Ручной режим (локально)</div>
              </div>
              <Button onClick={goManualChat} className="h-10 px-4 text-sm font-semibold">В чат</Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 ml-1">Маршрут</label>
                <Input
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="Например: 244"
                  className="bg-[#1C1C1E] border-none text-white h-11 text-base rounded-xl placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-ios-blue"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 ml-1">Гос. номер</label>
                <Input
                  value={number}
                  onChange={(e) => setNumber(e.target.value.toUpperCase())}
                  placeholder="Например: 521AV05"
                  className="bg-[#1C1C1E] border-none text-white h-11 text-base rounded-xl placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-ios-blue uppercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 ml-1">Стоимость</label>
                <div className="flex items-center px-4 h-11 bg-[#1C1C1E] rounded-xl text-gray-300 text-base">
                  {price}
                </div>
              </div>

              <div className="rounded-xl bg-[#1C1C1E] p-3 space-y-2">
                <p className="text-sm text-gray-400">Опционально: подтянуть из Onay перед ручным чатом</p>
                <div className="flex gap-2">
                  <Input
                    value={terminal}
                    onChange={(e) => setTerminal(e.target.value)}
                    placeholder="Код терминала"
                    className="bg-[#141416] border-none text-white h-11 text-base rounded-xl placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-ios-blue"
                  />
                  <Button
                    type="button"
                    onClick={handleOnayFetch}
                    className="h-11 px-4 text-sm font-semibold"
                    disabled={loadingOnay}
                  >
                    {loadingOnay ? "Запрос..." : "Получить"}
                  </Button>
                </div>
                {lastOnay && (
                  <div className="text-sm text-gray-300 space-y-1 bg-[#141416] rounded-xl p-3">
                    <div><span className="text-gray-500">Маршрут:</span> {lastOnay.route || "—"}</div>
                    <div><span className="text-gray-500">Гос. номер:</span> {lastOnay.plate || "—"}</div>
                    <div><span className="text-gray-500">Цена:</span> {formatCost(lastOnay.cost)}</div>
                  </div>
                )}
              </div>
            </div>

            <Button 
              onClick={goManualChat}
              className="w-full h-11 text-base font-semibold bg-ios-blue hover:bg-blue-600 text-white rounded-xl transition-colors"
            >
              Перейти в чат (ручной)
            </Button>

            <Button 
              onClick={clearHistory}
              className="w-full h-11 text-base font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
            >
              Очистить историю
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
