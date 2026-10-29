'use client';
import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { useDemo } from './demo-provider';
import { nextFollowup } from '@/lib/domain';
export function Settings() {
  const { data, reset } = useDemo();
  const [message, setMessage] = useState('');
  const [days, setDays] = useState(3);
  const [weekends, setWeekends] = useState(true);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>A workspace that works for you.</h1>
          <p className="muted">Your account, connections, and communication preferences.</p>
        </div>
      </div>
      <div className="stack">
        <section className="card">
          <h2>Account information</h2>
          <div className="row">
            <div className="avatar">AM</div>
            <div>
              <strong>{data.profile.name}</strong>
              <p className="muted" style={{ margin: '5px 0' }}>
                {data.profile.email} · Sample account
              </p>
            </div>
          </div>
        </section>
        <div className="grid2">
          <section className="card">
            <h2 className="row">
              <Mail size={19} /> Gmail connection
            </h2>
            <p className="muted">
              Connect your inbox in a future phase to review conversations and approve personalized
              messages.
            </p>
            <button
              className="button"
              onClick={() =>
                setMessage('Gmail OAuth is not enabled. No account access has been requested.')
              }
            >
              Connect Gmail · not enabled
            </button>
          </section>
          <section className="card stack">
            <h2>Follow-up defaults</h2>
            <label className="field">
              Days after initial outreach
              <input
                type="number"
                min="1"
                max="365"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={weekends}
                onChange={(e) => setWeekends(e.target.checked)}
              />{' '}
              Skip weekends
            </label>
            <button
              className="button"
              onClick={() => {
                try {
                  setMessage(
                    `Local scheduling preview: ${nextFollowup(new Date(), days, weekends).toISOString().slice(0, 10)} (UTC). No job was scheduled.`,
                  );
                } catch {
                  setMessage('Choose between 1 and 365 days.');
                }
              }}
            >
              Preview next follow-up date
            </button>
            <p className="muted" style={{ fontSize: 11 }}>
              Preview only. Scheduling defaults are not persisted yet.
            </p>
          </section>
        </div>
        <section className="card">
          <h2 className="row">
            <ShieldCheck size={19} /> Privacy & control
          </h2>
          <p className="muted">
            Demo profile and application edits are stored in session storage in this browser. Resume
            contents are never uploaded here. No Gmail tokens are stored.
          </p>
          <button
            className="button"
            onClick={() => {
              reset();
              setMessage('Local demo data reset. No real account data was affected.');
            }}
          >
            Reset local demo data
          </button>
        </section>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </div>
    </>
  );
}
