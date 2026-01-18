import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatHeaderProps {
  title: string;
  subTitle?: string;
  badge?: React.ReactNode;
}

export function ChatHeader({ title, subTitle, badge }: ChatHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 safe-area-top">
      <div className="h-[44px] flex items-center justify-between px-2 w-full max-w-md mx-auto">
        <Link href="/" className="flex items-center active:opacity-50 transition-opacity ">
          <div className="w-13 h-13 rounded-full  flex items-center justify-center ios-blur border border-white/20 mt-10 ml-2 pr-1">
            <ChevronLeft size={37 } strokeWidth={3} className="text-white" />
          </div>
        </Link>

        <div className="flex flex-col items-center justify-center flex-1 mr-8">
          <div className="flex flex-col items-center mt-18">
             <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#423C58] to-[#423C58] flex items-center justify-center -mb-1 overflow-hidden">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14  text-white">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
             </div>
               <div className="flex items-center gap-2 rounded-full px-3 py-1 ios-blur border border-white/20">
                 <span className="text-[20px] font-bold text-white leading-none">
                   {title}
                 </span>
                 {badge}
                 {subTitle && (
                   <span className="text-gray-300 text-[14px] leading-none px-2 py-0.5 bg-white/10 rounded-full">
                     {subTitle}
                   </span>
                 )}
               </div>
          </div>
        </div>
        
        {/* Placeholder for right side balance */}
        <div className="w-8"></div>
      </div>
    </header>
  );
}
