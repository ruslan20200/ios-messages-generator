// MODIFIED BY AI: 2026-02-12 - reduce chat element scale and improve adaptive iMessage-like proportions
// FILE: client/src/pages/Chat.tsx

import { ChatHeader } from "@/components/ChatHeader";
import { MessageBubble } from "@/components/MessageBubble";
import { QrScannerSheet } from "@/components/QrScannerSheet";
import { useChat, type Message as ChatMessage } from "@/contexts/ChatContext";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Mic, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const API_STORAGE_KEY = "ios_msg_history_api";
const API_SESSION_STORAGE_KEY = "ios_msg_history_api_session";
const API_BASE = String(import.meta.env.VITE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;
const KEYBOARD_OPEN_THRESHOLD = 72;
const TERMINAL_DIGITS_PATTERN = /^\d+$/;
const MAX_PERSISTED_API_MESSAGES = 140;
const STORAGE_WRITE_DEBOUNCE_MS = 180;
const DEFAULT_KEYBOARD_MAX_OFFSET = 360;
const ACTION_MENU_WIDTH = 230;
const ACTION_MENU_HEIGHT = 132;

const runWhenIdle = (task: () => void): (() => void) => {
  const win = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof win.requestIdleCallback === "function") {
    const id = win.requestIdleCallback(task, { timeout: 800 });
    return () => win.cancelIdleCallback?.(id);
  }

  const timeoutId = window.setTimeout(task, 0);
  return () => window.clearTimeout(timeoutId);
};

const isIOSDevice = () => {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const iOSUa = /iPhone|iPad|iPod/i.test(userAgent);
  const iPadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSUa || iPadDesktopMode;
};

const restoreApiMessages = (): ChatMessage[] => {
  const sessionSaved = sessionStorage.getItem(API_SESSION_STORAGE_KEY);
  const localSaved = localStorage.getItem(API_STORAGE_KEY);
  const saved = sessionSaved || localSaved;
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_PERSISTED_API_MESSAGES).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
};

// MODIFIED BY AI: 2026-02-12 - reduce long retry waits and add per-attempt timeout for Onay requests
// FILE: client/src/pages/Chat.tsx
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

export default function Chat() {
  const { settings, messages, sendMessage, deleteMessage } = useChat();
  const [inputCode, setInputCode] = useState("");
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>(restoreApiMessages);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<{
    id: string;
    text: string;
    x: number;
    y: number;
  } | null>(null);
  // MODIFIED BY AI: 2026-02-12 - keep composer visible above mobile keyboard while preserving old visual style
  // FILE: client/src/pages/Chat.tsx
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isIOSRef = useRef(isIOSDevice());
  const lastSerializedApiMessagesRef = useRef("");

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
    const trimmedMessages = apiMessages.slice(-MAX_PERSISTED_API_MESSAGES);
    const serialized = JSON.stringify(trimmedMessages);

    if (lastSerializedApiMessagesRef.current === serialized) {
      return;
    }

    lastSerializedApiMessagesRef.current = serialized;
    sessionStorage.setItem(API_SESSION_STORAGE_KEY, serialized);

    let cancelIdle = () => {};
    const timer = window.setTimeout(() => {
      cancelIdle = runWhenIdle(() => {
        localStorage.setItem(API_STORAGE_KEY, serialized);
      });
    }, STORAGE_WRITE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      cancelIdle();
    };
  }, [apiMessages, mode]);

  useEffect(() => {
    if (isIOSRef.current) {
      setKeyboardOffset(0);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) return;

    const syncKeyboardOffset = () => {
      if (!isInputFocused) {
        setKeyboardOffset(0);
        return;
      }

      const visibleHeight = Math.round(viewport.height + viewport.offsetTop);
      const rawOffset = Math.max(0, Math.round(window.innerHeight - visibleHeight));
      const maxOffset = DEFAULT_KEYBOARD_MAX_OFFSET;
      const nextOffset =
        rawOffset > KEYBOARD_OPEN_THRESHOLD
          ? Math.max(0, Math.min(Math.round(rawOffset), maxOffset))
          : 0;

      setKeyboardOffset(nextOffset);
    };

    syncKeyboardOffset();
    viewport.addEventListener("resize", syncKeyboardOffset);
    window.addEventListener("orientationchange", syncKeyboardOffset);

    return () => {
      viewport.removeEventListener("resize", syncKeyboardOffset);
      window.removeEventListener("orientationchange", syncKeyboardOffset);
    };
  }, [isInputFocused]);

  useEffect(() => {
    if (!isInputFocused) {
      setKeyboardOffset(0);
    }
  }, [isInputFocused]);

  useEffect(() => {
    if (keyboardOffset > 0) {
      scrollToBottom("auto");
    }
  }, [keyboardOffset]);

  useEffect(() => {
    if (!actionMenu) return;

    const handleGlobalClose = () => {
      closeActionMenu();
    };

    window.addEventListener("resize", handleGlobalClose);
    window.addEventListener("scroll", handleGlobalClose, true);
    window.addEventListener("orientationchange", handleGlobalClose);

    return () => {
      window.removeEventListener("resize", handleGlobalClose);
      window.removeEventListener("scroll", handleGlobalClose, true);
      window.removeEventListener("orientationchange", handleGlobalClose);
    };
  }, [actionMenu]);

  const appendApi = (msg: ChatMessage) => {
    setApiMessages((prev) => {
      const next = [...prev, msg];
      return next.length > MAX_PERSISTED_API_MESSAGES
        ? next.slice(-MAX_PERSISTED_API_MESSAGES)
        : next;
    });
  };

  const closeActionMenu = () => {
    setActionMenu(null);
  };

  const openActionMenu = (payload: {
    id: string;
    text: string;
    rect: DOMRect;
  }) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = Math.max(
      12,
      Math.min(
        Math.round(payload.rect.left + payload.rect.width / 2 - ACTION_MENU_WIDTH / 2),
        viewportWidth - ACTION_MENU_WIDTH - 12,
      ),
    );

    const preferredTop = Math.round(payload.rect.top - ACTION_MENU_HEIGHT - 12);
    const top =
      preferredTop > 76
        ? preferredTop
        : Math.min(
            viewportHeight - ACTION_MENU_HEIGHT - 16,
            Math.round(payload.rect.bottom + 12),
          );

    setActionMenu({
      id: payload.id,
      text: payload.text,
      x: left,
      y: Math.max(14, top),
    });
  };

  const handleCopyMessage = async () => {
    if (!actionMenu) return;

    try {
      await navigator.clipboard.writeText(actionMenu.text);
      toast.success("Скопировано");
    } catch {
      toast.error("Не удалось скопировать сообщение");
    } finally {
      closeActionMenu();
    }
  };

  const handleDeleteMessage = () => {
    if (!actionMenu) return;

    if (mode === "api") {
      setApiMessages((prev) => prev.filter((message) => message.id !== actionMenu.id));
    } else {
      deleteMessage(actionMenu.id);
    }

    toast.success("Сообщение удалено");
    closeActionMenu();
  };

  const handleTerminalDetected = (terminalId: string) => {
    setInputCode(terminalId);
    toast.success("QR распознан", {
      description: `Terminal ID: ${terminalId}`,
    });

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
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
        2,
        800,
        12000,
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
            id={msg.id}
            text={msg.text}
            isMe={msg.isMe}
            timestamp={msg.timestamp}
            showTimestamp={msg.isMe}
            isSelected={actionMenu?.id === msg.id}
            isDimmed={Boolean(actionMenu)}
            details={msg.details}
            onOpenActions={({ id, text, rect }) => {
              openActionMenu({ id, text, rect });
            }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="fixed left-0 right-0 z-50 safe-area-bottom"
        style={{ bottom: isIOSRef.current ? 10 : keyboardOffset + 30 }}
      >
        <div className="mx-auto flex w-full max-w-md items-end gap-1.5 px-2.5 pb-1.5">
          <button
            type="button"
            className="mb-0.5 flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/18 bg-[#2b2c31] text-white shadow-[0_4px_12px_rgba(0,0,0,0.27)] transition-colors hover:bg-[#34353b]"
            aria-label="Добавить"
            onClick={() => setIsScannerOpen(true)}
          >
            <Plus size={21} strokeWidth={2.2} />
          </button>

          <form onSubmit={handleSend} className="flex-1">
            <div className="rounded-[21px] border border-white/18 bg-[#313239]/95 px-3 pb-1.5 pt-1.75 shadow-[0_6px_14px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="text-[clamp(18px,3.6vw,15px)] font-medium text-[#9ea0a9]">Тема</div>
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
                    setIsInputFocused(true);
                    setTimeout(() => {
                      scrollToBottom("auto");
                    }, 80);
                  }}
                  onBlur={() => setIsInputFocused(false)}
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

      <QrScannerSheet
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onDetected={handleTerminalDetected}
      />

      <AnimatePresence>
        {actionMenu && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 z-[120] bg-black/18 backdrop-blur-[1px]"
              onClick={closeActionMenu}
              aria-label="Закрыть меню"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.17, ease: [0.22, 1, 0.36, 1] }}
              className="fixed z-[121] w-[230px] overflow-hidden rounded-[22px] border border-white/14 bg-[#151820]/95 p-1.5 shadow-[0_20px_45px_rgba(0,0,0,0.46)] backdrop-blur-xl"
              style={{ left: actionMenu.x, top: actionMenu.y }}
            >
              <button
                type="button"
                className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[17px] font-medium text-[#f2f4fa] transition-colors hover:bg-white/8"
                onClick={handleCopyMessage}
              >
                Скопировать
              </button>

              <div className="my-1 h-px bg-white/10" />

              <button
                type="button"
                className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[17px] font-medium text-[#ff8585] transition-colors hover:bg-white/8"
                onClick={handleDeleteMessage}
              >
                Удалить
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
