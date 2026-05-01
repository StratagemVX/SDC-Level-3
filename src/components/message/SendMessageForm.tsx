
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useMessages } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import { FormContainer } from "@/components/ui/form-container";
import { useToast } from "@/hooks/use-toast";

export default function SendMessageForm() {
  const [receiverId, setReceiverId] = useState("");
  const [message, setMessage] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  
  const { sendMessage } = useMessages();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!receiverId || !message || !secretKey) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (receiverId === user?.userId) {
      toast({
        title: "Invalid receiver",
        description: "Loopback connection rejected. Cannot send to self.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await sendMessage(receiverId, { kind: "text", text: message }, secretKey, ttlMinutes);
      toast({
        title: "Payload Transmitted",
        description: `Encrypted payload is live. Auto-destruct set to ${ttlMinutes} mins.`,
      });
      
      // Clear form
      setReceiverId("");
      setMessage("");
      setSecretKey("");
      setTtlMinutes(30);
    } catch (error) {
      toast({
        title: "Transmission Failed",
        description: "Connection dropped. Payload could not be sent.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormContainer 
      title="TRANSMIT_PAYLOAD" 
      subtitle="Establish secure link and send encrypted data"
    >
      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        <div className="space-y-2">
          <label htmlFor="receiverId" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
            &gt; Target_Agent_ID
          </label>
          <Input
            id="receiverId"
            placeholder="Enter Target ID..."
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            disabled={isLoading}
            className="font-mono bg-black/40 border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-muted-foreground rounded-none h-12"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="message" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
            &gt; Payload_Data
          </label>
          <Textarea
            id="message"
            placeholder="Construct secure message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isLoading}
            className="font-mono bg-black/40 border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-muted-foreground rounded-none min-h-[120px] resize-none"
          />
        </div>
        
        <div className="space-y-2">
          <label htmlFor="secretKey" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
            &gt; Cipher_Key
          </label>
          <Input
            id="secretKey"
            type="password"
            placeholder="********"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            disabled={isLoading}
            className="font-mono bg-black/40 border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-muted-foreground rounded-none h-12"
          />
          <p className="text-xs text-muted-foreground font-mono mt-1">
            // Must match target's decryption key
          </p>
        </div>
        
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center border-t border-primary/20 pt-4">
            <label htmlFor="ttl" className="text-xs font-bold font-mono tracking-widest uppercase text-muted-foreground">
              &gt; TTL_Timer
            </label>
            <span className="text-primary font-mono font-bold text-lg text-glow">
              {ttlMinutes} MIN
            </span>
          </div>
          <Slider
            id="ttl"
            value={[ttlMinutes]}
            min={1}
            max={60}
            step={1}
            onValueChange={(value) => setTtlMinutes(value[0])}
            disabled={isLoading}
            className="cursor-pointer"
          />
        </div>
        
        <Button
          type="submit"
          className="w-full btn-cyber rounded-none h-14 mt-4 text-lg"
          disabled={isLoading}
        >
          {isLoading ? "ENCRYPTING..." : "INITIATE_TRANSMISSION"}
        </Button>
      </form>
    </FormContainer>
  );
}
