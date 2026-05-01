
import React from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "@/components/auth/LoginForm";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user } = useAuth();
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-[75vh]">
      <LoginForm />
    </div>
  );
}
