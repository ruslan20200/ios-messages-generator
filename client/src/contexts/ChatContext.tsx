import { addMinutes, format } from "date-fns";
import { nanoid } from "nanoid";
import React, { createContext, useContext, useEffect, useState } from "react";

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
  clearHistory: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY_SETTINGS = "ios_msg_settings";
const STORAGE_KEY_MESSAGES = "ios_msg_history";
// API чат хранится отдельно, чистим вместе с ручным
const STORAGE_KEY_MESSAGES_API = "ios_msg_history_api";

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

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (saved) {
      // Restore Date objects from strings
      return JSON.parse(saved).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
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

    setMessages((prev) => [...prev, userMsg, systemMsg]);
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem(STORAGE_KEY_MESSAGES_API);
    setMessages([]);
  };

  return (
    <ChatContext.Provider
      value={{ settings, messages, updateSettings, sendMessage, clearHistory }}
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
