import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import MessageList from "@/components/message/MessageList";

export default function InboxPage() {
  const { user } = useAuth();
  
  // If user is not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="w-full flex flex-col pt-4">
      <h1 className="text-2xl font-mono font-bold mb-8 text-glow uppercase tracking-widest border-b border-primary/20 pb-4 inline-block">
        &gt; RECEIVED_PAYLOADS
      </h1>
      <MessageList />
    </div>
  );
}
