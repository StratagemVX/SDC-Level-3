
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { encryptMessage, encryptFilePayload, hashSecretKey, sanitizeFileName } from "../utils/encryption";
import { useAuth } from "./AuthContext";

export type MessageType = "text" | "image" | "video" | "audio" | "file";
export type SendStage = "compressing" | "encrypting" | "transmitting";

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  type: MessageType;
  encryptedContent: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  secretKeyHash: string;
  expiryTime: number;
  createdAt: number;
}

type SendPayload =
  | { kind: "text"; text: string }
  | { kind: "file"; file: File };

interface MessageContextType {
  messages: Message[];
  users: string[];
  onlineUsers: Set<string>;
  typingUsers: Set<string>;
  sendMessage: (
    receiverId: string,
    payload: SendPayload,
    secretKey: string,
    ttlMinutes: number,
    onStage?: (stage: SendStage) => void
  ) => Promise<void>;
  sendTyping: (receiverId: string) => void;
  sendStopTyping: (receiverId: string) => void;
  deleteMessage: (messageId: string) => Promise<void>;
  messagesLoading: boolean;
  refreshMessages: () => Promise<void>;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessages must be used within a MessageProvider");
  }
  return context;
};

interface MessageProviderProps {
  children: ReactNode;
}

export const MessageProvider: React.FC<MessageProviderProps> = ({ children }) => {
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  const refreshMessages = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const res = await fetch(`/api/messages/${user.userId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUsers();
      refreshMessages();
      setMessagesLoading(false);

      // Use current origin so Vite proxy can handle socket.io and API requests over HTTPS
      const socket = io("/", { transports: ["websocket"], reconnection: true });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("register", { userId: user.userId });
      });

      socket.on("presence_update", ({ onlineUsers: online }) => {
        const onlineSet = new Set(online || []);
        setOnlineUsers(onlineSet);
        setTypingUsers(prev => {
          const next = new Set(Array.from(prev).filter((id) => onlineSet.has(id)));
          return next;
        });
      });

      socket.on("receive_message", (message: Message) => {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message].sort((a, b) => a.createdAt - b.createdAt);
        });
      });

      socket.on("typing", ({ fromUserId }) => {
        setTypingUsers(prev => new Set(prev).add(fromUserId));
      });

      socket.on("stop_typing", ({ fromUserId }) => {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(fromUserId);
          return next;
        });
      });

      socket.on("disconnect", () => {
        setOnlineUsers(new Set());
      });

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [user, refreshMessages]);

  const sendMessage = async (
    receiverId: string,
    payload: SendPayload,
    secretKey: string,
    ttlMinutes: number,
    onStage?: (stage: SendStage) => void
  ) => {
    if (!user) return;
    const secretKeyHash = hashSecretKey(secretKey);
    let encryptedContent = "";
    let type: MessageType = "text";
    let fileName: string | undefined;
    let fileType: string | undefined;
    let fileSize: number | undefined;

    if (payload.kind === "text") {
      onStage?.("encrypting");
      encryptedContent = encryptMessage(payload.text, secretKey);
    } else {
      const { file } = payload;
      onStage?.("encrypting");
      encryptedContent = await encryptFilePayload(file, secretKey);
      fileName = sanitizeFileName(file.name);
      fileType = file.type || "application/octet-stream";
      fileSize = file.size;

      if (fileType.startsWith("image/")) type = "image";
      else if (fileType.startsWith("video/")) type = "video";
      else if (fileType.startsWith("audio/")) type = "audio";
      else type = "file";
    }
    
    onStage?.("transmitting");
    const socket = socketRef.current;
    if (socket && socket.connected) {
      await new Promise<void>((resolve, reject) => {
        socket.emit(
          "send_message",
          {
            senderId: user.userId,
            receiverId,
            type,
            encryptedContent,
            fileName,
            fileType,
            fileSize,
            secretKeyHash,
            ttlMinutes
          },
          (response: { ok: boolean; error?: string }) => {
            if (!response?.ok) {
              reject(new Error(response?.error || "Socket send failed"));
              return;
            }
            resolve();
          }
        );
      });
    } else {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.userId,
          receiverId,
          type,
          encryptedContent,
          fileName,
          fileType,
          fileSize,
          secretKeyHash,
          ttlMinutes
        })
      });
      await refreshMessages();
    }
  };

  const sendTyping = (receiverId: string) => {
    if (!user) return;
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("typing", { fromUserId: user.userId, toUserId: receiverId });
    }
  };

  const sendStopTyping = (receiverId: string) => {
    if (!user) return;
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("stop_typing", { fromUserId: user.userId, toUserId: receiverId });
    }
  };

  const deleteMessage = async (messageId: string) => {
    await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const value = {
    messages,
    users,
    onlineUsers,
    typingUsers,
    sendMessage,
    sendTyping,
    sendStopTyping,
    deleteMessage,
    messagesLoading,
    refreshMessages
  };

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
};
