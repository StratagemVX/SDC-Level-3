import React, { useEffect, useState } from "react";

interface VoiceRecorderUIProps {
  isRecording: boolean;
}

export const VoiceRecorderUI: React.FC<VoiceRecorderUIProps> = React.memo(({ isRecording }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: number | undefined;
    if (isRecording) {
      setSeconds(0);
      interval = window.setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRecording]);

  if (!isRecording) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="absolute top-3 left-3 flex items-center gap-4 bg-black/80 px-4 py-2 border border-primary/40 shadow-[0_0_15px_rgba(0,255,100,0.2)] rounded-none animate-in fade-in zoom-in-95 duration-200 z-20 pointer-events-none">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
        <span className="font-mono text-destructive text-sm font-bold tracking-widest">{formatTime(seconds)}</span>
      </div>
      <div className="flex items-center gap-1 h-6 pl-2 border-l border-primary/20">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i} 
            className="w-1 bg-primary animate-waveform rounded-full" 
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
});
