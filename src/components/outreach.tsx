'use client';
import { useState } from 'react';
import { Bot, CheckCircle2, Mail, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';
import { label } from '@/lib/domain';
import type { DifyOutreachIntelligence, ReplyClassification } from '@/lib/ai-schemas';
import { useWorkspace } from './use-workspace';

export function Outreach() {
  const { isDemo, data } = useWorkspace();
  const contacts = data.contacts;
  const [selected, setSelected] = useState(contacts[0]?.id || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Outreach Draft State (Dify Agent 2)
  const [outreachResult, setOutreachResult] = useState<DifyOutreachIntelligence | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [draftApproved, setDraftApproved] = useState(false);

  // Recruiter Reply Classification State (Gemini)
  const [replyInputText, setReplyInputText] = useState('');
  const [classifyingReply, setClassifyingReply] = useState(false);
  const [replyClassification, setReplyClassification] = useState<ReplyClassification | null>(null);
  const [replyError, setReplyError] = useState('');

  const contact = contacts.find((c) => c.id === selected) || contacts[0];

  async function generateOutreachEmail() {
    if (!contact) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'outreach_plan',
          recruiterContact: {
            name: contact.name,
            role: contact.role,
            company: contact.company,
            email: contact.email,
          },
          candidateProfile: data.profile,
          jobApplication: data.applications.find((app) => app.company.toLowerCase() === contact.company.toLowerCase()) || {
            company: contact.company,
            title: contact.role,
          },
          allowDegradedFallback: true,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to generate outreach draft.');
      }
      const draftData: DifyOutreachIntelligence = result.data;
      setOutreachResult(draftData);
      setEditedSubject(draftData.subject || `Exploring opportunities at ${contact.company}`);
      setEditedBody(draftData.email_body || contact.draft || '');
      setDraftApproved(false);
      setMessage(`Draft prepared (${result.provider === 'gemini' ? 'Gemini Degraded Mode' : 'Dify Agent 2'}). Review and edit before saving.`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error generating outreach draft.');
    } finally {
      setBusy(false);
    }
  }

  async function classifyRecruiterReply() {
    if (!replyInputText.trim()) {
      setReplyError('Please paste the recruiter message text to classify.');
      return;
    }
    setClassifyingReply(true);
    setReplyError('');
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'reply_classify',
          replyText: replyInputText.trim(),
          candidateProfile: data.profile,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to classify recruiter reply.');
      }
      setReplyClassification(result.data);
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : 'Classification failed.');
    } finally {
      setClassifyingReply(false);
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
          <Mail size={13} /> Gmail not connected · Draft mode only
        </span>
      </div>
      <div className="notice" style={{ marginBottom: 24 }}>
        Outreach Intelligence creates personalized candidate drafts. Sending and background automation are disabled until authorized by the user.
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
                setOutreachResult(null);
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

          {/* Gemini Recruiter Reply Classification Panel */}
          <section className="card stack" style={{ marginTop: 12 }}>
            <div className="row" style={{ color: '#27694e' }}>
              <MessageSquare size={16} />
              <strong style={{ fontSize: 13 }}>Recruiter Reply Classification (Gemini)</strong>
            </div>
            <p className="muted" style={{ fontSize: 11, margin: 0 }}>
              Paste incoming message text to analyze sentiment, intent, and suggested next steps without connecting an inbox.
            </p>
            <textarea
              rows={3}
              value={replyInputText}
              placeholder="Paste recruiter email or message here…"
              onChange={(e) => setReplyInputText(e.target.value)}
              style={{ fontSize: 12 }}
            />
            <div>
              <button
                type="button"
                className="button"
                style={{ fontSize: 12, borderColor: '#789966', color: '#27694e' }}
                disabled={classifyingReply}
                onClick={classifyRecruiterReply}
              >
                <Sparkles size={13} /> {classifyingReply ? 'Classifying with Gemini…' : 'Classify Message'}
              </button>
            </div>

            {replyError && (
              <p className="notice" role="alert" style={{ color: '#a85649', fontSize: 12 }}>
                {replyError}
              </p>
            )}

            {replyClassification && (
              <div
                className="card stack"
                style={{
                  background: replyClassification.classification === 'opt_out' ? '#fff5f5' : '#f4f7f0',
                  border: replyClassification.classification === 'opt_out' ? '1px solid #d32f2f' : '1px solid #789966',
                  padding: 12,
                }}
              >
                <div className="between">
                  <span className={`badge ${replyClassification.classification === 'opt_out' ? 'closed' : 'under_review'}`}>
                    Category: {replyClassification.classification.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11 }} className="muted">
                    Confidence: {Math.round(replyClassification.confidence * 100)}%
                  </span>
                </div>
                <p style={{ fontSize: 12, margin: '4px 0' }}>
                  <strong>Summary:</strong> {replyClassification.summary}
                </p>
                <div style={{ fontSize: 11, color: '#555' }}>
                  <strong>Suggested Action:</strong> {replyClassification.suggested_action}
                </div>
                {replyClassification.evidence && (
                  <div style={{ fontSize: 11, color: '#777' }}>
                    <strong>Evidence:</strong> {replyClassification.evidence}
                  </div>
                )}
                {replyClassification.classification === 'opt_out' && (
                  <div className="notice" style={{ color: '#d32f2f', fontWeight: 600, fontSize: 11 }}>
                    Contact Opt-Out Detected: Future outreach to this recruiter must be suppressed.
                  </div>
                )}
              </div>
            )}
          </section>
        </section>

        <section className="card">
          <div className="between">
            <h2 style={{ margin: 0 }}>Draft preview</h2>
            <span className="badge">{isDemo ? 'Sample email' : 'Draft email'}</span>
          </div>
          {contact ? (
            <>
              <p className="muted" style={{ marginTop: 22, fontSize: 12 }}>
                To: {contact.email}
                <br />
                Subject: {editedSubject || `Exploring opportunities at ${contact.company}`}
              </p>

              {outreachResult ? (
                <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                  <label className="field">
                    Subject Line (Editable)
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Email Body (Editable)
                    <textarea
                      rows={8}
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                    />
                  </label>

                  {outreachResult.personalization_evidence?.length > 0 && (
                    <div style={{ fontSize: 11, color: '#555' }}>
                      <strong>Personalization Evidence:</strong>
                      <ul style={{ paddingLeft: 16, margin: '2px 0' }}>
                        {outreachResult.personalization_evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {outreachResult.recommended_action === 'stop' && (
                    <div className="notice" style={{ color: '#d32f2f', fontWeight: 600 }}>
                      Recommendation: STOP outreach to this contact. Do not send further messages.
                    </div>
                  )}

                  <div
                    className="card stack"
                    style={{
                      background: '#f4f7f0',
                      border: '1px solid #789966',
                      padding: 12,
                      marginTop: 8,
                    }}
                  >
                    <div className="row" style={{ color: '#27694e' }}>
                      <ShieldAlert size={15} />
                      <strong style={{ fontSize: 12 }}>Human Approval Required</strong>
                    </div>
                    <label className="check" style={{ fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={draftApproved}
                        onChange={(e) => setDraftApproved(e.target.checked)}
                      />{' '}
                      I have reviewed and approve this recruiter outreach draft.
                    </label>
                    <div className="row" style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="button primary"
                        disabled={!draftApproved}
                        onClick={() => {
                          setMessage('Outreach draft confirmed and saved locally. Email sending remains disabled.');
                        }}
                      >
                        <CheckCircle2 size={13} /> Approve Draft
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="email-preview">{contact.draft || 'Draft content will appear here.'}</div>
              )}

              <div className="notice" style={{ marginTop: 12 }}>
                Planned follow-up delay: {outreachResult?.suggested_delay_business_days ? `${outreachResult.suggested_delay_business_days} business days` : contact.followup || '3 business days'}
                <br />
                Sending capability: Disabled in this milestone · explicit candidate approval required
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 22 }}>
              No recruiter contacts available. Add contacts to preview outreach drafts.
            </p>
          )}

          <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
            <button className="button primary" disabled={busy} onClick={generateOutreachEmail}>
              <Bot size={15} />
              {busy ? 'Preparing with AI…' : 'Generate Recruiter Email (Dify Agent 2)'}
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
