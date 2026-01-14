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
}

interface ChatContextType {
  settings: ChatSettings;
  messages: Message[];
  updateSettings: (route: string, number: string) => void;
  sendMessage: (code: string) => void;
  clearHistory: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY_SETTINGS = "ios_msg_settings";
const STORAGE_KEY_MESSAGES = "ios_msg_history";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ChatSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return saved ? JSON.parse(saved) : { route: "", number: "" };
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

  const updateSettings = (route: string, number: string) => {
    setSettings({ route, number });
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
    
    const responseText = `ONAY! ALA\nAT ${formattedDate}\n${settings.route},${settings.number},120₸\nhttp://qr.tha.kz/${suffix}`;

    const systemMsg: Message = {
      id: nanoid(),
      text: responseText,
      isMe: false,
      timestamp: now, // Immediate response as per requirement implication
      details: {
        route: settings.route,
        number: settings.number,
        price: "120₸",
        suffix: suffix,
        link: `http://qr.tha.kz/${suffix}`
      }
    };

    setMessages((prev) => [...prev, userMsg, systemMsg]);
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
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
