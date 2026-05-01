
import React from "react";
import { cn } from "@/lib/utils";

interface FormContainerProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function FormContainer({ children, className, title, subtitle }: FormContainerProps) {
  return (
    <div className={cn(
      "w-full max-w-md mx-auto p-8 rounded-none glass-panel relative",
      className
    )}>
      {/* Decorative Corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary"></div>

      {title && (
        <div className="mb-8 text-center border-b border-primary/20 pb-4">
          <h2 className="text-3xl font-mono font-bold text-glow uppercase tracking-[0.2em]">{title}</h2>
          {subtitle && <p className="mt-2 text-muted-foreground font-mono text-sm uppercase tracking-wider">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
