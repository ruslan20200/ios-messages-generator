// MODIFIED BY AI: 2026-02-12 - reduce chat element scale and improve adaptive iMessage-like proportions
// FILE: client/src/pages/Chat.tsx

import { ChatHeader } from "@/components/ChatHeader";
import { MessageBubble } from "@/components/MessageBubble";
import { useChat, type Message as ChatMessage } from "@/contexts/ChatContext";
import { ArrowUp, Mic, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const API_STORAGE_KEY = "ios_msg_history_api";
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;
const KEYBOARD_OPEN_THRESHOLD = 72;
const TERMINAL_DIGITS_PATTERN = /^\d+$/;

async function fetchWithRetry(path: string, init: RequestInit, attempts = 3, delayMs = 3000) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(apiUrl(path), init);
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
    }
  }
  throw lastError ?? new Error("Failed to fetch");
}

export default function Chat() {
  const { settings, messages, sendMessage } = useChat();
  const [inputCode, setInputCode] = useState("");
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
  // MODIFIED BY AI: 2026-02-12 - keep composer visible above mobile keyboard while preserving old visual style
  // FILE: client/src/pages/Chat.tsx
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mode =
    new URLSearchParams(window.location.search).get("mode") === "api"
      ? "api"
      : "manual";

  const badge = (
    <svg
      viewBox="0 0 14 22"
      className="relative -ml-0.5 h-[15px] w-[11px] text-[#6f7078]"
      aria-label={mode === "api" ? "API mode" : "Manual mode"}
    >
      <path
        d="M2.5 2.5L10.8 11L2.5 19.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const canSend = inputCode.trim().length > 0;

  const generateSuffix = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (mode === "api") {
      scrollToBottom();
    }
  }, [apiMessages, mode]);

  useEffect(() => {
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

  useEffect(() => {
    if (mode !== "api") return;
    localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiMessages));
  }, [apiMessages, mode]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const syncKeyboardOffset = () => {
      const rawOffset = window.innerHeight - viewport.height - viewport.offsetTop;
      const nextOffset = rawOffset > KEYBOARD_OPEN_THRESHOLD ? Math.round(rawOffset) : 0;
      setKeyboardOffset(nextOffset);
    };

    syncKeyboardOffset();
    viewport.addEventListener("resize", syncKeyboardOffset);
    viewport.addEventListener("scroll", syncKeyboardOffset);
    window.addEventListener("orientationchange", syncKeyboardOffset);
    window.addEventListener("focusin", syncKeyboardOffset);
    window.addEventListener("focusout", syncKeyboardOffset);

    return () => {
      viewport.removeEventListener("resize", syncKeyboardOffset);
      viewport.removeEventListener("scroll", syncKeyboardOffset);
      window.removeEventListener("orientationchange", syncKeyboardOffset);
      window.removeEventListener("focusin", syncKeyboardOffset);
      window.removeEventListener("focusout", syncKeyboardOffset);
    };
  }, []);

  useEffect(() => {
    if (keyboardOffset > 0) {
      scrollToBottom("auto");
    }
  }, [keyboardOffset]);

  const appendApi = (msg: ChatMessage) => {
    setApiMessages((prev) => [...prev, msg]);
  };

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = inputCode.trim();
    if (!text) return;

    if (mode === "manual") {
      setInputCode("");
      sendMessage(text);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return;
    }

    // MODIFIED BY AI: 2026-02-12 - block non-digit terminal codes in API mode and show explicit error
    // FILE: client/src/pages/Chat.tsx
    if (!TERMINAL_DIGITS_PATTERN.test(text)) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: "Ошибка. Для запроса вводите только цифры.",
        isMe: false,
        timestamp: new Date(),
      };
      appendApi(errMsg);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return;
    }

    setInputCode("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      isMe: true,
      timestamp: new Date(),
    };
    appendApi(userMsg);

    try {
      const resp = await fetchWithRetry(
        "/api/onay/qr-start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terminal: text }),
        },
        3,
        3000,
      );

      const body = await resp.json();
      if (!resp.ok || !body.success) {
        throw new Error(body?.message || `Код отклонён (${resp.status})`);
      }

      const data = body.data || {};
      const isEmptyPayload = !data.route && !data.plate;

      if (isEmptyPayload) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          text: "Ошибка. Услуга временно недоступна, попробуйте позже.",
          isMe: false,
          timestamp: new Date(),
        };
        appendApi(errMsg);
        return;
      }

      const route = data.route || "—";
      const plate = data.plate || "—";
      const price =
        typeof data.cost === "number"
          ? `${Math.round(data.cost / 100)}₸`
          : settings.price || "120₸";

      const suffix = generateSuffix();
      const formattedDate = new Date().toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
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
          link: `/qr/${suffix}`,
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
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <ChatHeader title="9909" badge={badge} />

      <div
        className="flex-1 overflow-y-auto px-3.5 pt-[148px] space-y-1 scroll-smooth"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          paddingBottom: 118 + keyboardOffset,
        }}
      >
        {(mode === "api" ? apiMessages : messages).map((msg) => (
          <MessageBubble
            key={msg.id}
            text={msg.text}
            isMe={msg.isMe}
            timestamp={msg.timestamp}
            showTimestamp={msg.isMe}
            details={msg.details}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="fixed left-0 right-0 z-50 safe-area-bottom"
        style={{ bottom: keyboardOffset }}
      >
        <div className="mx-auto flex w-full max-w-md items-end gap-1.5 px-2.5 pb-1.5">
          <button
            type="button"
            className="mb-0.5 flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/18 bg-[#2b2c31] text-white shadow-[0_4px_12px_rgba(0,0,0,0.27)] transition-colors hover:bg-[#34353b]"
            aria-label="Добавить"
          >
            <Plus size={21} strokeWidth={2.2} />
          </button>

          <form onSubmit={handleSend} className="flex-1">
            <div className="rounded-[21px] border border-white/18 bg-[#313239]/95 px-3 pb-1.5 pt-1.75 shadow-[0_6px_14px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="text-[clamp(12px,3.6vw,15px)] font-semibold text-[#9ea0a9]">Тема</div>
              <div className="mt-0.75 h-px bg-white/20" />

              <div className="mt-0.75 flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputCode}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setInputCode(mode === "api" ? nextValue.replace(/\D+/g, "") : nextValue);
                  }}
                  inputMode={mode === "api" ? "numeric" : "text"}
                  pattern={mode === "api" ? "[0-9]*" : undefined}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollToBottom("auto");
                    }, 80);
                  }}
                  placeholder={mode === "api" ? "Текстовое сообщение • SMS" : "Текстовое сообщение • iMessage"}
                  className="h-[30px] flex-1 bg-transparent text-[clamp(12px,3.8vw,15px)] font-medium text-white placeholder:text-[clamp(12px,3.8vw,15px)] placeholder:text-[#8f9199] focus:outline-none"
                />

                {canSend ? (
                  <button
                    type="submit"
                    className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[#32d957] text-white shadow-[0_4px_8px_rgba(50,217,87,0.28)] transition-all duration-150 active:scale-[0.97]"
                    aria-label="Отправить"
                  >
                    <ArrowUp size={17} strokeWidth={2.8} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pr-0.5 text-[#8f9199] transition-colors hover:text-[#b7b9c3]"
                    aria-label="Микрофон"
                  >
                    <Mic size={19} strokeWidth={2.1} />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
