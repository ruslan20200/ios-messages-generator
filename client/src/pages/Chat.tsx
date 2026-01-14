import { ChatHeader } from "@/components/ChatHeader";
import { MessageBubble } from "@/components/MessageBubble";
import { useChat } from "@/contexts/ChatContext";
import { Plus, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Chat() {
  const { settings, messages, sendMessage } = useChat();
  const [inputCode, setInputCode] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    // Small delay to ensure transition is done
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputCode.trim()) return;
    
    sendMessage(inputCode);
    setInputCode("");
    
    // Keep focus
    setTimeout(() => {
        inputRef.current?.focus();
    }, 10);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden">
      <ChatHeader title={settings.route || "Маршрут"} subTitle={settings.number} />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-[100px] pb-[60px] px-4 space-y-1 scroll-smooth">
        {messages.map((msg, index) => {
          // Show timestamp if it's the first message or if significant time passed since last message (e.g., 15 mins)
          // For simplicity, we'll show it if it's the first message of the day or first in list
          const showTime = msg.isMe;

          return (
            <MessageBubble
              key={msg.id}
              text={msg.text}
              isMe={msg.isMe}
              timestamp={msg.timestamp}
              showTimestamp={showTime}
              details={msg.details}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 safe-area-bottom z-50">
        <div className="flex items-center px-3 py-2 min-h-[55px]">
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
