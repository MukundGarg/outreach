'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Plus, Search } from 'lucide-react';
import {
  applicationStatuses,
  applicationSchema,
  canTransitionApplication,
  label,
  type ApplicationStatus,
} from '@/lib/domain';
import { useDemo } from './demo-provider';
export function Applications({ initialAdd = false }: { initialAdd?: boolean }) {
  const { data, addApplication } = useDemo();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [show, setShow] = useState(initialAdd);
  const [error, setError] = useState('');
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
          onSubmit={(e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const result = applicationSchema.safeParse(values);
            if (!result.success) {
              setError(result.error.issues[0].message);
              return;
            }
            router.push(`/applications/${addApplication(result.data)}`);
          }}
        >
          <h2>Add a sample opportunity</h2>
          <div className="notice">
            This creates a local draft only. No job application is submitted.
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
          {error && <p role="alert">{error}</p>}
          <div>
            <button type="submit" className="button primary">
              Create demo draft
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
          {filtered.length} sample opportunities · Demo changes are local
        </div>
      </section>
    </>
  );
}
export function ApplicationDetail({ id }: { id: string }) {
  const { data, transition } = useDemo();
  const a = data.applications.find((v) => v.id === id);
  if (!a)
    return (
      <section className="card">
        <h1>Opportunity not found</h1>
        <p>Local drafts are available only in the browser session that created them.</p>
        <Link className="button" href="/applications">
          Back to applications
        </Link>
      </section>
    );
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
            All status updates are simulated. Marking a sample as submitted does not submit a form
            or contact an employer.
          </div>
          <label className="field">
            Move sample to next stage
            <select
              value=""
              onChange={(e) => transition(a.id, e.target.value as ApplicationStatus)}
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
          {a.status === 'closed' && <p className="muted">This sample opportunity is closed.</p>}
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
