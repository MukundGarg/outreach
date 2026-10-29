'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Plus, Search, ShieldAlert } from 'lucide-react';
import {
  applicationStatuses,
  applicationSchema,
  canTransitionApplication,
  label,
  type ApplicationStatus,
} from '@/lib/domain';
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

