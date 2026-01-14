import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/contexts/ChatContext";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { settings, updateSettings, clearHistory } = useChat();
  const [route, setRoute] = useState(settings.route || "244");
  const [number, setNumber] = useState(settings.number || "521AV05");
  const [_, setLocation] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (route && number) {
      updateSettings(route, number);
      setLocation("/chat");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Настройка</h1>
          <p className="text-gray-400">Введите данные маршрута</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 ml-1">Маршрут</label>
              <Input
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="Например: 244"
                className="bg-[#1C1C1E] border-none text-white h-12 text-lg rounded-xl placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-ios-blue"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 ml-1">Гос. номер</label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value.toUpperCase())}
                placeholder="Например: 521AV05"
                className="bg-[#1C1C1E] border-none text-white h-12 text-lg rounded-xl placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-ios-blue uppercase"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 ml-1">Стоимость</label>
              <div className="flex items-center px-4 h-12 bg-[#1C1C1E] rounded-xl text-gray-500 text-lg cursor-not-allowed">
                120₸
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-semibold bg-ios-blue hover:bg-blue-600 text-white rounded-xl transition-colors"
          >
            Продолжить
          </Button>
        </form>

        <Button 
          onClick={clearHistory}
          className="w-full h-12 text-lg font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors mt-4"
        >
          Очистить историю
        </Button>
      </div>
    </div>
  );
}
