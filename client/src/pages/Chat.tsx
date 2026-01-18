import { ChatHeader } from "@/components/ChatHeader";
import { MessageBubble } from "@/components/MessageBubble";
import { useChat, type Message as ChatMessage } from "@/contexts/ChatContext";
import { Plus, Mic } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { format } from "date-fns";

const API_STORAGE_KEY = "ios_msg_history_api";
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

export default function Chat() {
  const { settings, messages, sendMessage } = useChat();
  const [inputCode, setInputCode] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(API_STORAGE_KEY);
    if (!saved) return [];
    try {
      return JSON.parse(saved).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    } catch {
      return [];
    }
  });
  const mode =
    new URLSearchParams(window.location.search).get("mode") === "api"
      ? "api"
      : "manual";

  const badge = (
    <span
      className="text-gray-400 text-[30px] leading-none relative -mt-1 -ml-1 font-bold"
      aria-label={mode === "api" ? "API mode" : "Manual mode"}
    >
      ›
    </span>
  );

  const generateSuffix = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (mode === "api") {
      scrollToBottom();
    }
  }, [apiMessages, mode]);

  // Auto-focus input on mount
  useEffect(() => {
    // Small delay to ensure transition is done
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === API_STORAGE_KEY && event.newValue === null) {
        setApiMessages([]);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Persist API history
  useEffect(() => {
    if (mode !== "api") return;
    localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiMessages));
  }, [apiMessages, mode]);

  const formatDayLabel = (date: Date) => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const msgDay = format(date, "yyyy-MM-dd");

    const yesterday = format(new Date(now.getTime() - 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    if (msgDay === today) return "Сегодня";
    if (msgDay === yesterday) return "Вчера";
    return format(date, "dd MMM");
  };

  const appendApi = (msg: ChatMessage) => {
    setApiMessages((prev) => [...prev, msg]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputCode.trim()) return;

    const text = inputCode.trim();
    setInputCode("");

    if (mode === "manual") {
      sendMessage(text);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return;
    }

    const now = new Date();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      isMe: true,
      timestamp: now,
    };
    appendApi(userMsg);

    try {
      const resp = await fetch(apiUrl("/api/onay/qr-start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminal: text }),
      });

      const body = await resp.json();
      if (!resp.ok || !body.success) {
        throw new Error(body?.message || `Код отклонён (${resp.status})`);
      }

      const data = body.data || {};
      const route = data.route || "—";
      const plate = data.plate || "—";
      const price =
        typeof data.cost === "number"
          ? `${Math.round(data.cost / 100)}₸`
          : settings.price || "120₸";

      const suffix = generateSuffix();
      const formattedDate = format(new Date(), "dd/MM HH:mm");
      const responseText = `ONAY! ALA\nAT ${formattedDate}\n${route},${plate},${price}\nhttp://qr.tha.kz/${suffix}`;

      const systemMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: responseText,
        isMe: false,
        timestamp: new Date(),
        details: {
          route,
          number: plate,
          price,
          suffix,
          link: `http://qr.tha.kz/${suffix}`,
        },
      };
      appendApi(systemMsg);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Код неверный или сервис недоступен";
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: `Ошибка. ${message}`,
        isMe: false,
        timestamp: new Date(),
      };
      appendApi(errMsg);
    } finally {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden">
      <ChatHeader title="9909" badge={badge} />

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto pt-[120px] pb-[140px] px-4 space-y-2 scroll-smooth"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}
      >
        {(mode === "api" ? apiMessages : messages).map((msg, index, arr) => {
          const dayLabel = formatDayLabel(msg.timestamp);
          const prev = arr[index - 1];
          const prevDay = prev ? formatDayLabel(prev.timestamp) : "";
          const showDay = dayLabel !== prevDay;
          const showTime = msg.isMe;

          return (
            <Fragment key={msg.id}>
              <MessageBubble
                text={msg.text}
                isMe={msg.isMe}
                timestamp={msg.timestamp}
                showTimestamp={showTime}
                details={msg.details}
              />
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 safe-area-bottom z-50">
        <div className="flex items-center px-3 py-7 min-h-[55px]">
          <button className="w-10 h-10 rounded-full bg-[#262628] flex items-center justify-center text-white hover:bg-[#2C2C2E] transition-colors">
            <Plus size={20} strokeWidth={2.5} />
          </button>
          
          <form onSubmit={handleSend} className="flex-1 mx-2 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Текстовое сообщение • ..."
              className="w-full bg-[#262628]/90 rounded-full px-4 pr-12 py-4 text-[17px] text-white placeholder:text-[#8E8E93] focus:outline-none transition-colors h-12"
            />
            <button 
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:opacity-80 transition-opacity"
            >
              <Mic size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
