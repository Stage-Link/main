"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChatPanel } from "./chat-panel";
import { MessageCircle, Radio } from "lucide-react";

export interface ChatMessage {
  text: string;
  sender: string;
  senderId?: string;
  timestamp: string;
}

interface CrewChatPanelProps {
  displayName: string;
  globalMessages: ChatMessage[];
  onGlobalSend: (text: string) => void;
  streamMessages?: ChatMessage[];
  onStreamSend?: (text: string) => void;
  streamName?: string;
  globalConnected?: boolean;
  streamConnected?: boolean;
}

export function CrewChatPanel({
  displayName,
  globalMessages,
  onGlobalSend,
  streamMessages = [],
  onStreamSend,
  streamName,
  globalConnected,
  streamConnected,
}: CrewChatPanelProps) {
  const [activeTab, setActiveTab] = useState<"global" | "stream">("global");

  const hasStreamChat = streamName != null && onStreamSend != null;

  if (!hasStreamChat) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-gold" />
          <h3 className="text-xs font-semibold text-foreground">Global Chat</h3>
          {globalConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          )}
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel
            messages={globalMessages}
            displayName={displayName}
            onSendMessage={onGlobalSend}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "global" | "stream")}
        className="flex flex-col h-full"
      >
        <div className="px-2 pt-2 pb-1 border-b border-border shrink-0">
          <TabsList variant="default" className="w-full h-8">
            <TabsTrigger value="global" className="flex-1 gap-1.5 text-xs">
              <MessageCircle className="h-3 w-3" />
              Global
              {globalConnected && (
                <span className="w-1 h-1 rounded-full bg-green-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="stream" className="flex-1 gap-1.5 text-xs">
              <Radio className="h-3 w-3" />
              {streamName}
              {streamConnected && (
                <span className="w-1 h-1 rounded-full bg-green-500" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="global" className="h-full m-0 data-[state=inactive]:hidden">
            <ChatPanel
              messages={globalMessages}
              displayName={displayName}
              onSendMessage={onGlobalSend}
            />
          </TabsContent>
          <TabsContent value="stream" className="h-full m-0 data-[state=inactive]:hidden">
            <ChatPanel
              messages={streamMessages}
              displayName={displayName}
              onSendMessage={onStreamSend!}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
