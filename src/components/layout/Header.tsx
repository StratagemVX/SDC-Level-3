
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="py-4 px-6 glass-panel sticky top-0 z-50 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="cursor-pointer" onClick={() => navigate("/")}>
          <h1 className="text-2xl font-bold text-glow uppercase tracking-wider font-mono">
            &gt;_ShadowCipher
          </h1>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-primary font-mono hidden md:inline-block">
              [AUTHED: <span className="font-bold text-glow-cyan">{user.userId}</span>]
            </span>
            
            <div className="flex gap-3">
              <Button className="btn-cyber rounded-none" variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                Dashboard
              </Button>
              <Button className="btn-cyber border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-none" variant="outline" size="sm" onClick={handleLogout}>
                DISCONNECT
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button className="btn-cyber rounded-none" variant="outline" size="sm" onClick={() => navigate("/login")}>
              Login
            </Button>
            <Button className="btn-cyber rounded-none" variant="outline" size="sm" onClick={() => navigate("/register")}>
              Register
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
