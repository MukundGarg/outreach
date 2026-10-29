'use client';
import { useState } from 'react';
import { Mail, Sparkles } from 'lucide-react';
import { label } from '@/lib/domain';
import { useDemo } from './demo-provider';
export function Outreach() {
  const { data } = useDemo();
  const [selected, setSelected] = useState(data.contacts[0].id);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const contact = data.contacts.find((c) => c.id === selected)!;
  async function preview() {
    setBusy(true);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'outreach',
          context: 'Generate a deterministic sample outreach preview.',
        }),
      });
      const result = await response.json();
      setMessage(response.ok ? `MOCK AGENT · ${result.data.summary}` : result.error);
    } catch {
      setMessage('Mock agent unavailable. No email was sent.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Conversations open doors.</h1>
          <p className="muted">Thoughtful outreach, with you in control of every word.</p>
        </div>
        <span className="badge">
          <Mail size={13} /> Gmail not connected
        </span>
      </div>
      <div className="notice" style={{ marginBottom: 24 }}>
        Demonstration only. Contacts, sent statuses, and replies are fictional. Sending and
        background follow-ups are disabled.
      </div>
      <div className="grid2">
        <section className="stack" style={{ alignContent: 'start' }}>
          <h2>Recruiter contacts</h2>
          {data.contacts.map((c) => (
            <button
              key={c.id}
              className={`contact ${selected === c.id ? 'selected' : ''}`}
              onClick={() => {
                setSelected(c.id);
                setMessage('');
              }}
            >
              <div className="between">
                <div className="row">
                  <div className="avatar">
                    {c.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <strong>{c.name}</strong>
                    <p className="muted" style={{ margin: '5px 0 0', fontSize: 12 }}>
                      {c.role} · {c.company}
                    </p>
                  </div>
                </div>
                <span className={`badge ${c.status}`}>{label(c.status)}</span>
              </div>
            </button>
          ))}
        </section>
        <section className="card">
          <div className="between">
            <h2 style={{ margin: 0 }}>Draft preview</h2>
            <span className="badge">Sample email</span>
          </div>
          <p className="muted" style={{ marginTop: 22, fontSize: 12 }}>
            To: {contact.email}
            <br />
            Subject: Exploring opportunities at {contact.company}
          </p>
          <div className="email-preview">{contact.draft}</div>
          <div className="notice">
            Planned sample follow-up: {contact.followup}
            <br />
            Reply classification: not enabled · human review required
          </div>
          <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
            <button className="button primary" disabled={busy} onClick={preview}>
              <Sparkles size={15} />
              {busy ? 'Preparing sample…' : 'Run mock agent'}
            </button>
            <button
              className="button"
              onClick={() =>
                setMessage(
                  'Gmail sending is not enabled. No email was sent. A future integration will require explicit approval.',
                )
              }
            >
              Send · not enabled
            </button>
          </div>
          {message && (
            <p role="status" className="notice" style={{ marginTop: 15 }}>
              {message}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
