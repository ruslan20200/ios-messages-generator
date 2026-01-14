import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";

interface MessageBubbleProps {
  text: string;
  isMe: boolean;
  timestamp: Date;
  showTimestamp?: boolean;
  details?: {
    link: string;
  };
}

export function MessageBubble({ text, isMe, timestamp, showTimestamp, details }: MessageBubbleProps) {
  
  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return `Сегодня ${format(date, "HH:mm")}`;
    }
    if (isYesterday(date)) {
      return `Вчера ${format(date, "HH:mm")}`;
    }
    return format(date, "dd/MM HH:mm"); // Simplified for older messages
  };

  // Function to parse text and render links if needed
  const renderText = (content: string) => {
    if (!details) return content;

    // Split by newlines to handle formatting
    return content.split('\n').map((line, i) => {
      if (line.includes("http")) {
        return (
          <a 
            key={i} 
            href={details.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-ios-blue underline decoration-ios-blue cursor-pointer"
          >
            {line}
          </a>
        );
      }
      return <div key={i}>{line}</div>;
    });
  };

  return (
    <div className="flex flex-col w-full mb-2">
      {showTimestamp && (
        <div className="text-center text-[#8E8E93] text-[14px] font-medium my-3">
          {formatMessageTime(timestamp)}
        </div>
      )}
      
      <div className={cn(
        "flex w-full",
        isMe ? "justify-end" : "justify-start"
      )}>
        <div className={cn(
          "max-w-[75%] px-[12px] py-[8px] text-[19px] leading-[24px] relative break-words",
          isMe 
            ? "bg-ios-green/95 text-white rounded-[18px] rounded-tr-[4px]" 
            : "bg-[#262628]/90 text-white rounded-[18px] rounded-tl-[4px]"
        )}>
          {renderText(text)}
          
          {/* Tail SVG for extra realism - optional, using CSS radius for now is cleaner for PWA */}
        </div>
      </div>
    </div>
  );
}
