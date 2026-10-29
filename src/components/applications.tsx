'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Bot, CheckCircle2, Plus, Search, ShieldAlert, Sparkles } from 'lucide-react';
import {
  applicationStatuses,
  applicationSchema,
  canTransitionApplication,
  label,
  type ApplicationStatus,
} from '@/lib/domain';
import type { JobAnalysis, DifyApplicationIntelligence } from '@/lib/ai-schemas';
import { useWorkspace } from './use-workspace';

export function Applications({ initialAdd = false }: { initialAdd?: boolean }) {
  const { isDemo, data, addApplication } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [show, setShow] = useState(initialAdd);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const filtered = data.applications.filter(
    (a) =>
      `${a.title} ${a.company} ${a.location}`.toLowerCase().includes(query.toLowerCase()) &&
      (status === 'all' || a.status === status),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Every opportunity, organized.</h1>
          <p className="muted">Your pipeline, from first possibility to your next big yes.</p>
        </div>
        <button className="button primary" onClick={() => setShow(!show)}>
          <Plus size={16} />
          {show ? 'Close form' : 'Add application'}
        </button>
      </div>
      {show && (
        <form
          className="card stack"
          style={{ marginBottom: 22 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const result = applicationSchema.safeParse(values);
            if (!result.success) {
              setError(result.error.issues[0].message);
              return;
            }
            setBusy(true);
            setError('');
            try {
              const newId = await addApplication(result.data);
              router.push(`/applications/${newId}`);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to add application');
              setBusy(false);
            }
          }}
        >
          <h2>{isDemo ? 'Add a sample opportunity' : 'Add an application'}</h2>
          <div className="notice">
            {isDemo
              ? 'This creates a local draft only. No job application is submitted.'
              : 'This records a draft application in your database. No external submission is made.'}
          </div>
          <div className="form-grid">
            {[
              ['title', 'Job title'],
              ['company', 'Company'],
              ['url', 'Job URL · optional'],
              ['location', 'Location · optional'],
            ].map(([key, title]) => (
              <label className="field" key={key}>
                {title}
                <input
                  name={key}
                  type={key === 'url' ? 'url' : 'text'}
                  required={['title', 'company'].includes(key)}
                  maxLength={key === 'url' ? 2000 : 160}
                />
              </label>
            ))}
          </div>
          {error && <p role="alert" className="notice" style={{ color: '#a85649' }}>{error}</p>}
          <div>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'Creating…' : isDemo ? 'Create demo draft' : 'Create draft application'}
            </button>
          </div>
        </form>
      )}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="between" style={{ padding: 20, flexWrap: 'wrap' }}>
          <label className="row" style={{ flex: 1, minWidth: 180 }}>
            <Search size={17} />
            <input
              className="search"
              aria-label="Search applications"
              value={query}
              placeholder="Search roles, companies, locations…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {applicationStatuses.map((v) => (
                <option value={v} key={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Company & role</th>
                <th>Location</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="row">
                      <span className="company-icon">{a.company[0]}</span>
                      <span>
                        <strong>{a.company}</strong>
                        <span className="muted">{a.title}</span>
                      </span>
                    </div>
                  </td>
                  <td className="muted">{a.location || 'Not specified'}</td>
                  <td>
                    <span className={`badge ${a.status}`}>{label(a.status)}</span>
                  </td>
                  <td>
                    <Link className="button" href={`/applications/${a.id}`}>
                      View <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <p className="empty">No opportunities match your filters.</p>}
        <div className="muted" style={{ padding: 18, fontSize: 11 }}>
          {filtered.length} {isDemo ? 'sample opportunities · Demo changes are local' : 'applications in your pipeline'}
        </div>
      </section>
    </>
  );
}

export function ApplicationDetail({ id }: { id: string }) {
  const { isDemo, data, transition } = useWorkspace();
  const [transitionError, setTransitionError] = useState('');
  const [pendingTarget, setPendingTarget] = useState<ApplicationStatus | ''>('');
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // AI Application Intelligence state
  const [customJobDesc, setCustomJobDesc] = useState('');
  const [screeningQuestionsInput, setScreeningQuestionsInput] = useState('');
  const [analyzingJob, setAnalyzingJob] = useState(false);
  const [jobAnalysisError, setJobAnalysisError] = useState('');
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis | null>(null);

  const [preparingApp, setPreparingApp] = useState(false);
  const [appPrepError, setAppPrepError] = useState('');
  const [difyAppResult, setDifyAppResult] = useState<DifyApplicationIntelligence | null>(null);
  const [editedAnswers, setEditedAnswers] = useState<Record<string, string>>({});
  const [prepApproved, setPrepApproved] = useState(false);
  const [savingPrep, setSavingPrep] = useState(false);
  const [prepSaveMessage, setPrepSaveMessage] = useState('');

  const a = data.applications.find((v) => v.id === id);

  if (!a)
    return (
      <section className="card">
        <h1>Opportunity not found</h1>
        <p>
          {isDemo
            ? 'Local drafts are available only in the browser session that created them.'
            : 'The requested application could not be found in your database.'}
        </p>
        <Link className="button" href="/applications">
          Back to applications
        </Link>
      </section>
    );

  const requiresApproval = (status: ApplicationStatus) =>
    ['submitted', 'awaiting_response', 'under_review', 'interview', 'offer'].includes(status);

  const executeTransition = async (target: ApplicationStatus, approved = false) => {
    setTransitioning(true);
    setTransitionError('');
    try {
      await transition(a.id, target, { approved });
      setPendingTarget('');
      setApprovalConfirmed(false);
    } catch (err: unknown) {
      setTransitionError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  };

  return (
    <>
      <Link href="/applications" className="row muted" style={{ marginBottom: 25 }}>
        <ArrowLeft size={15} /> All applications
      </Link>
      <div className="page-head">
        <div>
          <span className="eyebrow muted">{a.company}</span>
          <h1 style={{ marginTop: 12 }}>{a.title}</h1>
          <p className="muted">
            {a.location} · Added {a.createdAt.slice(0, 10)}
          </p>
        </div>
        <span className={`badge ${a.status}`}>{label(a.status)}</span>
      </div>
      <div className="grid2">
        <section className="card stack">
          <h2>Application workspace</h2>
          {a.url && (
            <a className="button" href={a.url} target="_blank" rel="noopener noreferrer">
              Open job posting <ArrowUpRight size={15} />
            </a>
          )}
          <div className="notice">
            {isDemo
              ? 'All status updates are simulated. Marking a sample as submitted does not submit a form or contact an employer.'
              : 'Status transitions update your database and record an immutable audit event. Moving to submitted or active pipeline requires explicit user approval.'}
          </div>

          <label className="field">
            Move {isDemo ? 'sample' : 'application'} to next stage
            <select
              value={pendingTarget || ''}
              disabled={transitioning}
              onChange={(e) => {
                const target = e.target.value as ApplicationStatus;
                if (!target) return;
                if (!isDemo && requiresApproval(target)) {
                  setPendingTarget(target);
                } else {
                  executeTransition(target);
                }
              }}
            >
              <option value="" disabled>
                Select a valid next status
              </option>
              {applicationStatuses
                .filter((v) => canTransitionApplication(a.status, v))
                .map((v) => (
                  <option value={v} key={v}>
                    {label(v)}
                  </option>
                ))}
            </select>
          </label>

          {/* Explicit User Approval Confirmation for Task E */}
          {!isDemo && pendingTarget && requiresApproval(pendingTarget) && (
            <div
              className="card stack"
              style={{
                border: '1px solid #789966',
                background: '#f4f7f0',
                padding: '16px',
                marginTop: '12px',
              }}
            >
              <div className="row" style={{ color: '#27694e' }}>
                <ShieldAlert size={18} />
                <strong>Explicit User Review & Approval Required</strong>
              </div>
              <p style={{ fontSize: 12, margin: '4px 0 8px' }}>
                You are transitioning this application to <strong>{label(pendingTarget)}</strong>.
                ApplyPilot requires explicit candidate confirmation before recording an approved submission status.
              </p>
              <label className="check" style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={approvalConfirmed}
                  onChange={(e) => setApprovalConfirmed(e.target.checked)}
                />{' '}
                I have reviewed and approve moving this application to {label(pendingTarget)}.
              </label>
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  className="button primary"
                  disabled={!approvalConfirmed || transitioning}
                  onClick={() => executeTransition(pendingTarget, true)}
                >
                  {transitioning ? 'Saving approval…' : `Confirm transition to ${label(pendingTarget)}`}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={transitioning}
                  onClick={() => {
                    setPendingTarget('');
                    setApprovalConfirmed(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {transitionError && (
            <p className="notice" role="alert" style={{ color: '#a85649' }}>
              {transitionError}
            </p>
          )}

          {a.status === 'closed' && (
            <p className="muted">This {isDemo ? 'sample opportunity' : 'application'} is closed.</p>
          )}
        </section>

        {/* AI Job Analysis & Application Intelligence Section */}
        <section className="card stack">
          <div className="between">
            <h2>AI Application Intelligence</h2>
            <span className="badge">Gemini + Dify Hybrid</span>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Run fast job description analysis with Gemini, or prepare complex form mappings and screening question answers with Dify Agent 1. All recommendations require your explicit review.
          </p>

          <label className="field">
            Job Description / Requirements Text
            <textarea
              rows={4}
              value={customJobDesc}
              placeholder="Paste the job description or role requirements here if not stored…"
              onChange={(e) => setCustomJobDesc(e.target.value)}
            />
          </label>

          <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              className="button"
              style={{ borderColor: '#789966', color: '#27694e' }}
              disabled={analyzingJob}
              onClick={async () => {
                const textToAnalyze = customJobDesc.trim() || `${a.title} at ${a.company}. ${a.location || ''}`;
                setAnalyzingJob(true);
                setJobAnalysisError('');
                try {
                  const res = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      task: 'job_analyze',
                      jobDescription: textToAnalyze,
                      candidateProfile: data.profile,
                      applicationId: a.id,
                    }),
                  });
                  const payload = await res.json();
                  if (!res.ok || !payload.ok) {
                    throw new Error(payload.error || 'Failed to analyze job.');
                  }
                  setJobAnalysis(payload.data);
                } catch (err: unknown) {
                  setJobAnalysisError(err instanceof Error ? err.message : 'Job analysis failed.');
                } finally {
                  setAnalyzingJob(false);
                }
              }}
            >
              <Sparkles size={14} /> {analyzingJob ? 'Analyzing with Gemini…' : 'Analyze Job (Gemini)'}
            </button>

            <button
              type="button"
              className="button primary"
              disabled={preparingApp}
              onClick={async () => {
                const textToAnalyze = customJobDesc.trim() || `${a.title} at ${a.company}. ${a.location || ''}`;
                setPreparingApp(true);
                setAppPrepError('');
                try {
                  const res = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      task: 'complex_application',
                      jobDescription: textToAnalyze,
                      candidateProfile: data.profile,
                      screeningQuestions: screeningQuestionsInput ? screeningQuestionsInput.split('\n').filter(Boolean) : undefined,
                      applicationId: a.id,
                      allowDegradedFallback: true,
                    }),
                  });
                  const payload = await res.json();
                  if (!res.ok || !payload.ok) {
                    throw new Error(payload.error || 'Application preparation failed.');
                  }
                  setDifyAppResult(payload.data);
                  // Initialize editable answers
                  if (payload.data?.screening_answers) {
                    const initialAnswers: Record<string, string> = {};
                    payload.data.screening_answers.forEach((item: { question: string; answer: string }) => {
                      initialAnswers[item.question] = item.answer;
                    });
                    setEditedAnswers(initialAnswers);
                  }
                } catch (err: unknown) {
                  setAppPrepError(err instanceof Error ? err.message : 'Dify preparation failed.');
                } finally {
                  setPreparingApp(false);
                }
              }}
            >
              <Bot size={14} /> {preparingApp ? 'Preparing with Dify Agent…' : 'Prepare Application (Dify Agent 1)'}
            </button>
          </div>

          <label className="field" style={{ marginTop: 8 }}>
            Screening Questions (one per line, optional)
            <textarea
              rows={2}
              value={screeningQuestionsInput}
              placeholder="e.g. Why are you interested in this role?&#10;How many years of TypeScript experience do you have?"
              onChange={(e) => setScreeningQuestionsInput(e.target.value)}
            />
          </label>

          {jobAnalysisError && (
            <p className="notice" role="alert" style={{ color: '#a85649' }}>
              {jobAnalysisError}
            </p>
          )}

          {appPrepError && (
            <p className="notice" role="alert" style={{ color: '#a85649' }}>
              {appPrepError}
            </p>
          )}

          {/* Gemini Job Analysis Preview */}
          {jobAnalysis && (
            <div
              className="card stack"
              style={{
                background: '#f4f7f0',
                border: '1px solid #789966',
                padding: '16px',
                marginTop: '12px',
              }}
            >
              <div className="between">
                <div className="row" style={{ color: '#27694e' }}>
                  <Sparkles size={16} />
                  <strong>Gemini Match Score: {jobAnalysis.match_score}%</strong>
                </div>
                <span className="badge">Role Level: {jobAnalysis.role_level}</span>
              </div>
              <p style={{ fontSize: 13, margin: '6px 0' }}>{jobAnalysis.job_summary}</p>
              
              <div className="grid2" style={{ gap: 12, marginTop: 8 }}>
                <div>
                  <strong style={{ fontSize: 12, color: '#27694e' }}>Matched Requirements:</strong>
                  <ul style={{ fontSize: 12, paddingLeft: 18, margin: '4px 0' }}>
                    {jobAnalysis.matched_requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong style={{ fontSize: 12, color: '#a85649' }}>Missing / Skills to Highlight:</strong>
                  <ul style={{ fontSize: 12, paddingLeft: 18, margin: '4px 0' }}>
                    {jobAnalysis.missing_requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {jobAnalysis.key_technologies?.length > 0 && (
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  <strong>Key Technologies:</strong> {jobAnalysis.key_technologies.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Dify Agent 1 Output Contract & Review */}
          {difyAppResult && (
            <div
              className="card stack"
              style={{
                background: '#fdfdfb',
                border: '1px solid #27694e',
                padding: '16px',
                marginTop: '12px',
              }}
            >
              <div className="between">
                <div className="row" style={{ color: '#27694e' }}>
                  <CheckCircle2 size={16} />
                  <strong>Dify Application Intelligence Draft</strong>
                </div>
                <span className="badge">{difyAppResult.ready_for_review ? 'Ready for Human Review' : 'Draft Generated'}</span>
              </div>
              <p style={{ fontSize: 12, color: '#555' }}>
                Next Recommended Action: <em>{difyAppResult.recommended_next_action}</em>
              </p>

              {difyAppResult.field_mappings?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 13 }}>Form Field Mappings:</strong>
                  <table style={{ width: '100%', fontSize: 12, marginTop: 6, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                        <th style={{ padding: '4px 6px' }}>Field</th>
                        <th style={{ padding: '4px 6px' }}>Proposed Value</th>
                        <th style={{ padding: '4px 6px' }}>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {difyAppResult.field_mappings.map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600 }}>{m.field_name}</td>
                          <td style={{ padding: '4px 6px' }}>{m.proposed_value}</td>
                          <td style={{ padding: '4px 6px', color: '#666' }}>{m.evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {difyAppResult.screening_answers?.length > 0 && (
                <div style={{ marginTop: 12 }} className="stack">
                  <strong style={{ fontSize: 13 }}>Screening Questions & Proposed Answers (Editable):</strong>
                  {difyAppResult.screening_answers.map((sa, idx) => (
                    <div key={idx} className="field" style={{ background: '#f5f7f2', padding: 10, borderRadius: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>Q: {sa.question}</span>
                      <textarea
                        rows={2}
                        style={{ marginTop: 4, fontSize: 12 }}
                        value={editedAnswers[sa.question] ?? sa.answer}
                        onChange={(e) =>
                          setEditedAnswers((prev) => ({ ...prev, [sa.question]: e.target.value }))
                        }
                      />
                      <small className="muted" style={{ fontSize: 10 }}>Evidence: {sa.evidence}</small>
                    </div>
                  ))}
                </div>
              )}

              {difyAppResult.unresolved_questions?.length > 0 && (
                <div style={{ marginTop: 8, color: '#a85649' }}>
                  <strong style={{ fontSize: 12 }}>Unresolved Questions:</strong>
                  <ul style={{ fontSize: 12, paddingLeft: 18, margin: '4px 0' }}>
                    {difyAppResult.unresolved_questions.map((uq, i) => (
                      <li key={i}>{uq}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                className="card"
                style={{
                  background: '#f4f7f0',
                  padding: 12,
                  marginTop: 12,
                  border: '1px solid #789966',
                }}
              >
                <div className="row" style={{ color: '#27694e' }}>
                  <ShieldAlert size={16} />
                  <strong style={{ fontSize: 13 }}>Human Review & Approval</strong>
                </div>
                <p style={{ fontSize: 11, margin: '4px 0 8px' }}>
                  Saving reviewed answers saves your candidate preparation to the database. It does NOT submit this application to any external company or third-party service.
                </p>
                <label className="check" style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={prepApproved}
                    onChange={(e) => setPrepApproved(e.target.checked)}
                  />{' '}
                  I have reviewed all proposed fields and answers.
                </label>
                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button primary"
                    disabled={!prepApproved || savingPrep}
                    onClick={async () => {
                      setSavingPrep(true);
                      setPrepSaveMessage('');
                      try {
                        // Persist approval event
                        await transition(a.id, a.status, { approved: true });
                        setPrepSaveMessage('Reviewed application preparation saved to workspace.');
                      } catch (err: unknown) {
                        setPrepSaveMessage(err instanceof Error ? err.message : 'Save failed.');
                      } finally {
                        setSavingPrep(false);
                      }
                    }}
                  >
                    {savingPrep ? 'Saving…' : 'Save Reviewed Application Draft'}
                  </button>
                  {prepSaveMessage && (
                    <span className="success" style={{ fontSize: 12 }}>{prepSaveMessage}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Activity history</h2>
          <div className="timeline">
            {a.events.map((event) => (
              <div key={event.id}>
                <strong style={{ fontSize: 13 }}>{event.description}</strong>
                <p className="muted" style={{ fontSize: 11, marginTop: 7 }}>
                  {event.at.slice(0, 10)} · {event.to && label(event.to)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

