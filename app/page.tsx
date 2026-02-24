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

export default function Home() {
  const [sidebarSection, setSidebarSection] = useState<SidebarSection | null>(null);
  const [goalWizardOpen, setGoalWizardOpen] = useState(false);

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
              <div className="w-96 shrink-0 border-r border-border overflow-y-auto p-4 space-y-6">
                {sidebarSection === "templates" && (
                  <TemplateGallery onUse={() => setSidebarSection(null)} />
                )}
                {sidebarSection === "examples" && (
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
                )}
                {(sidebarSection === null || sidebarSection === "goal") && (
                  <PromptPlanEditor onOpenGoalWizard={() => setGoalWizardOpen(true)} />
                )}
                {sidebarSection === "history" && (
                  <p className="text-sm text-muted-foreground">Session history (demo: use Run store to list runs).</p>
                )}
                {sidebarSection === "settings" && (
                  <p className="text-sm text-muted-foreground">Settings (theme, API endpoint, etc.).</p>
                )}
              </div>
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
