'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  Pause,
  Play,
  MailCheck,
  MessageSquare,
  Settings,
} from 'lucide-react';
import type { RecruiterContact } from '@/lib/domain';

interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface FollowupTimelineProps {
  contact: RecruiterContact;
  isDemo?: boolean;
  onRefresh?: () => Promise<void>;
}

export function FollowupTimeline({ contact, isDemo, onRefresh }: FollowupTimelineProps) {
  const [remoteActivities, setRemoteActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [demoStatusOverride, setDemoStatusOverride] = useState<string | null>(null);

  // Follow-up Config Modal / Form State
  const [showConfig, setShowConfig] = useState(false);
  const [intervalDays, setIntervalDays] = useState(3);
  const [skipWeekends, setSkipWeekends] = useState(contact.autoSendFollowups ?? true);
  const [maxFollowups, setMaxFollowups] = useState(contact.maxFollowups ?? 3);
  const [autoSend, setAutoSend] = useState(contact.autoSendFollowups ?? false);

  const campaignId = contact.campaignId;
  const currentStatus = demoStatusOverride || contact.status;

  // Build demo activities using useMemo to avoid synchronous setState inside an effect
  const demoActivities = useMemo<ActivityItem[]>(() => {
    return [
      {
        id: 'demo-act-1',
        activity_type: 'initial_sent',
        title: `Initial Outreach Sent: ${contact.subject || 'Exploring opportunities'}`,
        details: { recipient_email: contact.email },
        created_at: contact.initialSentAt || '2026-10-30T10:00:00Z',
      },
      ...(currentStatus === 'replied'
        ? [
            {
              id: 'demo-act-2',
              activity_type: 'reply_received',
              title: 'Recruiter Reply Received',
              details: {
                classification: contact.replyClassification || 'positive_interest',
                summary: 'Thanks for reaching out! Let us schedule a chat next week.',
              },
              created_at: '2026-11-02T14:30:00Z',
            },
            {
              id: 'demo-act-3',
              activity_type: 'followup_cancelled',
              title: 'Pending Follow-ups Cancelled Automatically',
              details: { reason: 'Recruiter reply received' },
              created_at: '2026-11-02T14:30:05Z',
            },
          ]
        : currentStatus === 'paused'
        ? [
            {
              id: 'demo-act-4',
              activity_type: 'followup_paused',
              title: 'Follow-ups Paused by Candidate',
              details: { paused_by_user: true },
              created_at: '2026-11-01T09:00:00Z',
            },
          ]
        : [
            {
              id: 'demo-act-5',
              activity_type: 'followup_scheduled',
              title: 'Follow-up #1 Scheduled',
              details: { scheduled_at: contact.nextFollowupAt || '2026-11-05T10:00:00Z' },
              created_at: '2026-10-30T10:01:00Z',
            },
          ]),
    ];
  }, [contact.subject, contact.email, contact.initialSentAt, contact.replyClassification, contact.nextFollowupAt, currentStatus]);

  // Fetch real activities from API in production mode
  useEffect(() => {
    if (!campaignId || isDemo) return;

    let isMounted = true;
    async function loadActivities() {
      setLoading(true);
      try {
        const res = await fetch(`/api/outreach/campaigns?campaignId=${encodeURIComponent(campaignId!)}`);
        const json = await res.json();
        if (isMounted && json.ok && json.data) {
          setRemoteActivities(json.data);
        }
      } catch {
        // Handle network error gracefully
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadActivities();
    return () => {
      isMounted = false;
    };
  }, [campaignId, isDemo, contact.status]);

  const activities = isDemo || !campaignId ? demoActivities : remoteActivities;

  async function handleCampaignAction(action: 'pause' | 'resume' | 'complete') {
    setActionLoading(true);
    setMessage('');
    try {
      if (isDemo || !campaignId) {
        setDemoStatusOverride(action === 'pause' ? 'paused' : action === 'resume' ? 'sent' : 'completed');
        setMessage(`Campaign ${action}d in demo workspace.`);
        return;
      }

      const res = await fetch('/api/outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Action failed');

      setMessage(json.message);
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Error executing campaign action');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignId || isDemo) {
      setShowConfig(false);
      setMessage('Configuration updated in demo mode.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          action: 'update_config',
          config: {
            followupIntervalDays: intervalDays,
            skipWeekends,
            maxFollowups,
            autoSendFollowups: autoSend,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');

      setMessage('Follow-up schedule settings saved.');
      setShowConfig(false);
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setActionLoading(false);
    }
  }

  const followupsSent = contact.followupsSentCount || 0;
  const maxAllowed = contact.maxFollowups || 3;
  const isTerminated = ['replied', 'completed', 'cancelled'].includes(currentStatus);

  return (
    <div className="stack" style={{ gap: 14 }}>
      {/* Lifecycle Status & Metrics Banner */}
      <div
        className="card between"
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
        }}
      >
        <div className="row" style={{ gap: 16 }}>
          <div>
            <span className="muted" style={{ fontSize: 11, display: 'block' }}>Initial Outreach</span>
            <strong style={{ fontSize: 12, color: '#166534' }}>
              {contact.initialSentAt ? new Date(contact.initialSentAt).toLocaleDateString() : 'Sent'}
            </strong>
          </div>

          <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: 16 }}>
            <span className="muted" style={{ fontSize: 11, display: 'block' }}>Follow-ups Sent</span>
            <strong style={{ fontSize: 12, color: followupsSent > 0 ? '#0284c7' : '#64748b' }}>
              {followupsSent} / {maxAllowed}
            </strong>
          </div>

          <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: 16 }}>
            <span className="muted" style={{ fontSize: 11, display: 'block' }}>Next Scheduled</span>
            <strong style={{ fontSize: 12, color: contact.nextFollowupAt && !isTerminated ? '#b45309' : '#64748b' }}>
              {isTerminated
                ? 'Stopped'
                : contact.nextFollowupAt
                ? new Date(contact.nextFollowupAt).toLocaleDateString()
                : 'None'}
            </strong>
          </div>
        </div>

        {/* Action Controls */}
        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            className="button"
            style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings size={12} /> Settings
          </button>

          {currentStatus === 'paused' ? (
            <button
              type="button"
              className="button"
              style={{ fontSize: 11, padding: '4px 8px', color: '#166534', borderColor: '#86efac' }}
              disabled={actionLoading || contact.isSuppressed}
              onClick={() => handleCampaignAction('resume')}
            >
              <Play size={12} /> Resume
            </button>
          ) : !isTerminated ? (
            <button
              type="button"
              className="button"
              style={{ fontSize: 11, padding: '4px 8px', color: '#b45309', borderColor: '#fde047' }}
              disabled={actionLoading}
              onClick={() => handleCampaignAction('pause')}
            >
              <Pause size={12} /> Pause
            </button>
          ) : null}

          {!isTerminated && (
            <button
              type="button"
              className="button"
              style={{ fontSize: 11, padding: '4px 8px', color: '#64748b' }}
              disabled={actionLoading}
              onClick={() => handleCampaignAction('complete')}
            >
              <CheckCircle2 size={12} /> Complete
            </button>
          )}
        </div>
      </div>

      {message && (
        <div style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', padding: '6px 10px', borderRadius: 4 }}>
          {message}
        </div>
      )}

      {/* Settings Panel Modal */}
      {showConfig && (
        <form onSubmit={handleSaveConfig} className="card stack" style={{ background: 'white', padding: 14, gap: 10, border: '1px solid #cbd5e1' }}>
          <strong style={{ fontSize: 13 }}>Follow-up Automation Configuration</strong>
          <div className="grid2" style={{ gap: 10 }}>
            <label className="field" style={{ fontSize: 11 }}>
              Subsequent Interval (Days)
              <input
                type="number"
                min={1}
                max={30}
                value={intervalDays}
                onChange={(e) => setIntervalDays(parseInt(e.target.value, 10))}
              />
            </label>
            <label className="field" style={{ fontSize: 11 }}>
              Max Follow-ups (0–10)
              <input
                type="number"
                min={0}
                max={10}
                value={maxFollowups}
                onChange={(e) => setMaxFollowups(parseInt(e.target.value, 10))}
              />
            </label>
          </div>

          <label className="check" style={{ fontSize: 11 }}>
            <input
              type="checkbox"
              checked={skipWeekends}
              onChange={(e) => setSkipWeekends(e.target.checked)}
            />
            Skip weekends when calculating scheduled dates
          </label>

          <label className="check" style={{ fontSize: 11 }}>
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
            />
            Automatically send follow-ups when due without requiring manual pre-approval
          </label>

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              className="button"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setShowConfig(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              style={{ fontSize: 11, padding: '4px 12px' }}
              disabled={actionLoading}
            >
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {/* Chronological Activity Timeline */}
      <div className="stack" style={{ gap: 10 }}>
        <div className="between">
          <strong style={{ fontSize: 13 }}>Outreach Activity History</strong>
          {loading && <span className="muted" style={{ fontSize: 11 }}>Loading…</span>}
        </div>

        {activities.length === 0 ? (
          <p className="muted" style={{ fontSize: 12, margin: 0, fontStyle: 'italic' }}>
            No activity recorded yet. Sending an outreach email will initialize the timeline.
          </p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {activities.map((act) => {
              const isSent = act.activity_type.includes('sent');
              const isReply = act.activity_type.includes('reply');
              const isPauseOrCancel = act.activity_type.includes('paused') || act.activity_type.includes('cancelled');
              const isOptOut = act.activity_type.includes('opted_out');

              return (
                <div
                  key={act.id}
                  className="card"
                  style={{
                    padding: '8px 12px',
                    fontSize: 12,
                    background: isReply ? '#f0fdf4' : isOptOut ? '#fef2f2' : 'white',
                    borderLeft: `4px solid ${
                      isReply ? '#22c55e' : isOptOut ? '#ef4444' : isPauseOrCancel ? '#f59e0b' : '#0ea5e9'
                    }`,
                  }}
                >
                  <div className="between" style={{ marginBottom: 2 }}>
                    <div className="row" style={{ gap: 6 }}>
                      {isReply ? (
                        <MessageSquare size={13} style={{ color: '#16a34a' }} />
                      ) : isSent ? (
                        <MailCheck size={13} style={{ color: '#0284c7' }} />
                      ) : isPauseOrCancel ? (
                        <Pause size={13} style={{ color: '#d97706' }} />
                      ) : (
                        <Clock size={13} style={{ color: '#64748b' }} />
                      )}
                      <strong>{act.title}</strong>
                    </div>
                    <span className="muted" style={{ fontSize: 10 }}>
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>

                  {act.details && Object.keys(act.details).length > 0 && (
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                      {act.details.summary ? (
                        <span>&ldquo;{String(act.details.summary)}&rdquo;</span>
                      ) : act.details.reason ? (
                        <span>Reason: {String(act.details.reason)}</span>
                      ) : act.details.scheduled_at ? (
                        <span>Scheduled target: {new Date(String(act.details.scheduled_at)).toLocaleString()}</span>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
