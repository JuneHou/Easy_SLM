// Design system — geek style, dual theme (dark/light)

export const theme = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  background: "#0f172a",
  surface: "#1e293b",
  border: "#334155",
} as const;

export const themeLight = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  background: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
} as const;

// Typography: Headings 'Inter' 700, Body 'Inter' 400, Code 'JetBrains Mono'
export const typography = {
  heading: "font-sans font-bold",
  body: "font-sans font-normal",
  code: "font-mono",
} as const;
