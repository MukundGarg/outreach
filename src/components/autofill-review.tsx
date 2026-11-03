'use client';
import { useState } from 'react';
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  ShieldAlert,
  Save,
} from 'lucide-react';
import type { AutofillFieldMapping, ApplicationAutofillData } from '@/lib/domain';

interface AutofillReviewProps {
  applicationId: string;
  applicationUrl: string;
  initialAutofill?: ApplicationAutofillData | null;
  onSaveAutofill: (data: ApplicationAutofillData) => Promise<void>;
  isDemo?: boolean;
}

export function AutofillReview({
  applicationId,
  applicationUrl,
  initialAutofill,
  onSaveAutofill,
}: AutofillReviewProps) {
  // Use keyed state resetting pattern via inner component to avoid calling setState synchronously in useEffect
  return (
    <AutofillReviewInner
      key={applicationId}
      applicationId={applicationId}
      applicationUrl={applicationUrl}
      initialAutofill={initialAutofill}
      onSaveAutofill={onSaveAutofill}
    />
  );
}

function AutofillReviewInner({
  applicationId,
  applicationUrl,
  initialAutofill,
  onSaveAutofill,
}: AutofillReviewProps) {
  const [url, setUrl] = useState(initialAutofill?.applicationUrl || applicationUrl || '');
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [urlMessage, setUrlMessage] = useState('');

  // Local editable copy of fields
  const [fields, setFields] = useState<AutofillFieldMapping[]>(initialAutofill?.fields || []);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Group fields
  const profileFields = fields.filter((f) => f.category === 'profile');
  const basicFields = fields.filter((f) => f.category === 'gemini_basic');
  const complexFields = fields.filter((f) => f.category === 'complex_review');
  const sensitiveFields = fields.filter((f) => f.category === 'sensitive');
  const missingFields = fields.filter((f) => f.category === 'missing');

  async function handleAnalyzeUrl() {
    if (!url.trim()) return;
    setAnalyzingUrl(true);
    setUrlMessage('');
    try {
      const res = await fetch('/api/applications/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_url',
          applicationId,
          url: url.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to analyze URL');
      }
      setUrlMessage(`Target URL validated. Detected Platform: ${json.data.detectedPlatform || 'Standard Form'}.`);
    } catch (err: unknown) {
      setUrlMessage(err instanceof Error ? err.message : 'Error validating URL');
    } finally {
      setAnalyzingUrl(false);
    }
  }

  function handleFieldChange(fieldId: string, newValue: string) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.fieldId === fieldId) {
          return {
            ...f,
            proposedValue: newValue,
            source: 'user',
            status: 'reviewed',
          };
        }
        return f;
      }),
    );
  }

  function handleMarkReviewed(fieldId: string) {
    setFields((prev) =>
      prev.map((f) => (f.fieldId === fieldId ? { ...f, status: 'reviewed' } : f)),
    );
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveAutofill({
        applicationUrl: url,
        fields,
        autofillStatus: 'analyzed',
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save autofill answers');
    } finally {
      setSaving(false);
    }
  }

  function copyAppId() {
    navigator.clipboard.writeText(applicationId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  return (
    <section
      className="card stack"
      style={{
        border: '1px solid #789966',
        background: '#fafbf9',
        padding: 20,
        gap: 16,
      }}
    >
      <div className="between">
        <div className="row" style={{ gap: 8 }}>
          <Sparkles size={18} style={{ color: '#27694e' }} />
          <h2 style={{ margin: 0, fontSize: 16 }}>AI Application Autofill</h2>
        </div>
        <span className="badge submitted" style={{ fontSize: 11 }}>
          Chrome Extension Ready
        </span>
      </div>

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Paste the external job application or careers form URL. The ApplyPilot Chrome extension scans form inputs, maps profile details, and uses Gemini to answer screening questions with full candidate review.
      </p>

      {/* Step 1: URL input */}
      <div className="stack" style={{ gap: 8, background: 'white', padding: 14, borderRadius: 6, border: '1px solid #e2e8f0' }}>
        <label className="field" style={{ margin: 0 }}>
          <strong>External Application Form URL</strong>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <input
              type="url"
              placeholder="e.g. https://boards.greenhouse.io/... or https://jobs.lever.co/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              type="button"
              className="button"
              disabled={analyzingUrl || !url.trim()}
              onClick={handleAnalyzeUrl}
              style={{ fontSize: 12 }}
            >
              {analyzingUrl ? 'Analyzing…' : 'Analyze & Save URL'}
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="button primary"
                style={{ fontSize: 12 }}
              >
                Open External Page <ExternalLink size={13} />
              </a>
            )}
          </div>
        </label>

        {urlMessage && (
          <div className="row" style={{ fontSize: 12, color: '#27694e', gap: 4 }}>
            <CheckCircle2 size={13} /> {urlMessage}
          </div>
        )}

        <div className="between" style={{ fontSize: 11, background: '#f8fafc', padding: '6px 10px', borderRadius: 4 }}>
          <span>
            Application ID for Extension Pairing: <strong>{applicationId}</strong>
          </span>
          <button
            type="button"
            className="button"
            style={{ fontSize: 10, padding: '2px 6px' }}
            onClick={copyAppId}
          >
            {copiedId ? <Check size={11} /> : <Copy size={11} />} {copiedId ? 'Copied' : 'Copy ID'}
          </button>
        </div>
      </div>

      {/* Extension Instruction Prompt */}
      {fields.length === 0 && (
        <div
          className="card between"
          style={{
            background: '#f4f7f0',
            border: '1px dashed #789966',
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: 12 }}>
            <strong>How to autofill this external job application:</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18, color: '#475569' }}>
              <li>Open the external application page in another Chrome tab.</li>
              <li>Click the <strong>ApplyPilot Extension</strong> in your browser bar.</li>
              <li>Enter your Application ID: <code style={{ background: '#e2e8f0', padding: '1px 4px' }}>{applicationId}</code>.</li>
              <li>Click <strong>Extract Fields from This Page</strong>.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Step 5: Reviewed Form Fields Display */}
      {fields.length > 0 && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="between" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14 }}>Reviewed Autofill Form Fields ({fields.length})</h3>
              <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                Review and customize proposed answers. The extension will populate these fields when you trigger autofill.
              </p>
            </div>
            <button
              type="button"
              className="button primary"
              disabled={saving}
              onClick={handleSaveAll}
              style={{ fontSize: 12 }}
            >
              <Save size={13} /> {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Reviewed Autofill Answers'}
            </button>
          </div>

          {/* Group 1: Profile Information */}
          {profileFields.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <strong style={{ fontSize: 13, color: '#166534' }}>1. Profile Information ({profileFields.length})</strong>
              {profileFields.map((f) => (
                <FieldRow key={f.fieldId} field={f} onChange={handleFieldChange} onReviewed={handleMarkReviewed} />
              ))}
            </div>
          )}

          {/* Group 2: Gemini Basic Answers */}
          {basicFields.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <strong style={{ fontSize: 13, color: '#0369a1' }}>2. Basic Screening Answers (Gemini Generated) ({basicFields.length})</strong>
              {basicFields.map((f) => (
                <FieldRow key={f.fieldId} field={f} onChange={handleFieldChange} onReviewed={handleMarkReviewed} />
              ))}
            </div>
          )}

          {/* Group 3: Complex Questions (Needs Review) */}
          {complexFields.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <strong style={{ fontSize: 13, color: '#b45309' }}>3. Complex Questions (AI Suggestions — Review Required) ({complexFields.length})</strong>
              {complexFields.map((f) => (
                <FieldRow key={f.fieldId} field={f} onChange={handleFieldChange} onReviewed={handleMarkReviewed} />
              ))}
            </div>
          )}

          {/* Group 4: Sensitive Declarations (User Input Required) */}
          {sensitiveFields.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 6, color: '#b91c1c' }}>
                <ShieldAlert size={15} />
                <strong style={{ fontSize: 13 }}>4. Sensitive / Factual Declarations (User Input Required) ({sensitiveFields.length})</strong>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                Legal, work authorization, and demographic declarations are never automated by AI. Please specify your authoritative answers below.
              </p>
              {sensitiveFields.map((f) => (
                <FieldRow key={f.fieldId} field={f} onChange={handleFieldChange} onReviewed={handleMarkReviewed} />
              ))}
            </div>
          )}

          {/* Group 5: Missing Information */}
          {missingFields.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <strong style={{ fontSize: 13, color: '#64748b' }}>5. Additional Form Fields ({missingFields.length})</strong>
              {missingFields.map((f) => (
                <FieldRow key={f.fieldId} field={f} onChange={handleFieldChange} onReviewed={handleMarkReviewed} />
              ))}
            </div>
          )}

          <div className="between" style={{ paddingTop: 8 }}>
            <span className="muted" style={{ fontSize: 11 }}>
              {fields.filter((f) => f.status === 'reviewed').length} of {fields.length} fields marked as reviewed
            </span>
            <button
              type="button"
              className="button primary"
              disabled={saving}
              onClick={handleSaveAll}
              style={{ fontSize: 12 }}
            >
              <Save size={13} /> {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Reviewed Autofill Answers'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function FieldRow({
  field,
  onChange,
  onReviewed,
}: {
  field: AutofillFieldMapping;
  onChange: (id: string, val: string) => void;
  onReviewed: (id: string) => void;
}) {
  const isTextarea = field.fieldType === 'textarea' || (field.proposedValue && field.proposedValue.length > 100);

  return (
    <div
      style={{
        background: 'white',
        border: field.status === 'user_required' ? '1px solid #fecaca' : '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: 12,
      }}
    >
      <div className="between" style={{ marginBottom: 4 }}>
        <div className="row" style={{ gap: 6 }}>
          <strong>{field.fieldLabel}</strong>
          {field.required && <span style={{ color: '#b91c1c' }}>*</span>}
          <span className="badge" style={{ fontSize: 10 }}>
            {field.source === 'profile'
              ? 'Profile'
              : field.source === 'gemini_basic'
              ? 'Gemini Basic'
              : field.source === 'gemini_complex'
              ? 'Gemini Suggestion'
              : 'User'}
          </span>
        </div>
        <span
          className={`badge ${
            field.status === 'reviewed' ? 'submitted' : field.status === 'user_required' ? 'closed' : 'under_review'
          }`}
          style={{ fontSize: 10 }}
        >
          {field.status === 'reviewed' ? 'Reviewed' : field.status === 'user_required' ? 'Input Required' : 'Review Suggestion'}
        </span>
      </div>

      {isTextarea ? (
        <textarea
          rows={3}
          value={field.proposedValue}
          placeholder="Enter answer…"
          onChange={(e) => onChange(field.fieldId, e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: 6, boxSizing: 'border-box' }}
        />
      ) : field.options && field.options.length > 0 ? (
        <select
          value={field.proposedValue}
          onChange={(e) => onChange(field.fieldId, e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: 4 }}
        >
          <option value="">Select an option…</option>
          {field.options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.fieldType === 'email' ? 'email' : 'text'}
          value={field.proposedValue}
          placeholder="Enter answer…"
          onChange={(e) => onChange(field.fieldId, e.target.value)}
          style={{ width: '100%', fontSize: 12, padding: 4, boxSizing: 'border-box' }}
        />
      )}

      {field.status !== 'reviewed' && field.proposedValue && (
        <div style={{ marginTop: 4, textAlign: 'right' }}>
          <button
            type="button"
            className="button"
            style={{ fontSize: 10, padding: '2px 8px' }}
            onClick={() => onReviewed(field.fieldId)}
          >
            <Check size={11} /> Confirm as Reviewed
          </button>
        </div>
      )}
    </div>
  );
}
