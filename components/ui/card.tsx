"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-gray-800/90 to-gray-900/90",
        "border border-gray-700/50 rounded-lg",
        "p-4 shadow-lg",
        className
      )}
    >
      {children}
    </div>
  );
}

