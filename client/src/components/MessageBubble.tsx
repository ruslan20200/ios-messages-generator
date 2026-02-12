// MODIFIED BY AI: 2026-02-12 - tune bubble proportions to match native iMessage scale on mobile
// FILE: client/src/components/MessageBubble.tsx

import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { motion } from "framer-motion";

interface MessageBubbleProps {
  text: string;
  isMe: boolean;
  timestamp: Date;
  showTimestamp?: boolean;
  details?: {
    link: string;
  };
}

export function MessageBubble({
  text,
  isMe,
  timestamp,
  showTimestamp,
  details,
}: MessageBubbleProps) {
  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return `Сегодня ${format(date, "HH:mm")}`;
    }
    if (isYesterday(date)) {
      return `Вчера ${format(date, "HH:mm")}`;
    }
    return format(date, "dd/MM HH:mm");
  };

  const trimmedText = text.trim();
  const codeLength = trimmedText.length;
  const isSentCode = isMe && /^\d+$/.test(trimmedText) && codeLength <= 8;
  const sentCodeSizeClass =
    codeLength <= 5
      ? "text-[clamp(15px,4.8vw,18px)]"
      : codeLength <= 6
        ? "text-[clamp(14px,4.5vw,17px)]"
        : "text-[clamp(13px,4.2vw,16px)]";

  const renderText = (content: string) => {
    if (!details) return content;

    return content.split("\n").map((line, index) => {
      if (line.includes("http")) {
        return (
          <a
            key={index}
            href={details.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ios-blue underline decoration-ios-blue cursor-pointer"
          >
            {line}
          </a>
        );
      }
      return <div key={index}>{line}</div>;
    });
  };

  return (
    <div className="mb-2 flex w-full flex-col">
      {showTimestamp && (
        <div className="my-1.5 text-center text-[11px] font-medium text-[#8E8E93]">
          {formatMessageTime(timestamp)}
        </div>
      )}

      <div className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative break-words shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
            isSentCode
              ? "max-w-[40%] px-2.5 py-1.25"
              : isMe
                ? "max-w-[54%] px-3 py-1.75"
                : "max-w-[52%] px-3 py-1.75",
            isMe
              ? "rounded-[22px] rounded-br-[10px] bg-[#32d957] text-[#eef7ef]"
              : "rounded-[22px] rounded-bl-[10px] bg-[#2a2b34] text-[#f1f2f6]",
            isSentCode
              ? cn("leading-[1.04] font-medium tracking-[0.005em]", sentCodeSizeClass)
              : isMe
                ? "text-[clamp(13px,3.9vw,15px)] leading-[1.22]"
                : "text-[clamp(15px,4.4vw,17px)] leading-[1.24]",
          )}
        >
          <div
            className={cn(
              isMe && "underline decoration-2 underline-offset-[3px] decoration-[#eaf4ec]",
            )}
          >
            {renderText(text)}
          </div>

          <svg
            viewBox="0 0 18 14"
            className={cn(
              "pointer-events-none absolute -bottom-[1px] h-[12px] w-[14px]",
              isMe ? "-right-[5px]" : "-left-[6px] -scale-x-100",
            )}
            style={{ color: isMe ? "#32d957" : "#2a2b34" }}
            aria-hidden
          >
            <path
              d="M1 1 C7 1 12 4 14 8 C15.5 11 16.5 12.5 17.8 13 H1 Z"
              fill="currentColor"
            />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
