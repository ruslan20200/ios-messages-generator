import { addMinutes, format } from "date-fns";
import { nanoid } from "nanoid";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export interface Message {
  id: string;
  text: string;
  isMe: boolean;
  timestamp: Date;
  details?: {
    route: string;
    number: string;
    price: string;
    suffix: string;
    link: string;
  };
}

interface ChatSettings {
  route: string;
  number: string;
  price: string;
}

interface ChatContextType {
  settings: ChatSettings;
  messages: Message[];
  updateSettings: (route: string, number: string, price?: string) => void;
  sendMessage: (code: string) => void;
  deleteMessage: (id: string) => void;
  clearHistory: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY_SETTINGS = "ios_msg_settings";
const STORAGE_KEY_MESSAGES = "ios_msg_history";
const SESSION_STORAGE_KEY_MESSAGES = "ios_msg_history_session";
// API чат хранится отдельно, чистим вместе с ручным
const STORAGE_KEY_MESSAGES_API = "ios_msg_history_api";
const MAX_PERSISTED_MESSAGES = 140;
const STORAGE_WRITE_DEBOUNCE_MS = 180;

const runWhenIdle = (task: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};

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

const restoreManualMessages = (): Message[] => {
  const sessionSaved = sessionStorage.getItem(SESSION_STORAGE_KEY_MESSAGES);
  const localSaved = localStorage.getItem(STORAGE_KEY_MESSAGES);
  const saved = sessionSaved || localSaved;
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_PERSISTED_MESSAGES).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const defaultSettings: ChatSettings = { route: "", number: "", price: "120₸" };

  const [settings, setSettings] = useState<ChatSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        route: parsed.route || "",
        number: parsed.number || "",
        price: parsed.price || "120₸",
      };
    }
    return defaultSettings;
  });

  const [messages, setMessages] = useState<Message[]>(restoreManualMessages);
  const lastSerializedMessagesRef = useRef("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const trimmedMessages = messages.slice(-MAX_PERSISTED_MESSAGES);
    const serialized = JSON.stringify(trimmedMessages);

    if (lastSerializedMessagesRef.current === serialized) {
      return;
    }

    lastSerializedMessagesRef.current = serialized;
    sessionStorage.setItem(SESSION_STORAGE_KEY_MESSAGES, serialized);

    let cancelIdle = () => {};
    const timer = window.setTimeout(() => {
      cancelIdle = runWhenIdle(() => {
        localStorage.setItem(STORAGE_KEY_MESSAGES, serialized);
      });
    }, STORAGE_WRITE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      cancelIdle();
    };
  }, [messages]);

  const updateSettings = (route: string, number: string, price?: string) => {
    setSettings({ route, number, price: price || settings.price || "120₸" });
  };

  const generateSuffix = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const sendMessage = (code: string) => {
    const now = new Date();
    
    // 1. User message (Green bubble)
    const userMsg: Message = {
      id: nanoid(),
      text: code,
      isMe: true,
      timestamp: now,
    };

    // 2. System response (Gray bubble)
    // Format: DD/MM HH:mm
    // But we need to be careful with formatting to match the requirement exactly
    // Requirement: AT {DD/MM HH:mm}
    
    const suffix = generateSuffix();
    const formattedDate = format(now, "dd/MM HH:mm");
    
    const price = settings.price || "120₸";
    const responseText = `ONAY! ALA\nAT ${formattedDate}\n${settings.route},${settings.number},${price}\nhttp://qr.tha.kz/${suffix}`;

    const systemMsg: Message = {
      id: nanoid(),
      text: responseText,
      isMe: false,
      timestamp: now, // Immediate response as per requirement implication
      details: {
        route: settings.route,
        number: settings.number,
        price,
        suffix: suffix,
        link: `/qr/${suffix}`
      }
    };

    setMessages((prev) => {
      const next = [...prev, userMsg, systemMsg];
      return next.length > MAX_PERSISTED_MESSAGES
        ? next.slice(-MAX_PERSISTED_MESSAGES)
        : next;
    });
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem(STORAGE_KEY_MESSAGES_API);
    sessionStorage.removeItem(SESSION_STORAGE_KEY_MESSAGES);
    sessionStorage.removeItem("ios_msg_history_api_session");
    setMessages([]);
  };

  const deleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== id));
  };

  return (
    <ChatContext.Provider
      value={{ settings, messages, updateSettings, sendMessage, deleteMessage, clearHistory }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
