'use client';
import { useState, useEffect } from 'react';
import {
  Bot,
  ExternalLink,
  Mail,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { label } from '@/lib/domain';
import type { DifyOutreachIntelligence, ReplyClassification } from '@/lib/ai-schemas';
import { useWorkspace } from './use-workspace';

export function Outreach() {
  const { isDemo, data } = useWorkspace();
  const contacts = data.contacts;
  const [selected, setSelected] = useState(contacts[0]?.id || '');
  const [message, setMessage] = useState('');
  const [generatingDraft, setGeneratingDraft] = useState(false);

  // Gmail OAuth Connection state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [loadingGmail, setLoadingGmail] = useState(!isDemo);

  // Outreach Draft State (Dify Agent 2)
  const [outreachResult, setOutreachResult] = useState<DifyOutreachIntelligence | null>(null);
  const [activeProvider, setActiveProvider] = useState<'dify' | 'gemini' | 'mock' | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [draftApproved, setDraftApproved] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Approved Sending State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sentResult, setSentResult] = useState<{ messageId: string; gmailMessageId: string } | null>(null);

  // Recruiter Reply Classification State (Gemini)
  const [replyInputText, setReplyInputText] = useState('');
  const [classifyingReply, setClassifyingReply] = useState(false);
  const [replyClassification, setReplyClassification] = useState<ReplyClassification | null>(null);
  const [replyError, setReplyError] = useState('');

  const contact = contacts.find((c) => c.id === selected) || contacts[0];

  // Fetch Gmail Connection Status on mount
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
    try {
      const res = await fetch('/api/integrations/gmail/connect');
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to initiate Gmail connection');
      }
      window.location.href = payload.authUrl;
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error connecting to Gmail');
    }
  }

  async function handleDisconnectGmail() {
    setLoadingGmail(true);
    try {
      const res = await fetch('/api/integrations/gmail/disconnect', { method: 'POST' });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setGmailConnected(false);
        setGmailEmail(null);
        setMessage('Gmail account disconnected successfully.');
      } else {
        throw new Error(payload.error || 'Failed to disconnect');
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to disconnect Gmail');
    } finally {
      setLoadingGmail(false);
    }
  }

  async function generateOutreachEmail() {
    if (!contact) return;
    setGeneratingDraft(true);
    setMessage('');
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'outreach_plan',
          contactId: contact.id,
          recruiterContact: {
            name: contact.name,
            role: contact.role,
            company: contact.company,
            email: contact.email,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to generate outreach draft.');
      }
      const draftData: DifyOutreachIntelligence = result.data;
      setOutreachResult(draftData);
      setActiveProvider(result.provider);
      setEditedSubject(draftData.subject || `Exploring opportunities at ${contact.company}`);
      setEditedBody(draftData.email_body || contact.draft || '');
      setDraftApproved(false);
      setMessage(`Draft generated via ${result.provider === 'gemini' ? 'Gemini Degraded Fallback' : result.provider === 'mock' ? 'Demo Mock' : 'Dify Agent 2'}. Review before approval.`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error generating outreach draft.');
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function handleSaveDraft() {
    if (!contact) return;
    setSavingDraft(true);
    setMessage('');
    try {
      const res = await fetch('/api/outreach/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          subject: editedSubject,
          body: editedBody,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to save draft to database.');
      }
      setMessage(isDemo ? 'Draft saved in demo mode.' : 'Email draft saved securely to database.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error saving draft.');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleApproveAndSend() {
    if (!contact || isDemo) return;
    setSendingEmail(true);
    setMessage('');
    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          recipientEmail: contact.email,
          subject: editedSubject,
          body: editedBody,
          approvalConfirmed: true,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Sending failed.');
      }
      setSentResult(payload.data);
      setShowConfirmModal(false);
      setMessage(`Email successfully delivered via Gmail API! Message ID: ${payload.data.gmailMessageId}`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error sending email.');
    } finally {
      setSendingEmail(false);
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
        <div className="row" style={{ gap: 8 }}>
          {isDemo ? (
            <span className="badge">
              <Mail size={13} /> Demo Mode · Sending Disabled
            </span>
          ) : gmailConnected ? (
            <span className="badge" style={{ background: '#eaf4ea', color: '#27694e', borderColor: '#789966' }}>
              <ShieldCheck size={13} /> Connected: {gmailEmail}
            </span>
          ) : (
            <span className="badge">
              <Mail size={13} /> Gmail Not Connected
            </span>
          )}
        </div>
      </div>

      {!isDemo && !gmailConnected && (
        <div className="card between" style={{ background: '#fdfdfb', border: '1px solid #c9d8c5', marginBottom: 20 }}>
          <div>
            <strong>Connect your Google Account</strong>
            <p className="muted" style={{ fontSize: 12, margin: '2px 0 0' }}>
              Authorize ApplyPilot to send recruiter outreach directly from your Gmail address with user-approved confirmation.
            </p>
          </div>
          <button
            type="button"
            className="button primary"
            style={{ fontSize: 12 }}
            disabled={loadingGmail}
            onClick={handleConnectGmail}
          >
            <ExternalLink size={13} /> {loadingGmail ? 'Connecting…' : 'Connect Gmail'}
          </button>
        </div>
      )}

      {!isDemo && gmailConnected && (
        <div className="card between" style={{ background: '#f4f7f0', padding: '10px 16px', marginBottom: 20 }}>
          <div className="row" style={{ fontSize: 12 }}>
            <ShieldCheck size={16} style={{ color: '#27694e' }} />
            <span>Active Gmail Sender: <strong>{gmailEmail}</strong></span>
          </div>
          <button
            type="button"
            className="button"
            style={{ fontSize: 11, color: '#a85649' }}
            disabled={loadingGmail}
            onClick={handleDisconnectGmail}
          >
            <Trash2 size={12} /> Disconnect
          </button>
        </div>
      )}

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
                setSentResult(null);
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
              Paste incoming recruiter message to analyze sentiment, intent, and detect explicit opt-outs.
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
                    Opt-Out Verified: Outreach to this contact is suppressed and sending is blocked.
                  </div>
                )}
              </div>
            )}
          </section>
        </section>

        <section className="card">
          <div className="between">
            <h2 style={{ margin: 0 }}>Draft preview</h2>
            <span className="badge">
              {activeProvider === 'dify'
                ? 'Dify Agent 2 Draft'
                : activeProvider === 'gemini'
                  ? 'Gemini Fallback Draft'
                  : isDemo
                    ? 'Sample email'
                    : 'Draft email'}
            </span>
          </div>

          {contact ? (
            <>
              <p className="muted" style={{ marginTop: 22, fontSize: 12 }}>
                To: <strong>{contact.email}</strong>
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
                      STOP Directive: Dify Agent 2 identified an opt-out. Outreach must not be sent.
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
                      <strong style={{ fontSize: 12 }}>Candidate Approval Required</strong>
                    </div>
                    <label className="check" style={{ fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={draftApproved}
                        onChange={(e) => setDraftApproved(e.target.checked)}
                      />{' '}
                      I have reviewed and approve this recruiter outreach draft.
                    </label>

                    <div className="row" style={{ marginTop: 8, gap: 8 }}>
                      <button
                        type="button"
                        className="button"
                        disabled={savingDraft}
                        onClick={handleSaveDraft}
                      >
                        {savingDraft ? 'Saving…' : 'Save Draft to Database'}
                      </button>

                      {!isDemo && (
                        <button
                          type="button"
                          className="button primary"
                          disabled={!draftApproved || !gmailConnected || outreachResult.recommended_action === 'stop'}
                          onClick={() => setShowConfirmModal(true)}
                        >
                          <Send size={13} /> Approve & Send via Gmail
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="email-preview">{contact.draft || 'Draft content will appear here.'}</div>
              )}

              {sentResult && (
                <div className="notice" style={{ background: '#eaf4ea', borderColor: '#789966', color: '#27694e', marginTop: 12 }}>
                  <ShieldCheck size={16} /> <strong>Email Delivered:</strong> Gmail Message ID {sentResult.gmailMessageId} recorded in database.
                </div>
              )}
            </>
          ) : (
            <p className="muted" style={{ marginTop: 22 }}>
              No recruiter contacts available. Add contacts to preview outreach drafts.
            </p>
          )}

          <div className="row" style={{ marginTop: 20, flexWrap: 'wrap', gap: 10 }}>
            <button
              className="button primary"
              disabled={generatingDraft}
              onClick={generateOutreachEmail}
            >
              <Bot size={15} />
              {generatingDraft ? 'Preparing with Dify…' : 'Generate Recruiter Email (Dify Agent 2)'}
            </button>
          </div>

          {message && (
            <p role="status" className="notice" style={{ marginTop: 15 }}>
              {message}
            </p>
          )}
        </section>
      </div>

      {/* Explicit Final Confirmation Modal for Gmail Sending */}
      {showConfirmModal && contact && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="card stack"
            style={{
              maxWidth: 540,
              width: '100%',
              background: '#fff',
              border: '2px solid #27694e',
              padding: 24,
            }}
          >
            <div className="between">
              <div className="row" style={{ color: '#27694e' }}>
                <ShieldAlert size={20} />
                <h3 style={{ margin: 0 }}>Confirm Final Email Transmission</h3>
              </div>
              <span className="badge">Gmail API</span>
            </div>
            <p style={{ fontSize: 13, margin: '8px 0 12px' }}>
              You are about to transmit a real email from your connected Google account:
            </p>
            <div className="stack" style={{ fontSize: 12, background: '#f5f7f2', padding: 12, borderRadius: 6, gap: 6 }}>
              <div><strong>Sender:</strong> {gmailEmail}</div>
              <div><strong>Recipient:</strong> {contact.name} &lt;{contact.email}&gt;</div>
              <div><strong>Subject:</strong> {editedSubject}</div>
              <div style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto', borderTop: '1px solid #ddd', paddingTop: 6 }}>
                <strong>Message:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '4px 0 0' }}>{editedBody}</pre>
              </div>
            </div>

            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="button"
                disabled={sendingEmail}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                disabled={sendingEmail}
                onClick={handleApproveAndSend}
              >
                <Send size={13} /> {sendingEmail ? 'Sending via Gmail API…' : 'Confirm and Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
