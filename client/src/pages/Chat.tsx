// MODIFIED BY AI: 2026-02-12 - reduce chat element scale and improve adaptive iMessage-like proportions
// FILE: client/src/pages/Chat.tsx

import { ChatHeader } from "@/components/ChatHeader";
import {
  CHAT2505_MESSAGES_SESSION_STORAGE_KEY,
  CHAT2505_MESSAGES_STORAGE_KEY,
  createChat2505Conversation,
  readChat2505Settings,
  restoreChat2505Messages,
  trimChat2505Messages,
} from "@/lib/chat2505";
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
const IOS_KEYBOARD_TOOLBAR_OFFSET = 46;
const IOS_KEYBOARD_SETTLE_DELAYS_MS = [0, 90, 180, 320, 520, 760];
const ACTION_MENU_WIDTH = 230;
const ACTION_MENU_HEIGHT = 132;
const CHAT2505_RESPONSE_DELAY_MIN_MS = 1100;
const CHAT2505_RESPONSE_DELAY_MAX_MS = 2200;

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
  const [chat2505Messages, setChat2505Messages] = useState<ChatMessage[]>(
    restoreChat2505Messages,
  );
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
  const lastSerialized2505MessagesRef = useRef("");
  const viewportBaseHeightRef = useRef(typeof window !== "undefined" ? window.innerHeight : 0);
  const keyboardSyncRef = useRef<() => void>(() => {});
  const pendingKeyboardSettleTimeoutsRef = useRef<number[]>([]);
  const pending2505TimeoutsRef = useRef<number[]>([]);

  // MODIFIED BY AI: 2026-03-26 - support a third local chat mode for 2505 transport tickets without touching api/manual flows
  // FILE: client/src/pages/Chat.tsx
  const queryMode = new URLSearchParams(window.location.search).get("mode");
  const mode = queryMode === "api" ? "api" : queryMode === "2505" ? "2505" : "manual";
  const isNumericMode = mode === "api" || mode === "2505";
  const chatTitle = mode === "2505" ? "2505" : "9909";
  const activeMessages =
    mode === "api" ? apiMessages : mode === "2505" ? chat2505Messages : messages;

  const badge = (
    <svg
      viewBox="0 0 14 22"
      className="relative -ml-0.5 h-[15px] w-[11px] text-[#6f7078]"
      aria-label={
        mode === "api" ? "API mode" : mode === "2505" ? "2505 transport mode" : "Manual mode"
      }
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
  const conversationStartedAt = activeMessages[0]?.timestamp ?? new Date();
  const conversationMetaLabel = `\u0421\u0435\u0433\u043e\u0434\u043d\u044f ${conversationStartedAt.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  const generateSuffix = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const schedule2505Response = (message: ChatMessage) => {
    const delay =
      CHAT2505_RESPONSE_DELAY_MIN_MS +
      Math.floor(
        Math.random() * (CHAT2505_RESPONSE_DELAY_MAX_MS - CHAT2505_RESPONSE_DELAY_MIN_MS + 1),
      );

    const timeoutId = window.setTimeout(() => {
      setChat2505Messages((prev) =>
        trimChat2505Messages([...prev, { ...message, timestamp: new Date() }]),
      );
      pending2505TimeoutsRef.current = pending2505TimeoutsRef.current.filter(
        (id) => id !== timeoutId,
      );
    }, delay);

    pending2505TimeoutsRef.current.push(timeoutId);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // MODIFIED BY AI: 2026-03-26 - stabilize iPhone keyboard opening by re-syncing composer position while visualViewport settles
  // FILE: client/src/pages/Chat.tsx
  const clearPendingKeyboardSettles = () => {
    pendingKeyboardSettleTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    pendingKeyboardSettleTimeoutsRef.current = [];
  };

  const scheduleKeyboardSettleSync = () => {
    clearPendingKeyboardSettles();

    IOS_KEYBOARD_SETTLE_DELAYS_MS.forEach((delay) => {
      const timeoutId = window.setTimeout(() => {
        keyboardSyncRef.current();
        scrollToBottom("auto");
      }, delay);
      pendingKeyboardSettleTimeoutsRef.current.push(timeoutId);
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (mode === "api" || mode === "2505") {
      scrollToBottom();
    }
  }, [apiMessages, chat2505Messages, mode]);

  useEffect(() => {
    if (isIOSRef.current) return;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === API_STORAGE_KEY && event.newValue === null) {
        setApiMessages([]);
      }

      if (event.key === CHAT2505_MESSAGES_STORAGE_KEY && event.newValue === null) {
        setChat2505Messages([]);
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
    if (mode !== "2505") return;
    const trimmedMessages = trimChat2505Messages(chat2505Messages);
    const serialized = JSON.stringify(trimmedMessages);

    if (lastSerialized2505MessagesRef.current === serialized) {
      return;
    }

    lastSerialized2505MessagesRef.current = serialized;
    sessionStorage.setItem(CHAT2505_MESSAGES_SESSION_STORAGE_KEY, serialized);

    let cancelIdle = () => {};
    const timer = window.setTimeout(() => {
      cancelIdle = runWhenIdle(() => {
        localStorage.setItem(CHAT2505_MESSAGES_STORAGE_KEY, serialized);
      });
    }, STORAGE_WRITE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      cancelIdle();
    };
  }, [chat2505Messages, mode]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let rafId = 0;

    // MODIFIED BY AI: 2026-03-19 - stabilize first iPhone keyboard open by measuring against the pre-keyboard viewport height
    // FILE: client/src/pages/Chat.tsx
    const syncKeyboardOffset = () => {
      const visibleHeight = Math.round(viewport.height + viewport.offsetTop);
      const candidateBaseHeight = Math.max(
        viewportBaseHeightRef.current,
        Math.round(window.innerHeight),
        visibleHeight,
      );

      if (!isInputFocused) {
        viewportBaseHeightRef.current = candidateBaseHeight;
        setKeyboardOffset(0);
        return;
      }

      const rawOffset = Math.max(0, viewportBaseHeightRef.current - visibleHeight);
      const maxOffset = isIOSRef.current ? 420 : DEFAULT_KEYBOARD_MAX_OFFSET;
      const nextOffset =
        rawOffset > KEYBOARD_OPEN_THRESHOLD
          ? Math.max(0, Math.min(Math.round(rawOffset), maxOffset))
          : 0;

      if (nextOffset === 0) {
        viewportBaseHeightRef.current = candidateBaseHeight;
      }

      setKeyboardOffset(nextOffset);
    };

    const scheduleSync = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(syncKeyboardOffset);
    };

    keyboardSyncRef.current = scheduleSync;

    scheduleSync();
    viewport.addEventListener("resize", scheduleSync);
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("orientationchange", scheduleSync);

    return () => {
      window.cancelAnimationFrame(rafId);
      viewport.removeEventListener("resize", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
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

  useEffect(() => {
    return () => {
      clearPendingKeyboardSettles();
      pending2505TimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      pending2505TimeoutsRef.current = [];
    };
  }, []);

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
      toast.success("\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e");
    } catch {
      toast.error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435");
    } finally {
      closeActionMenu();
    }
  };

  const handleDeleteMessage = () => {
    if (!actionMenu) return;

    if (mode === "api") {
      setApiMessages((prev) => prev.filter((message) => message.id !== actionMenu.id));
    } else if (mode === "2505") {
      setChat2505Messages((prev) => prev.filter((message) => message.id !== actionMenu.id));
    } else {
      deleteMessage(actionMenu.id);
    }

    toast.success("\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e");
    closeActionMenu();
  };

  const handleSendText = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    if (mode === "manual") {
      setInputCode("");
      sendMessage(text);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return;
    }

    // MODIFIED BY AI: 2026-03-26 - generate local 2505 transport SMS replies from saved phone/transport settings
    // FILE: client/src/pages/Chat.tsx
    if (mode === "2505") {
      setInputCode("");

      if (!/^\d{5}$/.test(text)) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          text: "\u041e\u0448\u0438\u0431\u043a\u0430. \u0412\u0432\u0435\u0434\u0438\u0442\u0435 5 \u0446\u0438\u0444\u0440 \u043a\u043e\u0434\u0430 \u0442\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442\u0430.",
          isMe: false,
          timestamp: new Date(),
        };
        setChat2505Messages((prev) => trimChat2505Messages([...prev, errMsg]));
        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
        return;
      }

      const settings2505 = readChat2505Settings();
      const { userMessage, responseMessage } = createChat2505Conversation({
        code: text,
        settings: settings2505,
        now: new Date(),
      });

      setChat2505Messages((prev) => trimChat2505Messages([...prev, userMessage]));
      schedule2505Response(responseMessage);

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
        text: "\u041e\u0448\u0438\u0431\u043a\u0430. \u0414\u043b\u044f \u0437\u0430\u043f\u0440\u043e\u0441\u0430 \u0432\u0432\u043e\u0434\u0438\u0442\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u0446\u0438\u0444\u0440\u044b.",
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
        throw new Error(body?.message || `\u041a\u043e\u0434 \u043e\u0442\u043a\u043b\u043e\u043d\u0451\u043d (${resp.status})`);
      }

      const data = body.data || {};
      const isEmptyPayload = !data.route && !data.plate;

      if (isEmptyPayload) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          text: "\u041e\u0448\u0438\u0431\u043a\u0430. \u0423\u0441\u043b\u0443\u0433\u0430 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430, \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.",
          isMe: false,
          timestamp: new Date(),
        };
        appendApi(errMsg);
        return;
      }

      const route = data.route || "\u2014";
      const plate = data.plate || "\u2014";
      const price =
        typeof data.cost === "number"
          ? `${Math.round(data.cost / 100)}\u20b8`
          : settings.price || "120\u20b8";

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
          : "\u041a\u043e\u0434 \u043d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0438\u043b\u0438 \u0441\u0435\u0440\u0432\u0438\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d";
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: `\u041e\u0448\u0438\u0431\u043a\u0430. ${message}`,
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

  const handleTerminalDetected = (terminalId: string) => {
    const nextValue =
      mode === "2505" ? terminalId.replace(/\D+/g, "").slice(0, 5) : terminalId;
    setInputCode(nextValue);

    const autoSendEnabled = mode === "api" && settings.autoScan === true;
    toast.success("QR \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u043d", {
      description: autoSendEnabled
        ? `Terminal ID: ${nextValue}. \u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438...`
        : `Terminal ID: ${nextValue}`,
    });

    if (autoSendEnabled) {
      void handleSendText(nextValue);
      return;
    }

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    await handleSendText(inputCode);
  };

  const composerBottomOffset =
    keyboardOffset > 0
      ? keyboardOffset + (isIOSRef.current ? IOS_KEYBOARD_TOOLBAR_OFFSET : 8)
      : 10;
  const composerPaddingBottom = 108 + composerBottomOffset;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <ChatHeader title={chatTitle} badge={badge} />

      <div
        className="flex-1 overflow-y-auto px-3.5 pt-[148px] space-y-1 scroll-smooth"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          paddingBottom: composerPaddingBottom,
        }}
      >
        {/* MODIFIED BY AI: 2026-03-26 - hide the empty 2505 header until the first sent code creates a conversation */}
        {mode === "2505" && activeMessages.length > 0 ? (
          <div className="mb-4 pt-0.5 text-center text-[#8E8E93]">
            <div className="text-[11px] font-medium tracking-[0.01em]">{conversationMetaLabel}</div>
          </div>
        ) : null}

        {activeMessages.map((msg, index) => (
          <MessageBubble
            key={msg.id}
            id={msg.id}
            text={msg.text}
            isMe={msg.isMe}
            timestamp={msg.timestamp}
            showTimestamp={msg.isMe && !(mode === "2505" && index === 0)}
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
        style={{
          bottom: composerBottomOffset,
          paddingBottom: keyboardOffset > 0 ? 0 : undefined,
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-end gap-1.5 px-2.5 pb-1.5">
          <button
            type="button"
            className="mb-0.5 flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/18 bg-[#2b2c31] text-white shadow-[0_4px_12px_rgba(0,0,0,0.27)] transition-colors hover:bg-[#34353b]"
            aria-label={"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c"}
            onClick={() => setIsScannerOpen(true)}
          >
            <Plus size={21} strokeWidth={2.2} />
          </button>

          <form onSubmit={handleSend} className="flex-1">
            <div className="rounded-[21px] border border-white/18 bg-[#313239]/95 px-3 pb-1.5 pt-1.75 shadow-[0_6px_14px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <div className="text-[clamp(18px,3.6vw,15px)] font-medium text-[#9ea0a9]">{"\u0422\u0435\u043c\u0430"}</div>
              <div className="mt-0.75 h-px bg-white/20" />

              <div className="mt-0.75 flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputCode}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setInputCode(isNumericMode ? nextValue.replace(/\D+/g, "") : nextValue);
                  }}
                  inputMode={isNumericMode ? "numeric" : "text"}
                  pattern={isNumericMode ? "[0-9]*" : undefined}
                  maxLength={mode === "2505" ? 5 : undefined}
                  onFocus={() => {
                    setIsInputFocused(true);
                    scheduleKeyboardSettleSync();
                  }}
                  onBlur={() => {
                    setIsInputFocused(false);
                    clearPendingKeyboardSettles();
                  }}
                  placeholder={
                    mode === "api" || mode === "2505"
                      ? "\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u2022 SMS"
                      : "\u0422\u0435\u043a\u0441\u0442\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u2022 iMessage"
                  }
                  className="h-[30px] flex-1 bg-transparent text-[clamp(12px,3.8vw,15px)] font-medium text-white placeholder:text-[clamp(12px,3.8vw,15px)] placeholder:text-[#8f9199] focus:outline-none"
                />

                {canSend ? (
                  <button
                    type="submit"
                    className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[#32d957] text-white shadow-[0_4px_8px_rgba(50,217,87,0.28)] transition-all duration-150 active:scale-[0.97]"
                    aria-label={"\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c"}
                  >
                    <ArrowUp size={17} strokeWidth={2.8} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pr-0.5 text-[#8f9199] transition-colors hover:text-[#b7b9c3]"
                    aria-label={"\u041c\u0438\u043a\u0440\u043e\u0444\u043e\u043d"}
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
              aria-label={"\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e"}
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
                {"\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c"}
              </button>

              <div className="my-1 h-px bg-white/10" />

              <button
                type="button"
                className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[17px] font-medium text-[#ff8585] transition-colors hover:bg-white/8"
                onClick={handleDeleteMessage}
              >
                {"\u0423\u0434\u0430\u043b\u0438\u0442\u044c"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
