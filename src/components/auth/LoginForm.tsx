
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { FormContainer } from "@/components/ui/form-container";
import { useToast } from "@/hooks/use-toast";

export default function LoginForm() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(userId, password);
      toast({
        title: "Protocol Accepted",
        description: "Authentication successful. Channel secured.",
      });
      navigate("/dashboard");
    } catch (err) {
      toast({
        title: "Access Denied",
        description: error || "Invalid credentials detected.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormContainer title="AUTH_PROTOCOL" subtitle="Enter credentials to initialize secure handshake">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="userId" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
            &gt; Agent_ID
          </label>
          <Input
            id="userId"
            type="text"
            placeholder="Enter ID..."
            className="font-mono bg-black/40 border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-muted-foreground rounded-none h-12"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
            &gt; Passphrase
          </label>
          <Input
            id="password"
            type="password"
            placeholder="********"
            className="font-mono bg-black/40 border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-muted-foreground rounded-none h-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <Button
          type="submit"
          className="w-full btn-cyber rounded-none h-12 mt-4"
          disabled={isLoading}
        >
          {isLoading ? "VERIFYING..." : "EXECUTE"}
        </Button>
        <div className="text-center mt-6">
          <p className="text-xs font-mono text-muted-foreground">
            New operative?{" "}
            <Button 
              variant="link" 
              className="p-0 text-cyan-400 hover:text-cyan-300 font-bold" 
              onClick={() => navigate("/register")}
            >
              [ REGISTER_NEW_KEY ]
            </Button>
          </p>
        </div>
      </form>
    </FormContainer>
  );
}
