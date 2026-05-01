import React, { useEffect, useState } from "react";

interface InlineErrorProps {
  message: string;
  onDismiss: () => void;
}

export const InlineError: React.FC<InlineErrorProps> = React.memo(({ message, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div 
      className={`mb-2 flex items-center gap-2 bg-destructive/10 border border-destructive/50 text-destructive px-3 py-1.5 font-mono text-xs shadow-[0_0_10px_rgba(255,0,0,0.15)] transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
    >
      <span className="text-sm">⚠</span>
      <span>{message}</span>
    </div>
  );
});
