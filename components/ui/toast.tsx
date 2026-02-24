"use client";

import { cn } from "@/lib/utils";

export type ToastType = "success" | "warning" | "error" | "info";

export function Toast({
  message,
  type = "info",
  onDismiss,
  className,
}: {
  message: string;
  type?: ToastType;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg",
        type === "success" && "border-success bg-success/10 text-success",
        type === "warning" && "border-warning bg-warning/10 text-warning",
        type === "error" && "border-danger bg-danger/10 text-danger",
        type === "info" && "border-primary bg-primary/10 text-primary",
        className
      )}
    >
      <span className="flex-1 text-sm font-medium">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-current opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
