"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  text: string;
  sender: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  displayName: string;
  onSendMessage: (text: string) => void;
}

function getNameColor(sender: string, index: number): string {
  const lower = sender.toLowerCase();
  if (lower.includes("sm") || lower.includes("stage") || lower.includes("lx") || lower.includes("light")) {
    return "text-gold";
  }
  if (lower.includes("audio") || lower.includes("host") || lower.includes("fx")) {
    return "text-crimson";
  }
  return index % 2 === 0 ? "text-gold" : "text-crimson";
}

const messageSlide = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
};

export function ChatPanel({
  messages,
  displayName,
  onSendMessage,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const text = inputRef.current?.value.trim();
    if (text) {
      onSendMessage(text);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-grow" ref={scrollRef}>
        <div className="space-y-2.5 p-3">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const time = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <motion.div
                  key={`${msg.timestamp}-${i}`}
                  variants={messageSlide}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="text-[11px] leading-relaxed"
                >
                  <span className={`font-medium ${getNameColor(msg.sender, i)}`}>
                    {msg.sender}
                  </span>
                  <span className="text-muted-foreground font-normal"> ({time})</span>
                  <p className="text-foreground/60 mt-0.5">{msg.text}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t border-border shrink-0">
        <div className="flex gap-1.5">
          <Input
            ref={inputRef}
            placeholder={`Message as ${displayName || "..."}`}
            onKeyDown={handleKeyPress}
            className="h-7 text-[10px] bg-white/5 border-white/10 placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-gold hover:bg-gold/10 transition-colors cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/60 mt-1">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
