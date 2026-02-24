"use client";

import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = ({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
      variant === "primary" && "bg-primary text-white hover:opacity-90",
      variant === "secondary" && "bg-secondary text-white hover:opacity-90",
      variant === "ghost" && "hover:bg-surface",
      variant === "outline" && "border border-border bg-transparent hover:bg-surface",
      variant === "danger" && "bg-danger text-white hover:opacity-90",
      size === "sm" && "px-2 py-1 text-sm",
      size === "md" && "px-3 py-2 text-sm",
      size === "lg" && "px-4 py-2.5 text-base",
      className
    )}
    {...props}
  />
);
