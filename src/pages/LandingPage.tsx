
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const fullText = "Transmit heavily encrypted data payloads across untrusted networks. Payloads auto-destruct to ensure absolute silence.";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, index));
      index++;
      if (index > fullText.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-2">
      <div className="max-w-3xl w-full z-10 relative">
        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full -z-10"></div>
        
        <h1 className="text-4xl sm:text-6xl font-bold mb-6 text-glow font-mono uppercase tracking-widest break-words leading-tight">
          System.Ops.
          <br />
          <span className="text-glow-cyan">Shadow_Cipher</span>
        </h1>
        
        <div className="h-20 mb-8 max-w-xl mx-auto flex items-center justify-center font-mono text-muted-foreground">
          <p className="text-lg">
            &gt; {text}
            <span className="typing-cursor"></span>
          </p>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 max-w-md mx-auto mb-16">
          <Button 
            size="lg" 
            className="btn-cyber rounded-none h-14 text-lg"
            onClick={() => navigate("/register")}
          >
            INITIALIZE_LINK
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="btn-cyber rounded-none h-14 text-lg"
            onClick={() => navigate("/login")}
          >
            AUTH_LOGIN
          </Button>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3 mt-8">
          <div className="glass-panel p-6 rounded-sm text-left border-l-2 border-l-primary hover:border-l-primary/100">
            <h2 className="text-lg font-bold mb-3 font-mono text-glow flex items-center">
              <span className="text-primary mr-2">01.</span> ENCRYPTION
            </h2>
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">
              Military-grade AES-256 local client-side ciphering. Server acts only as an ignorant relay node.
            </p>
          </div>
          
          <div className="glass-panel p-6 rounded-sm text-left border-l-2 border-l-cyan-400 hover:border-l-cyan-400/100">
            <h2 className="text-lg font-bold mb-3 font-mono text-glow-cyan flex items-center">
              <span className="text-cyan-400 mr-2">02.</span> EPHEMERAL
            </h2>
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">
              Payloads hold TTL (Time-To-Live). Instant digital incineration upon decryption sequence completion.
            </p>
          </div>
          
          <div className="glass-panel p-6 rounded-sm text-left border-l-2 border-l-white hover:border-l-white/100">
            <h2 className="text-lg font-bold mb-3 font-mono text-white text-shadow flex items-center">
              <span className="text-white mr-2">03.</span> ZERO_TRUST
            </h2>
            <p className="text-sm text-muted-foreground font-mono leading-relaxed">
              No keys are ever stored. Your local device is the only decipher terminal. Trust nothing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
