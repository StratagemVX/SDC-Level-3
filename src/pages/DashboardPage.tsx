import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMessages } from "@/context/MessageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import MessageCard from "@/components/message/MessageCard";
import { useToast } from "@/hooks/use-toast";
import { compressImageFile, detectFileCategory, formatFileSize } from "@/utils/encryption";
import { CameraModal } from "@/components/message/CameraModal";
import { VoiceRecorderUI } from "@/components/message/VoiceRecorderUI";
import { InlineError } from "@/components/message/InlineError";

export default function DashboardPage() {
  const { user } = useAuth();
  const { users, messages, sendMessage, onlineUsers, typingUsers, sendTyping, sendStopTyping } = useMessages();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [payloadText, setPayloadText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState(30);
  const [isSending, setIsSending] = useState(false);
  const [sendStage, setSendStage] = useState<"idle" | "compressing" | "encrypting" | "transmitting">("idle");
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const dragTimerRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const previewCategory = useMemo(
    () => (selectedFile ? detectFileCategory(selectedFile.type, selectedFile.name) : null),
    [selectedFile]
  );

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      if (dragTimerRef.current) window.clearTimeout(dragTimerRef.current);
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    };
  }, [mediaStream]);

  useEffect(() => {
    if (selectedContact) {
      sendStopTyping(selectedContact);
    }
  }, [selectedContact, sendStopTyping]);

  useEffect(() => {
    if (!selectedFile || (previewCategory !== "image" && previewCategory !== "video")) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile, previewCategory]);

  const maxFileSizeBytes = 10 * 1024 * 1024;
  const enableImageCompression = true;
  const imageCompressionOptions = { maxWidth: 1600, maxHeight: 1600, quality: 0.8 };
  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-7z-compressed",
    "application/vnd.rar",
    "text/plain",
    "text/csv",
    "application/json",
    "application/rtf"
  ]);
  const allowedExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".7z", ".rar", ".txt", ".rtf", ".csv", ".json", ".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm", ".mov", ".avi", ".mkv", ".jpg", ".jpeg", ".png", ".gif", ".webp"];

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Derive visible contacts from actual message history to keep things hidden
  const recentContactsSet = new Set<string>();
  messages.forEach(m => {
    if (m.senderId === user.userId && m.receiverId !== user.userId) recentContactsSet.add(m.receiverId);
    if (m.receiverId === user.userId && m.senderId !== user.userId) recentContactsSet.add(m.senderId);
  });
  
  if (selectedContact) recentContactsSet.add(selectedContact);
  const visibleContacts = Array.from(recentContactsSet);

  const currentChatMsgs = useMemo(() => {
    return messages
      .filter(m => 
        (m.senderId === user.userId && m.receiverId === selectedContact) || 
        (m.senderId === selectedContact && m.receiverId === user.userId)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, selectedContact, user.userId]);

  useEffect(() => {
    if (!chatScrollRef.current || !chatEndRef.current) return;
    if (isNearBottom) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      setHasNewMessages(false);
    } else {
      setHasNewMessages(true);
    }
  }, [currentChatMsgs.length, isNearBottom]);

  const handleScroll = () => {
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const container = chatScrollRef.current;
      if (!container) return;
      const threshold = 120;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const nearBottom = distanceFromBottom < threshold;
      setIsNearBottom(nearBottom);
      if (nearBottom) setHasNewMessages(false);
    }, 60);
  };

  const handleScrollToLatest = () => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    setHasNewMessages(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    if (searchQuery === user.userId) {
      toast({ title: "Loopback Error", description: "Cannot establish connection to self.", variant: "destructive" });
      return;
    }
    
    if (users.includes(searchQuery)) {
      setSelectedContact(searchQuery);
      setSearchQuery("");
      toast({ title: "Agent Found", description: `Secure link with ${searchQuery} opened.` });
    } else {
      toast({ title: "Signal Lost", description: "OPERATIVE NOT FOUND on registered network.", variant: "destructive" });
    }
  };

  const showInlineError = (message: string) => {
    setInlineError(message);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setInlineError(null), 3000);
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setMediaStream(stream);
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      showInlineError("Camera permission denied.");
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      validateAndSelectFile(file);
      closeCamera();
    }, "image/jpeg", 0.8);
  };

  const closeCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    setMediaStream(null);
    setIsCameraOpen(false);
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
        validateAndSelectFile(file);
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      showInlineError("Microphone permission denied.");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || (!payloadText.trim() && !selectedFile) || !secretKey) {
      showInlineError("Missing payload details or key.");
      return;
    }
    
    setIsSending(true);
    setSendStage("encrypting");
    try {
      if (selectedFile) {
        await sendMessage(selectedContact, { kind: "file", file: selectedFile }, secretKey, ttlMinutes, setSendStage);
      } else {
        await sendMessage(selectedContact, { kind: "text", text: payloadText }, secretKey, ttlMinutes, setSendStage);
      }
      sendStopTyping(selectedContact);
      setPayloadText("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSendStage("idle");
      toast({ title: "Payload Sent", description: "Transmission successful." });
    } catch (e) {
      setSendStage("idle");
      showInlineError("Failed to send.");
    }
    setIsSending(false);
  };

  const handlePayloadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (selectedFile) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setPayloadText(value);

    if (selectedContact) {
      sendTyping(selectedContact);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => sendStopTyping(selectedContact), 1200);
    }
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (payloadText === (selectedFile?.name || "")) setPayloadText("");
    setSendStage("idle");
    if (selectedContact) sendStopTyping(selectedContact);
  };

  const validateAndSelectFile = async (file: File) => {
    if (file.size > maxFileSizeBytes) {
      showInlineError("File too large. Max size is 10MB.");
      return;
    }

    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const isAllowedType = allowedMimeTypes.has(file.type) || allowedExtensions.includes(fileExt);
    if (!isAllowedType) {
      showInlineError("Unsupported format.");
      return;
    }

    setSendStage(enableImageCompression && file.type.startsWith("image/") ? "compressing" : "idle");
    const finalFile = enableImageCompression ? await compressImageFile(file, imageCompressionOptions) : file;
    setSelectedFile(finalFile);
    setPayloadText(finalFile.name);
    setSendStage("idle");
    if (selectedContact) sendStopTyping(selectedContact);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await validateAndSelectFile(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await validateAndSelectFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragTimerRef.current) window.clearTimeout(dragTimerRef.current);
    dragTimerRef.current = window.setTimeout(() => setIsDragActive(true), 60);
  };

  const handleDragLeave = () => {
    if (dragTimerRef.current) window.clearTimeout(dragTimerRef.current);
    dragTimerRef.current = window.setTimeout(() => setIsDragActive(false), 120);
  };

  const renderPreview = () => {
    if (!selectedFile) return null;
    const lowerName = selectedFile.name.toLowerCase();
    const previewIcon = previewCategory === "archive"
      ? "🗜️"
      : lowerName.endsWith(".pdf")
      ? "📕"
      : lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx")
      ? "📽️"
      : lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx")
      ? "📊"
      : previewCategory === "audio"
      ? "🔊"
      : "📄";
    if (previewCategory === "image" && previewUrl) {
      return (
        <img
          src={previewUrl}
          alt={selectedFile.name}
          className="max-h-[120px] w-auto border border-primary/40 shadow-[0_0_10px_rgba(0,255,100,0.25)]"
          loading="lazy"
        />
      );
    }
    if (previewCategory === "video" && previewUrl) {
      return (
        <video
          src={previewUrl}
          muted
          preload="metadata"
          className="max-h-[140px] w-auto border border-primary/40 shadow-[0_0_10px_rgba(0,255,100,0.25)]"
        />
      );
    }
    return (
      <div className="flex items-center gap-3">
        <div className="text-primary text-lg">{previewIcon}</div>
        <div className="text-xs font-mono text-primary">
          {selectedFile.name} <span className="text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-120px)] w-[95vw] max-w-[1800px] glass-panel relative border border-primary/20 overflow-hidden mx-auto rounded-none mt-2">
      
      {/* Sidebar - Contacts */}
      <div className="w-80 shrink-0 border-r border-primary/20 flex flex-col bg-black/40 relative">
        <div className="p-4 border-b border-primary/20 bg-primary/10 space-y-4">
          <h2 className="font-mono text-glow text-lg uppercase font-bold tracking-widest">&gt; ACTIVE_LINKS</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
             <Input 
                 placeholder="Search Agent ID..."
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="font-mono text-xs bg-black/40 border-primary/30 text-primary h-10 rounded-none px-3 flex-1"
             />
             <Button type="submit" size="sm" className="btn-cyber rounded-none h-10 px-4 whitespace-nowrap">PING</Button>
          </form>
        </div>
        
        <div className="flex-1 overflow-y-auto w-full p-2 space-y-2">
          {visibleContacts.length === 0 ? (
            <p className="p-4 text-xs font-mono text-muted-foreground uppercase leading-relaxed">
              [SYSTEM: NO ACTIVE LINKS DETECTED. ENTER AGENT ID TO INITIATE PROTOCOL.]
            </p>
          ) : (
            visibleContacts.map(uid => (
              <div 
                key={uid} 
                onClick={() => setSelectedContact(uid)}
                className={`p-4 cursor-pointer border border-transparent transition-colors hover:border-primary/50 relative overflow-hidden ${selectedContact === uid ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(0,255,100,0.3)]' : 'bg-black/60'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${onlineUsers.has(uid) ? 'bg-primary shadow-[0_0_8px_hsl(150,100%,50%)]' : 'bg-muted-foreground/40'} ${onlineUsers.has(uid) && selectedContact === uid ? 'animate-pulse' : ''}`}
                  />
                  <span className="font-mono text-sm font-bold text-white uppercase">{uid}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-black/20">
        {!selectedContact ? (
          <div className="flex-1 flex items-center justify-center font-mono text-sm text-primary/40 uppercase tracking-widest text-center">
            &gt; AWAITING_CONNECTION...
            <br />
            SELECT AN OPERATIVE TO ESTABLISH LINK.
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-primary/20 bg-primary/5 flex justify-between items-center">
              <div>
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">ACTIVE_LINK: </span>
                <span className="font-mono font-bold text-glow-cyan uppercase">{selectedContact}</span>
              </div>
            </div>

            <div
              ref={chatScrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-6 relative"
            >
              {currentChatMsgs.length === 0 ? (
                <p className="text-center font-mono text-xs text-muted-foreground uppercase pt-10">NO PREVIOUS TRANSMISSIONS IN THIS CHANNEL.</p>
              ) : (
                currentChatMsgs.map(msg => (
                  <div key={msg.id} className={`flex w-full message-enter ${msg.senderId === user.userId ? 'justify-end' : 'justify-start'}`}>
                    <div className="w-full md:max-w-[90%] lg:max-w-[95%]">
                      <MessageCard message={msg} />
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
              <div
                className={`absolute bottom-3 right-4 transition-all duration-200 ${hasNewMessages && !isNearBottom ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScrollToLatest}
                  className={`rounded-full h-7 px-3 text-[11px] font-mono border-primary/40 bg-black/70 text-primary shadow-[0_0_10px_rgba(0,255,100,0.25)] hover:bg-black/80 ${hasNewMessages && !isNearBottom ? "animate-pulse" : ""}`}
                >
                  New Messages ↓
                </Button>
              </div>
            </div>

            {/* Message Composer */}
            <div className="p-4 bg-black/60 border-t border-primary/20">
               <form onSubmit={handleSend} className="space-y-4">
                 {selectedContact && typingUsers.has(selectedContact) && (
                   <div className="text-xs font-mono text-primary/70">
                     {selectedContact} is typing...
                   </div>
                  )}
                  <div className="flex gap-4">
                    <div
                      className={`flex-1 flex flex-col gap-2 ${isDragActive ? "ring-1 ring-primary/60" : ""}`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      {selectedFile && (
                        <div className="flex items-center justify-between border border-primary/20 bg-black/50 p-2 min-h-[56px] hover:shadow-[0_0_15px_rgba(0,255,100,0.3)] transition-all">
                          <div className="flex items-center gap-4">{renderPreview()}</div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={clearSelectedFile}
                            className="h-8 px-3 rounded-none border-destructive/50 bg-black/60 text-destructive hover:bg-destructive hover:text-white active:scale-95 transition-all"
                            aria-label="Remove file"
                          >
                            ❌
                          </Button>
                        </div>
                      )}
                      {inlineError && (
                        <InlineError message={inlineError} onDismiss={() => setInlineError(null)} />
                      )}
                      <div className="relative flex-1 flex">
                        <VoiceRecorderUI isRecording={isRecording} />
                        <Textarea 
                          placeholder="Enter raw payload..."
                          value={selectedFile ? selectedFile.name : payloadText}
                          onChange={handlePayloadChange}
                          disabled={isSending}
                          className="font-mono bg-black/40 border-primary/30 text-primary focus-visible:ring-primary rounded-none resize-none flex-1 min-h-[60px] pr-[120px]"
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={handleFileChange}
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.7z,.rar,.txt,.rtf,.csv,.json"
                        />
                        <div className="absolute right-2 top-2 flex gap-2 z-10">
                          <Button
                            type="button"
                            onClick={handleVoiceRecord}
                            disabled={isSending}
                            variant="outline"
                            className={`h-9 w-9 p-0 rounded-none border-primary/30 bg-black/60 hover:bg-black/80 active:scale-95 transition-all ${isRecording ? 'text-destructive border-destructive shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'text-primary shadow-[0_0_10px_rgba(0,255,100,0.1)] hover:shadow-[0_0_15px_rgba(0,255,100,0.3)]'}`}
                            title="Record Voice Note"
                          >
                            🎤
                          </Button>
                          <Button
                            type="button"
                            onClick={handleCameraCapture}
                            disabled={isSending}
                            variant="outline"
                            className="h-9 w-9 p-0 rounded-none border-primary/30 bg-black/60 text-primary hover:bg-black/80 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,255,100,0.1)] hover:shadow-[0_0_15px_rgba(0,255,100,0.3)]"
                            title="Camera Capture"
                          >
                            📷
                          </Button>
                          <Button
                            type="button"
                            onClick={handlePickFile}
                            disabled={isSending}
                            variant="outline"
                            className="h-9 w-9 p-0 rounded-none border-primary/30 bg-black/60 text-primary hover:bg-black/80 active:scale-95 transition-all shadow-[0_0_10px_rgba(0,255,100,0.1)] hover:shadow-[0_0_15px_rgba(0,255,100,0.3)]"
                            title="Attach File"
                          >
                            📎
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isSending || (!payloadText.trim() && !selectedFile)}
                      className="btn-cyber rounded-none h-auto px-6 whitespace-nowrap active:scale-95 transition-all"
                    >
                      {isSending ? (sendStage === "encrypting" ? "ENCRYPTING..." : sendStage === "compressing" ? "COMPRESSING..." : "TRANSMITTING...") : "TRANSMIT"}
                    </Button>
                 </div>

                 {sendStage !== "idle" && (
                   <div className="border border-primary/20 bg-black/50 p-2">
                     <div className="flex items-center justify-between text-xs font-mono text-primary transition-opacity duration-200">
                       <span>
                         {sendStage === "compressing" && "Compressing..."}
                         {sendStage === "encrypting" && "Encrypting..."}
                         {sendStage === "transmitting" && "Transmitting..."}
                       </span>
                       <span className="text-muted-foreground">SECURE_LINK</span>
                     </div>
                     <div className="mt-2 h-1 w-full bg-black/70 border border-primary/20">
                       <div
                         className={`h-full bg-primary transition-all duration-300 ${sendStage === "transmitting" ? "w-3/4" : sendStage === "encrypting" ? "w-1/2" : "w-1/4"} animate-pulse`}
                       />
                     </div>
                   </div>
                 )}
                 
                 <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-primary/5 p-3 border border-primary/10">
                   <div className="flex items-center gap-4 w-full md:w-auto">
                     <span className="font-mono text-xs text-muted-foreground whitespace-nowrap uppercase">&gt; CIPHER_KEY:</span>
                     <Input 
                        type="password"
                        placeholder="********"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        disabled={isSending}
                        className="font-mono border-primary/30 bg-black/40 text-primary h-8 w-32 rounded-none"
                     />
                   </div>
                   
                   <div className="flex items-center gap-4 w-full md:w-auto mt-2 md:mt-0">
                     <span className="font-mono text-xs text-muted-foreground uppercase">&gt; TTL ({ttlMinutes}m):</span>
                     <Slider
                        value={[ttlMinutes]}
                        min={1}
                        max={60}
                        step={1}
                        onValueChange={(val) => setTtlMinutes(val[0])}
                        disabled={isSending}
                        className="w-24 cursor-pointer"
                      />
                   </div>
                 </div>
               </form>
            </div>
          </>
        )}
      </div>
      
      {isCameraOpen && (
        <CameraModal 
          videoRef={videoRef} 
          onClose={closeCamera} 
          onCapture={takePhoto} 
        />
      )}
    </div>
  );
}
