"use client";

import { useState } from "react";
import { SidebarNav, type SidebarSection } from "@/components/SidebarNav";
import { GoalWizardModal } from "@/components/GoalWizardModal";
import { TemplateGallery } from "@/components/TemplateGallery";
import { PromptPlanEditor } from "@/components/PromptPlanEditor";
import { ChatPanel } from "@/components/ChatPanel";
import { ComposerBar } from "@/components/ComposerBar";
import { RightInspector } from "@/components/RightInspector";
import { CompareDrawer } from "@/components/CompareDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChatStore } from "@/stores/chatStore";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";

function SessionHistoryPanel() {
  const { messages, clearMessages } = useChatStore();
  const { profile } = useModelStore();
  const { chatProvider } = useSettingsStore();
  const handleClear = () => {
    clearMessages();
    if (chatProvider === "effgen") {
      fetch("/api/effgen/clear-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: profile.modelName }),
      }).catch(() => {});
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Chat history is saved in this browser. Refresh the page to keep your conversation.
      </p>
      <p className="text-xs text-muted-foreground">
        {messages.length} message{messages.length !== 1 ? "s" : ""} in this conversation.
      </p>
      <Button variant="outline" size="sm" onClick={handleClear}>
        Clear chat history
      </Button>
    </div>
  );
}

export default function Home() {
  const [sidebarSection, setSidebarSection] = useState<SidebarSection | null>(null);
  const [goalWizardOpen, setGoalWizardOpen] = useState(false);
  const { chatProvider } = useSettingsStore();
  const isSlm = chatProvider === "effgen";
  const showLeftColumn =
    isSlm || sidebarSection === "examples" || sidebarSection === "history";

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav
        activeSection={sidebarSection}
        onSectionChange={(section) => {
          setSidebarSection(section);
        }}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex flex-1 overflow-hidden">
          <main className="flex flex-1 flex-col min-w-0">
            <div className="flex flex-1 overflow-hidden">
              {showLeftColumn && (
                <div className="w-96 shrink-0 border-r border-border overflow-y-auto p-4 space-y-6">
                  {sidebarSection === "templates" && (
                    <TemplateGallery onUse={() => setSidebarSection(null)} />
                  )}
                  {sidebarSection === "examples" && (
                    isSlm ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Demo use cases</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                          <p>1) Explain a lab procedure as a checklist for a rural clinic assistant</p>
                          <p>2) Summarize this paragraph for a non-expert audience without jargon</p>
                          <p>3) Extract key fields into JSON from a short note</p>
                          <p>4) Rewrite a message politely with constraints (short / formal / no extra claims)</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Examples (LLM)</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          TODO: Design LLM-specific examples.
                        </CardContent>
                      </Card>
                    )
                  )}
                  {isSlm && (sidebarSection === null || sidebarSection === "goal") && (
                    <PromptPlanEditor onOpenGoalWizard={() => setGoalWizardOpen(true)} />
                  )}
                  {sidebarSection === "history" && (
                    <SessionHistoryPanel />
                  )}
                  {sidebarSection === "settings" && (
                    <p className="text-sm text-muted-foreground">Settings (theme, API endpoint, etc.).</p>
                  )}
                </div>
              )}
              <div className="flex-1 flex flex-col min-w-0">
                <ChatPanel />
                <ComposerBar />
              </div>
            </div>
          </main>
          <RightInspector />
        </div>
      </div>
      <GoalWizardModal open={goalWizardOpen} onClose={() => setGoalWizardOpen(false)} />
      <CompareDrawer />
    </div>
  );
}
