'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from './use-workspace';
import { AutofillReview } from './autofill-review';
import type { ApplicationAutofillData } from '@/lib/domain';
import {
  FileCheck2,
  ExternalLink,
  Puzzle,
  Sparkles,
} from 'lucide-react';

export function AutofillStandalone() {
  const { data, isDemo, savePreparation, refresh } = useWorkspace();
  const applications = useMemo(() => data.applications || [], [data.applications]);
  const [selectedAppId, setSelectedAppId] = useState<string>(() => applications[0]?.id || '');
  const [autofillData, setAutofillData] = useState<ApplicationAutofillData | null>(null);

  // Sync selectedAppId if initial state was empty and applications become available
  const effectiveAppId = selectedAppId || applications[0]?.id || '';
  const selectedApp = applications.find((a) => a.id === effectiveAppId);

  // Fetch autofill data when effectiveAppId changes
  useEffect(() => {
    if (!effectiveAppId) return;

    let isMounted = true;
    async function loadData() {
      try {
        const res = await fetch(`/api/applications/autofill?applicationId=${encodeURIComponent(effectiveAppId)}`);
        const json = await res.json();
        if (isMounted && json.ok && json.data) {
          setAutofillData(json.data);
        }
      } catch (err) {
        console.error('Failed to load autofill data:', err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [effectiveAppId]);

  async function handleSaveAutofill(savedData: ApplicationAutofillData) {
    if (!effectiveAppId) return;
    if (savePreparation) {
      await savePreparation(effectiveAppId, {
        autofill: savedData,
      });
    } else {
      await fetch('/api/applications/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_autofill',
          applicationId: effectiveAppId,
          url: savedData.applicationUrl,
          fields: savedData.fields,
          autofillStatus: savedData.autofillStatus,
        }),
      });
    }
    setAutofillData(savedData);
    if (refresh) {
      await refresh();
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400 mb-2">
            <FileCheck2 className="h-3.5 w-3.5" />
            AI-Powered Autofill Engine
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            AI Form Filling &amp; Assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Map external job application fields to candidate profile facts, generate intelligent answers with Gemini, and autofill forms with the Chrome Extension.
          </p>
        </div>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3 font-semibold text-foreground mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 text-sm font-bold">
              1
            </span>
            <span>Target Application URL</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Select or enter a target application URL (e.g. Greenhouse, Lever, Workday, Ashby, or custom portals).
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3 font-semibold text-foreground mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 text-sm font-bold">
              2
            </span>
            <span>AI Review &amp; Categorization</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Inspect profile facts, AI generated responses, and sensitive questions requiring candidate review.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3 font-semibold text-foreground mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
              3
            </span>
            <span>One-Click Browser Fill</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Connect the ApplyPilot Chrome Extension to populate mapped fields while retaining full human control over submission.
          </p>
        </div>
      </div>

      {/* Application Selector */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label htmlFor="app-select" className="block text-sm font-medium text-foreground">
              Select Active Job Application
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose an existing pipeline role to review and manage form autofill data.
            </p>
          </div>
          <div className="w-full sm:w-80">
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No applications available.</p>
            ) : (
              <select
                id="app-select"
                value={effectiveAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.title} — {app.company} ({app.status})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Active Application Autofill Component */}
      {selectedApp ? (
        <div className="space-y-6">
          <AutofillReview
            key={selectedApp.id}
            applicationId={selectedApp.id}
            applicationUrl={selectedApp.url || ''}
            initialAutofill={autofillData || selectedApp.preparation?.autofill}
            onSaveAutofill={handleSaveAutofill}
            isDemo={isDemo}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-medium text-foreground">No Application Selected</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Please create an application in the Applications pipeline or select one above to begin AI form extraction and filling.
          </p>
        </div>
      )}

      {/* Extension Installation & Connection Helper Banner */}
      <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
            <Puzzle className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-foreground">
              ApplyPilot Chrome Extension Setup
            </h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Load the extension unpacked via <code className="text-sky-300 font-mono">chrome://extensions</code> pointing to the project&apos;s <code className="text-sky-300 font-mono">extension/</code> directory. Connect with Application ID: <strong className="text-foreground font-mono">{effectiveAppId || 'sample-1'}</strong>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="chrome://extensions"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <span>Open chrome://extensions</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
