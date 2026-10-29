'use client';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  Mail,
  MessageCircle,
  Plus,
  Sparkles,
  Video,
} from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useDemo } from './demo-provider';
import { label } from '@/lib/domain';
export function Dashboard() {
  const { data } = useDemo();
  const apps = data.applications;
  const submitted = apps.filter((a) =>
    ['submitted', 'awaiting_response', 'under_review', 'interview', 'offer', 'rejected'].includes(
      a.status,
    ),
  ).length;
  const stats = [
    ['Total applications', apps.length, BriefcaseBusiness],
    ['Submitted', submitted, Check],
    ['Recruiter emails', 2, Mail],
    ['Replies received', 1, MessageCircle],
    ['Interviews', apps.filter((a) => a.status === 'interview').length, Video],
    ['Offers', apps.filter((a) => a.status === 'offer').length, Sparkles],
  ] as const;
  const chart = [
    ['Draft', 'draft'],
    ['Review', 'ready_for_review'],
    ['Submitted', 'submitted'],
    ['Waiting', 'awaiting_response'],
    ['In review', 'under_review'],
    ['Interview', 'interview'],
    ['Offer', 'offer'],
  ].map(([name, status]) => ({ name, count: apps.filter((a) => a.status === status).length }));
  function exportData() {
    const blob = new Blob([JSON.stringify({ sampleData: true, applications: apps }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applypilot-demo-applications.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow muted">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1 style={{ margin: '12px 0 0' }}>
            A little progress, every day<span style={{ color: '#6c8a58' }}>.</span>
          </h1>
          <p className="muted">
            Welcome back, {data.profile.name.split(' ')[0]}. Let’s keep your momentum going.
          </p>
        </div>
        <Link href="/applications?add=true" className="button primary">
          <Plus size={16} /> Add application
        </Link>
      </div>
      <div className="hero-note">
        <div className="row">
          <div className="brand-icon" style={{ background: '#d7e2c9', color: '#567143' }}>
            <Sparkles size={19} />
          </div>
          <div>
            <h2>You’ve got opportunities ahead.</h2>
            <p>Review your next application and make every conversation count.</p>
          </div>
        </div>
        <Link href="/applications" className="button" style={{ fontSize: 11 }}>
          View your pipeline <ArrowRight size={14} />
        </Link>
      </div>
      <section className="stats">
        {stats.map(([title, value, Icon]) => (
          <div className="card stat" key={title}>
            <div className="between">
              <span className="caption">{title}</span>
              <Icon size={14} color="#809174" />
            </div>
            <div className="value">{String(value).padStart(2, '0')}</div>
            <span className="delta">
              {title === 'Recruiter emails' || title === 'Replies received'
                ? 'Historical sample only'
                : 'In your sample pipeline'}
            </span>
          </div>
        ))}
      </section>
      <div className="dashboard-columns">
        <div className="stack">
          <section className="card">
            <div className="between section-title">
              <div>
                <h2>Application pipeline</h2>
                <p className="muted" style={{ fontSize: 11, margin: '7px 0 0' }}>
                  Every opportunity, a step forward.
                </p>
              </div>
              <span className="badge">Sample snapshot</span>
            </div>
            <div
              className="chart"
              role="img"
              aria-label="Sample application counts by pipeline status"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -28, right: 5, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e6ebdf" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#82907b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#82907b' }}
                  />
                  <Tooltip cursor={{ fill: '#f1f5ec' }} />
                  <Bar
                    dataKey="count"
                    isAnimationActive={false}
                    name="Applications"
                    fill="#789966"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="between" style={{ padding: '23px 24px' }}>
              <h2 style={{ margin: 0 }}>Recent applications</h2>
              <Link href="/applications" className="row" style={{ fontSize: 11, color: '#66805a' }}>
                View all <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Company & role</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {apps.slice(0, 4).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/applications/${a.id}`} className="row">
                          <span className="company-icon">{a.company[0]}</span>
                          <span>
                            <strong>{a.company}</strong>
                            <span className="muted">{a.title}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${a.status}`}>{label(a.status)}</span>
                      </td>
                      <td className="muted">
                        {new Date(a.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'UTC',
                        })}
                      </td>
                      <td>
                        <Link href={`/applications/${a.id}`} aria-label={`Open ${a.company}`}>
                          <ArrowUpRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <div className="between section-title">
              <h2>Recent activity</h2>
              <span className="badge">Sample</span>
            </div>
            {apps.slice(0, 4).map((a, i) => (
              <div className="activity-item" key={a.id}>
                <span className="activity-dot">
                  {i === 0 ? <Video size={14} /> : <Check size={14} />}
                </span>
                <div>
                  <p>
                    <strong>{a.company}</strong> · {label(a.status)}
                  </p>
                  <small>{a.title} · sample event</small>
                </div>
              </div>
            ))}
          </section>
          <section className="card">
            <div className="between section-title">
              <h2>Upcoming follow-ups</h2>
              <Clock3 size={17} color="#839572" />
            </div>
            <p className="muted" style={{ fontSize: 11 }}>
              Sample plans · no emails scheduled
            </p>
            {data.contacts.slice(1).map((c) => (
              <Link href="/outreach" className="followup" style={{ display: 'block' }} key={c.id}>
                <div className="between">
                  <strong style={{ fontSize: 12 }}>{c.name}</strong>
                  <ArrowUpRight size={13} />
                </div>
                <p className="muted">
                  {c.company} · {c.followup}
                </p>
              </Link>
            ))}
            <Link href="/settings" className="row muted" style={{ fontSize: 10, marginTop: 17 }}>
              <Check size={12} /> Weekend skipping is on by default
            </Link>
          </section>
          <button className="button" onClick={exportData}>
            <ArrowDownToLine size={15} /> Export sample applications
          </button>
        </div>
      </div>
    </>
  );
}
