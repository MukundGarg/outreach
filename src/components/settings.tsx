'use client';
import { useState, useEffect } from 'react';
import { Mail, LogOut, ShieldCheck, ExternalLink, Trash2 } from 'lucide-react';
import { useWorkspace } from './use-workspace';
import { nextFollowup } from '@/lib/domain';

export function Settings() {
  const { isDemo, data, resetDemo } = useWorkspace();
  const [message, setMessage] = useState('');
  const [days, setDays] = useState(3);
  const [weekends, setWeekends] = useState(true);

  // Gmail connection state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [loadingGmail, setLoadingGmail] = useState(!isDemo);
  const [gmailError, setGmailError] = useState('');

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetch('/api/integrations/gmail/status')
      .then((r) => r.json())
      .then((payload) => {
        if (!cancelled && payload.ok && payload.data) {
          setGmailConnected(payload.data.connected);
          setGmailEmail(payload.data.email);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingGmail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  async function handleConnectGmail() {
    setGmailError('');
    if (isDemo) {
      setMessage('Gmail connection is not available in demo mode. Please sign in with an authenticated account.');
      return;
    }
    setLoadingGmail(true);
    try {
      const res = await fetch('/api/integrations/gmail/connect');
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to initiate Gmail connection');
      }
      window.location.href = payload.authUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error connecting to Gmail';
      setGmailError(msg);
      setMessage(msg);
      setLoadingGmail(false);
    }
  }

  async function handleDisconnectGmail() {
    setGmailError('');
    setLoadingGmail(true);
    try {
      const res = await fetch('/api/integrations/gmail/disconnect', { method: 'POST' });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setGmailConnected(false);
        setGmailEmail(null);
        setMessage('Gmail account disconnected successfully.');
      } else {
        throw new Error(payload.error || 'Failed to disconnect Gmail');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect Gmail';
      setGmailError(msg);
      setMessage(msg);
    } finally {
      setLoadingGmail(false);
    }
  }

  const initials = data.profile.name
    ? data.profile.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AP';
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
          <div className="between">
            <div className="row">
              <div className="avatar">{initials}</div>
              <div>
                <strong>{data.profile.name || (isDemo ? 'Alex Morgan' : 'Your Account')}</strong>
                <p className="muted" style={{ margin: '5px 0' }}>
                  {data.profile.email || (isDemo ? 'alex.morgan@example.com' : 'Authenticated user')} ·{' '}
                  {isDemo ? 'Sample account' : 'Supabase authenticated'}
                </p>
              </div>
            </div>
            {!isDemo && (
              <form action="/auth/logout" method="post">
                <button type="submit" className="button" style={{ fontSize: 12 }}>
                  <LogOut size={13} /> Sign out
                </button>
              </form>
            )}
          </div>
        </section>
        <div className="grid2">
          <section className="card stack">
            <div className="between">
              <h2 className="row" style={{ margin: 0 }}>
                <Mail size={19} /> Gmail connection
              </h2>
              {gmailConnected && (
                <span className="badge submitted" style={{ fontSize: 11 }}>
                  <ShieldCheck size={12} style={{ marginRight: 3 }} /> Connected
                </span>
              )}
            </div>
            <p className="muted" style={{ margin: '6px 0 10px', fontSize: 13 }}>
              Connect your Google account to send verified, user-approved recruiter outreach directly
              from your email. This integration uses limited sending and identity verification scopes
              and does not read your personal inbox.
            </p>

            {gmailError && (
              <div className="notice" style={{ color: '#a85649', fontSize: 12 }}>
                {gmailError}
              </div>
            )}

            {isDemo ? (
              <div className="notice" style={{ fontSize: 12 }}>
                Gmail sending is disabled in demo mode. Sign in to an authenticated account to connect your Gmail sender.
              </div>
            ) : gmailConnected ? (
              <div
                className="card between"
                style={{
                  background: '#f4f7f0',
                  border: '1px solid #789966',
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: 12 }}>
                  <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Active Sender Address
                  </div>
                  <strong>{gmailEmail || 'Connected Google Account'}</strong>
                </div>
                <button
                  type="button"
                  className="button"
                  style={{ fontSize: 11, color: '#a85649' }}
                  disabled={loadingGmail}
                  onClick={handleDisconnectGmail}
                >
                  <Trash2 size={12} /> {loadingGmail ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  className="button primary"
                  disabled={loadingGmail}
                  onClick={handleConnectGmail}
                  style={{ fontSize: 13 }}
                >
                  <ExternalLink size={14} /> {loadingGmail ? 'Connecting…' : 'Connect Gmail'}
                </button>
              </div>
            )}
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
            {isDemo
              ? 'Demo profile and application edits are stored in session storage in this browser. Resume contents are never uploaded here. No Gmail tokens are stored.'
              : 'Your profile, job pipeline, and uploaded resumes are securely isolated with Supabase Row Level Security. Data is never shared across users.'}
          </p>
          {isDemo && resetDemo && (
            <button
              className="button"
              onClick={() => {
                resetDemo();
                setMessage('Local demo data reset. No real account data was affected.');
              }}
            >
              Reset local demo data
            </button>
          )}
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
