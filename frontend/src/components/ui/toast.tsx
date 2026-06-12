"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  message: string;
  variant?: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  variant = "success",
  onClose,
  duration = 3000,
}: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const variants = {
    success: "bg-success text-text-inverse",
    error: "bg-error text-text-inverse",
    info: "bg-accent text-text-inverse",
  };

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
        "px-4 py-3 rounded-xl shadow-lg",
        "text-sm font-medium",
        "transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        variants[variant],
      )}
      role="alert"
    >
      {message}
    </div>
  );
}
