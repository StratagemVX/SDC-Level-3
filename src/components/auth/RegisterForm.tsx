
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { FormContainer } from "@/components/ui/form-container";
import { useToast } from "@/hooks/use-toast";

export default function RegisterForm() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, error } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !password || !confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passphrases do not match. Aborting.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await register(userId, password);
      toast({
        title: "Key Generated",
        description: "Your operative account has been deployed.",
      });
      navigate("/login");
    } catch (err) {
      toast({
        title: "Registration failed",
        description: error || "Agent ID already exists in node.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormContainer title="INIT_OPERATIVE" subtitle="Register a new alias for secure comms">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="userId" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
            &gt; Agent_ID
          </label>
          <Input
            id="userId"
            type="text"
            placeholder="Choose Alias..."
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
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
            &gt; Confirm_Passphrase
          </label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="********"
            className="font-mono bg-black/40 border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-muted-foreground rounded-none h-12"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <Button
          type="submit"
          className="w-full btn-cyber rounded-none h-12 mt-4"
          disabled={isLoading}
        >
          {isLoading ? "GENERATING_KEYS..." : "REGISTER_NEW"}
        </Button>
        <div className="text-center mt-6">
          <p className="text-xs font-mono text-muted-foreground">
            Known operative?{" "}
            <Button 
              variant="link" 
              className="p-0 text-cyan-400 hover:text-cyan-300 font-bold" 
              onClick={() => navigate("/login")}
            >
              [ INITIATE_LOGIN ]
            </Button>
          </p>
        </div>
      </form>
    </FormContainer>
  );
}
