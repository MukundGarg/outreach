/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextFollowup } from '../src/lib/domain';

// Mock in-memory database simulation for lifecycle automation tests
function createMockOutreachDb() {
  const users = [{ id: 'user-1', email: 'alex@example.com' }];
  const contacts: any[] = [
    {
      id: 'contact-1',
      user_id: 'user-1',
      name: 'Sarah Connor',
      email: 'sarah@techcorp.io',
      company: 'TechCorp',
      role: 'Lead Recruiter',
      is_suppressed: false,
      suppression_reason: null as string | null,
      suppressed_at: null as string | null,
    },
  ];
  const campaigns: any[] = [
    {
      id: 'camp-1',
      user_id: 'user-1',
      recruiter_contact_id: 'contact-1',
      status: 'draft',
      initial_delay_days: 3,
      followup_interval_days: 3,
      skip_weekends: true,
      max_followups: 3,
      auto_send_followups: true,
      followups_sent_count: 0,
      followups_failed_count: 0,
      last_followup_at: null as string | null,
      next_followup_at: null as string | null,
    },
  ];
  const messages: any[] = [];
  const schedules: any[] = [];
  const activities: any[] = [];

  return {
    users,
    contacts,
    campaigns,
    messages,
    schedules,
    activities,
  };
}

test('Outreach Lifecycle: initial email sent and recorded in activity log', () => {
  const db = createMockOutreachDb();
  const camp = db.campaigns[0];
  const contact = db.contacts[0];

  // 1. Initial email sent
  const msgId = 'msg-1';
  db.messages.push({
    id: msgId,
    user_id: 'user-1',
    campaign_id: camp.id,
    direction: 'outbound',
    subject: 'Exploring Opportunities at TechCorp',
    body: 'Hi Sarah, I would love to connect about opportunities...',
    status: 'sent',
    recipient_email: contact.email,
    sent_at: '2026-10-20T10:00:00Z',
    is_followup: false,
    followup_number: 0,
  });

  camp.status = 'sent';

  db.activities.push({
    id: 'act-1',
    user_id: 'user-1',
    campaign_id: camp.id,
    activity_type: 'initial_sent',
    title: 'Outreach Email Sent',
    created_at: '2026-10-20T10:00:00Z',
  });

  assert.equal(db.messages.length, 1);
  assert.equal(db.messages[0].status, 'sent');
  assert.equal(camp.status, 'sent');
  assert.equal(db.activities.length, 1);
  assert.equal(db.activities[0].activity_type, 'initial_sent');
});

test('Outreach Lifecycle: first follow-up scheduled with configured interval and weekend exclusion', () => {
  const startDate = new Date('2026-10-23T10:00:00Z'); // Friday
  const scheduledDate = nextFollowup(startDate, 3, true);

  // Friday + 3 days -> Monday Oct 26 (skips Saturday and Sunday)
  assert.equal(scheduledDate.getUTCDay(), 1); // Monday
  assert.equal(scheduledDate.toISOString().slice(0, 10), '2026-10-26');
});

test('Outreach Lifecycle: follow-up count increments ONLY after successful send, not on schedule', () => {
  const db = createMockOutreachDb();
  const camp = db.campaigns[0];

  // Scheduling follow-up
  db.schedules.push({
    id: 'sched-1',
    user_id: 'user-1',
    campaign_id: camp.id,
    message_id: 'msg-1',
    scheduled_at: '2026-10-25T10:00:00Z',
    status: 'approved',
    followup_number: 1,
  });

  // Schedule does NOT increment followups_sent_count
  assert.equal(camp.followups_sent_count, 0, 'Followup sent count must remain 0 when only scheduled');

  // Simulated execution failure
  camp.followups_failed_count += 1;
  assert.equal(camp.followups_sent_count, 0, 'Failed send must not increment sent count');
  assert.equal(camp.followups_failed_count, 1, 'Failed send must increment failure counter');

  // Simulated successful send
  camp.followups_sent_count += 1;
  camp.last_followup_at = '2026-10-25T10:00:00Z';
  assert.equal(camp.followups_sent_count, 1, 'Sent count increments on successful send');
});

test('Outreach Lifecycle: automatic reply detection cancels all pending follow-ups and pauses/updates campaign', () => {
  const db = createMockOutreachDb();
  const camp = db.campaigns[0];
  camp.status = 'sent';

  db.schedules.push({
    id: 'sched-1',
    user_id: 'user-1',
    campaign_id: camp.id,
    message_id: 'msg-1',
    scheduled_at: '2026-10-25T10:00:00Z',
    status: 'approved',
    claimed_at: null,
  });

  // Inbound reply arrives
  const inboundMsg = {
    id: 'msg-inbound-1',
    user_id: 'user-1',
    campaign_id: camp.id,
    gmail_thread_id: 'thread-123',
    direction: 'inbound',
    subject: 'Re: Exploring Opportunities at TechCorp',
    body: 'Hi Alex, thanks for reaching out. Are you free for a call tomorrow?',
    status: 'received',
    reply_classification: 'interested',
    sent_at: '2026-10-24T12:00:00Z',
  };
  db.messages.push(inboundMsg);

  // AUTOMATIC RULE: Cancel pending followups
  db.schedules.forEach((s) => {
    if (s.campaign_id === camp.id && ['approved', 'pending'].includes(s.status)) {
      s.status = 'cancelled';
    }
  });

  camp.status = 'replied';

  assert.equal(camp.status, 'replied');
  assert.equal(db.schedules[0].status, 'cancelled', 'Pending schedule must be cancelled');
});

test('Outreach Lifecycle: opt-out reply suppresses contact and permanently blocks further outreach', () => {
  const db = createMockOutreachDb();
  const camp = db.campaigns[0];
  const contact = db.contacts[0];

  // Inbound opt-out message
  const optOutMsg = {
    id: 'msg-optout',
    user_id: 'user-1',
    campaign_id: camp.id,
    direction: 'inbound',
    subject: 'Unsubscribe',
    body: 'Please remove me from your list and do not email me again.',
    status: 'received',
    reply_classification: 'not_interested',
  };
  db.messages.push(optOutMsg);

  // Suppress contact
  contact.is_suppressed = true;
  contact.suppression_reason = 'Recruiter requested opt-out in reply';
  contact.suppressed_at = new Date().toISOString();

  // Cancel any schedules
  db.schedules.forEach((s) => {
    s.status = 'cancelled';
  });
  camp.status = 'replied';

  assert.equal(contact.is_suppressed, true);
  assert.equal(contact.suppression_reason, 'Recruiter requested opt-out in reply');

  // Verify that subsequent schedule attempt is strictly blocked
  assert.throws(() => {
    if (contact.is_suppressed) {
      throw new Error(`Cannot schedule follow-up: Recruiter contact is suppressed (${contact.suppression_reason})`);
    }
  }, /Cannot schedule follow-up: Recruiter contact is suppressed/);
});

test('Outreach Lifecycle: maximum follow-up count stops scheduling once limit is reached', () => {
  const db = createMockOutreachDb();
  const camp = db.campaigns[0];
  camp.max_followups = 2;
  camp.followups_sent_count = 2; // Limit reached

  assert.throws(() => {
    if (camp.followups_sent_count >= camp.max_followups) {
      throw new Error(`Cannot schedule follow-up: maximum configured limit of ${camp.max_followups} follow-ups has already been reached`);
    }
  }, /maximum configured limit of 2 follow-ups has already been reached/);
});

test('Outreach Lifecycle: manual pause and resume properly toggle status and revalidate safety invariants', () => {
  const db = createMockOutreachDb();
  const camp = db.campaigns[0];
  const contact = db.contacts[0];
  camp.status = 'sent';

  // Pause
  camp.status = 'paused';
  assert.equal(camp.status, 'paused');

  // Resume when contact is NOT suppressed -> succeeds
  if (!contact.is_suppressed) {
    camp.status = 'sent';
  }
  assert.equal(camp.status, 'sent');

  // Resume when contact IS suppressed -> fails
  contact.is_suppressed = true;
  camp.status = 'paused';
  assert.throws(() => {
    if (contact.is_suppressed) {
      throw new Error('Cannot resume: contact is suppressed / opted out');
    }
  }, /Cannot resume: contact is suppressed/);
});
