
import React, { useState, useEffect } from "react";
import { useMessages, Message } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import MessageCard from "./MessageCard";

export default function MessageList() {
  const { getReceivedMessages } = useMessages();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (user) {
      const fetchMessages = () => {
        const receivedMessages = getReceivedMessages(user.userId);
        setMessages(receivedMessages);
      };
      
      fetchMessages();
      
      // Set interval to refresh messages
      const interval = setInterval(fetchMessages, 10000);
      return () => clearInterval(interval);
    }
  }, [user, getReceivedMessages]);

  if (!messages.length) {
    return (
      <div className="p-8 text-center glass-panel w-full border-dashed border-2 border-primary/20">
        <p className="text-primary/60 font-mono text-sm tracking-widest uppercase">
          &gt; NO_DATA_FOUND. INBOX_EMPTY.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 message-container w-full">
      {messages.map((message) => (
        <MessageCard key={message.id} message={message} />
      ))}
    </div>
  );
}
