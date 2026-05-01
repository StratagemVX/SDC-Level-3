import React, { useState } from "react";
import { Button } from "@/components/ui/button";

interface CameraModalProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onClose: () => void;
  onCapture: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = React.memo(({ videoRef, onClose, onCapture }) => {
  const [isFlashing, setIsFlashing] = useState(false);

  const handleCapture = () => {
    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
      onCapture();
    }, 150);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-black border border-primary/40 shadow-[0_0_40px_rgba(0,255,100,0.2)] rounded-none overflow-hidden zoom-in-95 animate-in duration-200">
        
        {/* Header */}
        <div className="absolute top-0 left-0 w-full p-2 bg-black/70 text-primary font-mono text-xs uppercase flex justify-between z-10 border-b border-primary/30 backdrop-blur-sm">
          <span className="text-glow">&gt; CAMERA_FEED_ACTIVE</span>
          <span className="animate-pulse text-destructive font-bold">● REC</span>
        </div>
        
        {/* Video Feed */}
        <div className="relative w-full bg-black flex items-center justify-center min-h-[300px]">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-auto object-cover"
          />
          {/* Shutter Flash Overlay */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-20 animate-out fade-out duration-300" />
          )}
        </div>
        
        {/* Controls */}
        <div className="p-4 flex justify-between gap-4 bg-black/80 border-t border-primary/30 backdrop-blur-sm">
          <Button 
            onClick={onClose} 
            variant="outline" 
            className="btn-cyber rounded-none border-destructive/50 text-destructive hover:bg-destructive hover:text-white active:scale-95 transition-all w-1/3"
          >
            ABORT
          </Button>
          <Button 
            onClick={handleCapture} 
            className="btn-cyber rounded-none flex-1 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,100,0.3)] hover:shadow-[0_0_25px_rgba(0,255,100,0.5)] bg-primary text-black font-extrabold"
          >
            CAPTURE
          </Button>
        </div>
      </div>
    </div>
  );
});
