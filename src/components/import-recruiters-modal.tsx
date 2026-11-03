'use client';
import { useState } from 'react';
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  Users,
  Sparkles,
  X,
  Trash2,
} from 'lucide-react';
import type { CanonicalRecruiterRecord } from '@/lib/ai-schemas';

interface ImportRecruitersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  isDemo?: boolean;
}

export function ImportRecruitersModal({
  isOpen,
  onClose,
  onImportComplete,
}: ImportRecruitersModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis result
  const [records, setRecords] = useState<CanonicalRecruiterRecord[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [shareConsent, setShareConsent] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    imported: number;
    rejected: number;
    sharedCount: number;
  } | null>(null);

  if (!isOpen) return null;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setError('Please upload a valid CSV file.');
      return;
    }

    if (selectedFile.size > 500000) {
      setError('CSV file size exceeds 500KB limit.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setImportSummary(null);

    // Read and trigger AI analysis
    setAnalyzing(true);
    try {
      const text = await selectedFile.text();
      const res = await fetch('/api/outreach/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          csvText: text,
          filename: selectedFile.name,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Failed to analyze CSV');
      }

      const extracted: CanonicalRecruiterRecord[] = json.data.recruiters || [];
      setRecords(extracted);
      setColumnMapping(json.data.columnMapping || {});
      // Select all by default
      setSelectedIndices(new Set(extracted.map((_, i) => i)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error analyzing CSV file';
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  function handleToggleSelect(idx: number) {
    const next = new Set(selectedIndices);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedIndices(next);
  }

  function handleSelectAll() {
    if (selectedIndices.size === records.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(records.map((_, i) => i)));
    }
  }

  function handleFieldChange(index: number, field: keyof CanonicalRecruiterRecord, value: string) {
    setRecords((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleRemoveRecord(index: number) {
    setRecords((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  }

  async function handleConfirmImport() {
    const selectedRecords = records.filter((_, idx) => selectedIndices.has(idx));
    if (selectedRecords.length === 0) {
      setError('Please select at least one recruiter to import.');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/outreach/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit',
          filename: file?.name || 'recruiters.csv',
          records: selectedRecords,
          shareConsent,
        }),
      });

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Failed to complete import');
      }

      setImportSummary(json.data);
      onImportComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  const validCount = records.filter((r) => r.verification_status === 'verified').length;
  const reviewCount = records.filter((r) => r.verification_status === 'needs_review' || r.validation_issues.length > 0).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card stack"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'white',
          padding: 24,
          borderRadius: 8,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="between" style={{ borderBottom: '1px solid #eee', paddingBottom: 12 }}>
          <div className="row" style={{ gap: 8 }}>
            <Users size={20} style={{ color: '#27694e' }} />
            <h2 style={{ margin: 0, fontSize: 18 }}>Import Recruiters (CSV)</h2>
          </div>
          <button type="button" className="button" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="card" style={{ background: '#fff5f5', border: '1px solid #d32f2f', color: '#d32f2f', fontSize: 13, padding: 12 }}>
            <AlertCircle size={16} style={{ display: 'inline', marginRight: 6 }} />
            {error}
          </div>
        )}

        {/* 1. File Upload View */}
        {!file && (
          <div className="stack" style={{ gap: 16, padding: '24px 0' }}>
            <label
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 8,
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                display: 'block',
              }}
            >
              <Upload size={32} style={{ margin: '0 auto 12px', color: '#64748b' }} />
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                Choose a CSV file to upload
              </div>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                Supports varied column headers, LinkedIn URLs, company names, and domains (Max 500KB)
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {/* 2. Analyzing View */}
        {analyzing && (
          <div className="card stack" style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc' }}>
            <Sparkles size={28} style={{ margin: '0 auto 12px', color: '#27694e', animation: 'spin 2s linear infinite' }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Gemini is analyzing your CSV columns…</div>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
              Mapping varied headers to canonical fields, extracting specialties, and running DNS MX checks.
            </p>
          </div>
        )}

        {/* 3. Preview and Correction View */}
        {records.length > 0 && !importSummary && (
          <div className="stack" style={{ gap: 16 }}>
            {/* Column Mapping Pill Bar */}
            {Object.keys(columnMapping).length > 0 && (
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, fontSize: 11 }}>
                <span style={{ fontWeight: 600, marginRight: 6 }}>Gemini Detected Mappings:</span>
                {Object.entries(columnMapping).map(([csvCol, canon]) => (
                  <span key={csvCol} className="badge" style={{ marginRight: 6, marginBottom: 4 }}>
                    {csvCol} &rarr; <strong>{canon}</strong>
                  </span>
                ))}
              </div>
            )}

            {/* Metrics Bar */}
            <div className="between" style={{ fontSize: 12, background: '#f4f7f0', padding: '8px 12px', borderRadius: 6 }}>
              <div className="row" style={{ gap: 12 }}>
                <span>Total records: <strong>{records.length}</strong></span>
                <span style={{ color: '#27694e' }}>Verified (MX & Identity): <strong>{validCount}</strong></span>
                {reviewCount > 0 && (
                  <span style={{ color: '#b45309' }}>Needs Review: <strong>{reviewCount}</strong></span>
                )}
                <span>Selected: <strong>{selectedIndices.size}</strong></span>
              </div>
              <button
                type="button"
                className="button"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={handleSelectAll}
              >
                {selectedIndices.size === records.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Editable Preview Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 10px', width: 36 }}>Sel</th>
                    <th style={{ padding: '8px 10px' }}>Name</th>
                    <th style={{ padding: '8px 10px' }}>Email</th>
                    <th style={{ padding: '8px 10px' }}>Job Title</th>
                    <th style={{ padding: '8px 10px' }}>Company</th>
                    <th style={{ padding: '8px 10px' }}>Location</th>
                    <th style={{ padding: '8px 10px' }}>Status & Issues</th>
                    <th style={{ padding: '8px 10px', width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    const hasIssues = r.validation_issues.length > 0;
                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: !isSelected ? '#fcfcfc' : hasIssues ? '#fffbeb' : 'white',
                          opacity: !isSelected ? 0.6 : 1,
                        }}
                      >
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(idx)}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="text"
                            value={r.full_name || ''}
                            onChange={(e) => handleFieldChange(idx, 'full_name', e.target.value)}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="text"
                            value={r.email || ''}
                            onChange={(e) => handleFieldChange(idx, 'email', e.target.value)}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="text"
                            value={r.job_title || ''}
                            onChange={(e) => handleFieldChange(idx, 'job_title', e.target.value)}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="text"
                            value={r.company || ''}
                            onChange={(e) => handleFieldChange(idx, 'company', e.target.value)}
                            style={{ width: '100%', fontSize: 12, padding: '2px 4px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="text"
                            value={r.location || ''}
                            onChange={(e) => handleFieldChange(idx, 'location', e.target.value)}
                            style={{ width: 100, fontSize: 12, padding: '2px 4px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px', fontSize: 11 }}>
                          <span
                            className={`badge ${
                              r.verification_status === 'verified'
                                ? 'submitted'
                                : r.verification_status === 'needs_review'
                                ? 'under_review'
                                : 'draft'
                            }`}
                            style={{ marginRight: 4 }}
                          >
                            {r.verification_status}
                          </span>
                          {r.validation_issues.length > 0 && (
                            <span style={{ color: '#b45309', display: 'block', fontSize: 10 }}>
                              {r.validation_issues.join(', ')}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <button
                            type="button"
                            className="button"
                            onClick={() => handleRemoveRecord(idx)}
                            style={{ padding: 2, color: '#ef4444' }}
                            title="Remove record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Optional Shared Directory Opt-In */}
            <div
              className="card stack"
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: 12,
                borderRadius: 6,
              }}
            >
              <label className="row" style={{ alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={shareConsent}
                  onChange={(e) => setShareConsent(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <div style={{ fontSize: 12 }}>
                  <strong>Allow eligible verified professional recruiter information from this import to be added to the shared recruiter directory</strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: 11 }}>
                    Only verified professional contact fields (name, title, company, public email/LinkedIn) are shared to help other users discover relevant recruiters. Private notes, personal candidate details, and unverified data are NEVER shared.
                  </p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="between" style={{ paddingTop: 8 }}>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setFile(null);
                  setRecords([]);
                }}
              >
                Upload Different File
              </button>
              <button
                type="button"
                className="button primary"
                disabled={importing || selectedIndices.size === 0}
                onClick={handleConfirmImport}
              >
                {importing ? 'Importing…' : `Confirm Import (${selectedIndices.size} Recruiters)`}
              </button>
            </div>
          </div>
        )}

        {/* 4. Import Summary Result */}
        {importSummary && (
          <div className="stack" style={{ textAlign: 'center', padding: '24px 0', gap: 16 }}>
            <CheckCircle2 size={36} style={{ color: '#27694e', margin: '0 auto' }} />
            <h3 style={{ margin: 0 }}>Import Completed Successfully</h3>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Added <strong>{importSummary.imported}</strong> recruiters to your personal contact list.
              {importSummary.sharedCount > 0 && (
                <> Contributed <strong>{importSummary.sharedCount}</strong> verified recruiters to the shared directory.</>
              )}
            </p>
            <div>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  onClose();
                  setFile(null);
                  setRecords([]);
                  setImportSummary(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
