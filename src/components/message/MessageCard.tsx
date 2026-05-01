
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message, useMessages } from "@/context/MessageContext";
import { 
  base64ToBlob,
  detectFileCategory,
  decryptMessage, 
  decryptFilePayload,
  formatFileSize,
  hashSecretKey, 
  generateFakeMessage, 
  calculateRemainingTime 
} from "@/utils/encryption";
import { useToast } from "@/hooks/use-toast";

interface MessageCardProps {
  message: Message;
}

const MessageCard = React.memo(function MessageCard({ message }: MessageCardProps) {
  const messageType = message.type || "text";
  const displayCategory = messageType === "file" ? detectFileCategory(message.fileType, message.fileName) : messageType;
  const [secretKey, setSecretKey] = useState("");
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [decryptedFileUrl, setDecryptedFileUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showingFake, setShowingFake] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>(
    calculateRemainingTime(message.expiryTime)
  );
  const [timeLeftSec, setTimeLeftSec] = useState<number>(Math.max(0, Math.floor((message.expiryTime - Date.now()) / 1000)));
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const decryptErrorTimerRef = useRef<number | null>(null);
  const lowerFileName = message.fileName?.toLowerCase() || "";
  const fileIcon = displayCategory === "archive"
    ? "🗜️"
    : lowerFileName.endsWith(".pdf")
    ? "📕"
    : lowerFileName.endsWith(".ppt") || lowerFileName.endsWith(".pptx")
    ? "📽️"
    : lowerFileName.endsWith(".xls") || lowerFileName.endsWith(".xlsx")
    ? "📊"
    : lowerFileName.endsWith(".doc") || lowerFileName.endsWith(".docx")
    ? "📃"
    : "📦";
  const fileIconClass = displayCategory === "archive"
    ? "text-amber-300"
    : lowerFileName.endsWith(".pdf")
    ? "text-red-400"
    : lowerFileName.endsWith(".doc") || lowerFileName.endsWith(".docx")
    ? "text-blue-400"
    : "text-primary";
  
  const { deleteMessage } = useMessages();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      const timeLeft = calculateRemainingTime(message.expiryTime);
      setRemainingTime(timeLeft);
      setTimeLeftSec(Math.max(0, Math.floor((message.expiryTime - Date.now()) / 1000)));
      
      if (timeLeft === "Expired") {
        deleteMessage(message.id);
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [message.expiryTime, message.id, deleteMessage]);

  useEffect(() => {
    return () => {
      if (decryptedFileUrl) URL.revokeObjectURL(decryptedFileUrl);
      if (decryptErrorTimerRef.current) window.clearTimeout(decryptErrorTimerRef.current);
    };
  }, [decryptedFileUrl]);

  const showDecryptError = (message: string) => {
    setDecryptError(message);
    if (decryptErrorTimerRef.current) window.clearTimeout(decryptErrorTimerRef.current);
    decryptErrorTimerRef.current = window.setTimeout(() => setDecryptError(null), 3000);
  };

  const handleDecrypt = () => {
    if (!secretKey) {
      toast({
        title: "Secret key required",
        description: "Please enter the secret key to decrypt this message",
        variant: "destructive",
      });
      return;
    }

    setIsDecrypting(true);
    
    try {
      // Verify the secret key hash
      const keyHash = hashSecretKey(secretKey);
      const isKeyCorrect = keyHash === message.secretKeyHash;
      
      if (isKeyCorrect) {
        setShowingFake(false);
        setDecryptError(null);
        if (messageType === "text") {
          const decrypted = decryptMessage(message.encryptedContent, secretKey);
          setDecryptedText(decrypted);
          setDecryptedFileUrl(null);
        } else {
          const decryptedBase64 = decryptFilePayload(message.encryptedContent, secretKey);
          const blob = base64ToBlob(decryptedBase64, message.fileType || "application/octet-stream");
          const url = URL.createObjectURL(blob);
          if (decryptedFileUrl) URL.revokeObjectURL(decryptedFileUrl);
          setDecryptedFileUrl(url);
          setDecryptedText(null);
        }
        toast({
          title: "Message decrypted",
          description: "The payload has been successfully decrypted.",
        });
      } else {
        // Show fake message for security
        setShowingFake(true);
        setDecryptedText(generateFakeMessage());
        setDecryptedFileUrl(null);
        showDecryptError("Wrong decryption key.");
        toast({
          title: "Message decrypted",
          description: "The payload has been successfully decrypted.",
        });
      }
    } catch (error) {
      // Also show fake message on error
      setShowingFake(true);
      setDecryptedText(generateFakeMessage());
      setDecryptedFileUrl(null);
      showDecryptError("Wrong decryption key.");
      toast({
        title: "Message decrypted", 
        description: "The payload has been successfully decrypted.",
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDelete = () => {
    deleteMessage(message.id);
    toast({
      title: "Payload Incinerated",
      description: "The encrypted file has been permanently deleted from local cache",
    });
  };

  const handleLinkOpen = () => {
    if (!decryptedText && !decryptedFileUrl) {
      handleDecrypt();
      return;
    }
    if (decryptedFileUrl) {
      window.open(decryptedFileUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="glass-panel w-full p-0 flex flex-col rounded-none relative border border-primary/20 hover:border-primary/50 transition-colors">
      <div className="bg-primary/10 border-b border-primary/20 p-4 flex flex-col md:flex-row justify-between md:items-center gap-2">
        <div>
          <h3 className="text-lg font-mono font-bold text-glow uppercase tracking-widest break-all">
            PAYLOAD_ID: {message.id.slice(0,8)}...
          </h3>
          <p className="text-xs font-mono text-muted-foreground mt-1 uppercase">
            SENDER: <span className="text-primary">{message.senderId}</span> | 
            TIMESTAMP: {new Date(message.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-muted-foreground uppercase">TTL_COUNTDOWN</p>
          <div
            className={`font-mono text-xl font-bold tracking-widest ${remainingTime === "Expired" || timeLeftSec <= 5 ? "text-destructive" : timeLeftSec <= 30 ? "text-yellow-400" : "text-glow"} ${timeLeftSec <= 5 && remainingTime !== "Expired" ? "animate-pulse" : ""}`}
          >
            {remainingTime}
          </div>
        </div>
      </div>
      
      <div className="p-6 flex-1">
        {!decryptedText && !decryptedFileUrl ? (
            <div className="space-y-4">
            <p className="text-primary/70 font-mono text-sm uppercase tracking-wide">
              &gt; This payload is SECURED. Enter cipher key to access contents.
            </p>
            
            <div className="space-y-2 flex gap-4 w-full md:max-w-lg">
              <Input
                type="password"
                placeholder="********"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                disabled={isDecrypting}
                className="font-mono bg-black/40 border-primary/30 focus-visible:ring-primary focus-visible:border-primary text-primary placeholder:text-primary/30 rounded-none h-12 flex-1"
              />
              <Button 
                onClick={handleDecrypt}
                disabled={isDecrypting || !secretKey}
                className="btn-cyber rounded-none h-12 px-8"
              >
                {isDecrypting ? "DECODING..." : "DECRYPT"}
              </Button>
            </div>
            {decryptError && (
              <div className="text-xs font-mono text-destructive">
                {decryptError}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-primary/30 p-6 bg-black/60 relative group">
            {showingFake && (
              <div className="absolute top-0 right-0 bg-primary/20 text-primary text-[10px] px-2 py-1 font-mono uppercase">
                SUCCESS
              </div>
            )}
            <div className="font-mono text-primary text-sm whitespace-pre-wrap leading-relaxed select-text">
              <span className="text-muted-foreground">&gt; DECIPHERED_CONTENT:</span><br/><br/>
              {decryptedText && (
                <span>{decryptedText}</span>
              )}
              {!decryptedText && decryptedFileUrl && (
                <div className="space-y-3">
                  {displayCategory === "image" && (
                    <img
                      src={decryptedFileUrl}
                      alt={message.fileName || "decrypted image"}
                      loading="lazy"
                      className="max-h-80 w-auto border border-primary/30"
                    />
                  )}
                  {displayCategory === "video" && (
                    <video
                      src={decryptedFileUrl}
                      controls
                      preload="none"
                      className="max-h-80 w-full border border-primary/30"
                    />
                  )}
                  {displayCategory === "audio" && (
                    <audio
                      src={decryptedFileUrl}
                      controls
                      preload="none"
                      className="w-full"
                    />
                  )}
                  {(displayCategory === "file" || displayCategory === "document" || displayCategory === "archive") && (
                    <div className="flex items-center justify-between border border-primary/30 p-3 bg-black/40 hover:shadow-[0_0_15px_rgba(0,255,100,0.3)] transition-all">
                      <div className="flex items-center gap-4">
                        <span className={`${fileIconClass} text-2xl`}>{fileIcon}</span>
                        <div className="flex flex-col">
                          <div className="text-primary font-mono text-sm break-all">
                            {message.fileName || "encrypted_payload"}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {formatFileSize(message.fileSize || 0)}
                          </div>
                        </div>
                      </div>
                      <a
                        href={decryptedFileUrl}
                        download={message.fileName || "payload"}
                        className="btn-cyber rounded-none px-4 py-2 text-xs active:scale-95 transition-all"
                        style={{ pointerEvents: 'auto', zIndex: 10 }}
                      >
                        DOWNLOAD
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-black/40 border-t border-primary/10 p-4 flex justify-end gap-4 relative z-10 pointer-events-auto">
        <Button
          variant="outline"
          onClick={handleLinkOpen}
          className={`btn-cyber rounded-none active:scale-95 transition-all ${decryptedText || decryptedFileUrl ? "" : "opacity-80"}`}
          style={{ pointerEvents: 'auto', zIndex: 10 }}
        >
          LINK_OPEN
        </Button>
        
        <Button
          variant="destructive"
          onClick={handleDelete}
          className="rounded-none border border-destructive bg-transparent hover:bg-destructive font-mono uppercase tracking-widest text-destructive hover:text-white active:scale-95 transition-all"
          style={{ pointerEvents: 'auto', zIndex: 10 }}
        >
          INCINERATE
        </Button>
      </div>
    </div>
  );
});

export default MessageCard;
