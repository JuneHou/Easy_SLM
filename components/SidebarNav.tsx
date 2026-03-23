"use client";

import { cn } from "@/lib/utils";
import {
  Target,
  LayoutTemplate,
  BookOpen,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Cloud,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { useSettingsStore } from "@/stores/settingsStore";

const items = [
  { id: "goal", label: "Goal Wizard", icon: Target },
  { id: "templates", label: "Template Gallery", icon: LayoutTemplate },
  { id: "examples", label: "Examples", icon: BookOpen },
  { id: "history", label: "Session History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type SidebarSection = (typeof items)[number]["id"];

interface SidebarNavProps {
  activeSection: SidebarSection | null;
  onSectionChange: (section: SidebarSection) => void;
}

export function SidebarNav({ activeSection, onSectionChange }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { chatProvider, setChatProvider } = useSettingsStore();
  const isSlm = chatProvider === "effgen";

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-14" : "w-52"
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border px-2">
        {!collapsed && (
          <span className="text-sm font-semibold text-foreground">SLM Tool</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      {/* SLM vs LLM tabs */}
      {!collapsed && (
        <div className="flex border-b border-border p-2 gap-1">
          <button
            type="button"
            onClick={() => setChatProvider("effgen")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              isSlm ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Cpu className="h-4 w-4 shrink-0" />
            SLM
          </button>
          <button
            type="button"
            onClick={() => setChatProvider(isSlm ? "openai" : chatProvider)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              !isSlm ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Cloud className="h-4 w-4 shrink-0" />
            LLM
          </button>
        </div>
      )}
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              activeSection === id
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-surface/80 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
