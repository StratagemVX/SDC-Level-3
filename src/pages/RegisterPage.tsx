
import React from "react";
import { Navigate } from "react-router-dom";
import RegisterForm from "@/components/auth/RegisterForm";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const { user } = useAuth();
  
  // If user is already logged in, redirect to inbox
  if (user) {
    return <Navigate to="/inbox" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-[75vh]">
      <RegisterForm />
    </div>
  );
}
