/* eslint-disable @typescript-eslint/no-explicit-any */
import Module from 'node:module';

// Neutralize server-only import barrier for Node test runner
// Intercept require('@/lib/supabase/server')
let currentMockDb: any = null;
const origLoad = (Module as any)._load;

(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'server-only') return {};
  if (request === '@/lib/supabase/server' || request.endsWith('/src/lib/supabase/server')) {
    return {
      supabaseServer: async () => currentMockDb,
    };
  }
  return origLoad.apply(this, [request, parent, isMain]);
};

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import domain mappers and demo snapshot schema
import { demoContacts } from '../src/lib/demo';

// Create a mock authenticated database simulator for listContacts()
function createListContactsMockDb(overrides?: {
  contacts?: any[];
  campaigns?: any[];
  campaignsError?: any;
  messages?: any[];
  messagesError?: any;
  user?: any;
}) {
  const user = overrides?.user || { id: 'test-user-123' };
  const contacts = overrides?.contacts ?? [
    {
      id: 'contact-1',
      user_id: user.id,
      name: 'Alice Recruiter',
      company: 'Acme Corp',
      email: 'alice@acme.corp',
      role: 'Staff Sourcer',
      is_suppressed: false,
      suppression_reason: null,
      created_at: '2026-11-01T10:00:00Z',
    },
  ];

  const campaigns = overrides?.campaigns ?? [
    {
      id: 'camp-1',
      user_id: user.id,
      recruiter_contact_id: 'contact-1',
      status: 'sent',
      followups_sent_count: 1,
      followups_failed_count: 0,
      max_followups: 3,
      auto_send_followups: false,
      last_followup_at: '2026-11-03T09:00:00Z',
      next_followup_at: '2026-11-06T09:00:00Z',
      created_at: '2026-11-01T10:05:00Z',
    },
  ];

  const messages = overrides?.messages ?? [];

  const mockDbClient = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from: (table: string) => {
      let filtered = table === 'recruiter_contacts' ? [...contacts] : table === 'outreach_campaigns' ? [...campaigns] : [...messages];
      let selectedCols = '*';

      const builder: any = {
        select: (cols: string = '*') => {
          selectedCols = cols;
          return builder;
        },
        eq: (col: string, val: any) => {
          filtered = filtered.filter((item) => item[col] === val);
          return builder;
        },
        in: (col: string, vals: any[]) => {
          filtered = filtered.filter((item) => vals.includes(item[col]));
          return builder;
        },
        order: (col: string, { ascending = true }: { ascending?: boolean } = {}) => {
          filtered.sort((a, b) => {
            const va = a[col];
            const vb = b[col];
            if (va < vb) return ascending ? -1 : 1;
            if (va > vb) return ascending ? 1 : -1;
            return 0;
          });
          return builder;
        },
        then: (resolve: any, reject?: any) => {
          if (table === 'outreach_campaigns' && overrides?.campaignsError) {
            // Check if select was '*' vs fallback columns
            if (overrides.campaignsError.code === '42703' && selectedCols !== '*') {
              // Fallback query succeeds
              return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: overrides.campaignsError }).then(resolve, reject);
          }
          if (table === 'email_messages' && overrides?.messagesError) {
            if (overrides.messagesError.code === '42703' && !selectedCols.includes('is_followup')) {
              return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: null, error: overrides.messagesError }).then(resolve, reject);
          }
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };

  return { mockDbClient, user };
}

// Import listContacts after setting up mock
const { listContacts } = require('../src/services/applications');

test('Draft Integrity 1: An inbound reply does not replace the original outreach draft', async () => {
  const initialSentTime = '2026-11-01T12:00:00Z';
  const replyTime = '2026-11-02T14:00:00Z';

  const mock = createListContactsMockDb({
    messages: [
      {
        id: 'msg-1',
        user_id: 'test-user-123',
        campaign_id: 'camp-1',
        direction: 'outbound',
        is_followup: false,
        subject: 'Initial Outreach: Excited about Acme',
        body: 'Dear Alice, I would love to connect about opportunities at Acme.',
        status: 'sent',
        sent_at: initialSentTime,
        created_at: '2026-11-01T12:00:00Z',
      },
      {
        id: 'msg-2',
        user_id: 'test-user-123',
        campaign_id: 'camp-1',
        direction: 'inbound',
        is_followup: false,
        subject: 'Re: Initial Outreach: Excited about Acme',
        body: 'Hi Alex, Thanks for reaching out! Are you available this Thursday?',
        status: 'received',
        reply_classification: 'interested',
        sent_at: replyTime,
        created_at: replyTime,
      },
    ],
  });
  currentMockDb = mock.mockDbClient;

  const contacts = await listContacts();
  assert.equal(contacts.length, 1);
  const contact = contacts[0];

  // Draft must remain the initial outbound draft
  assert.equal(contact.draft, 'Dear Alice, I would love to connect about opportunities at Acme.');
  assert.equal(contact.subject, 'Initial Outreach: Excited about Acme');
  // Initial sent timestamp remains msg-1 timestamp
  assert.equal(contact.initialSentAt, initialSentTime);
  // Reply classification reflects the inbound reply
  assert.equal(contact.replyClassification, 'interested');
});

test('Draft Integrity 2: A follow-up does not replace the original outreach draft', async () => {
  const initialSentTime = '2026-11-01T12:00:00Z';
  const followupSentTime = '2026-11-04T09:00:00Z';

  const mock = createListContactsMockDb({
    messages: [
      {
        id: 'msg-1',
        user_id: 'test-user-123',
        campaign_id: 'camp-1',
        direction: 'outbound',
        is_followup: false,
        subject: 'Initial Outreach: Senior Software Engineer',
        body: 'Original draft: Hello Alice, following up on my previous interest in Acme.',
        status: 'sent',
        sent_at: initialSentTime,
        created_at: '2026-11-01T12:00:00Z',
      },
      {
        id: 'msg-2',
        user_id: 'test-user-123',
        campaign_id: 'camp-1',
        direction: 'outbound',
        is_followup: true,
        subject: 'Follow-up #1: Senior Software Engineer',
        body: 'Follow-up draft: Hi Alice, bumping this up in case it got buried.',
        status: 'sent',
        sent_at: followupSentTime,
        created_at: followupSentTime,
      },
    ],
  });
  currentMockDb = mock.mockDbClient;

  const contacts = await listContacts();
  assert.equal(contacts.length, 1);
  const contact = contacts[0];

  // Original draft must NOT be overwritten by follow-up body
  assert.equal(contact.draft, 'Original draft: Hello Alice, following up on my previous interest in Acme.');
  assert.equal(contact.subject, 'Initial Outreach: Senior Software Engineer');
  // Initial sent timestamp must remain the initial send, not the follow-up send
  assert.equal(contact.initialSentAt, initialSentTime);
});

test('Draft Integrity 3: Initial sent timestamp remains unchanged after subsequent follow-ups', async () => {
  const t0 = '2026-11-01T10:00:00Z';
  const t1 = '2026-11-04T10:00:00Z';
  const t2 = '2026-11-07T10:00:00Z';

  const mock = createListContactsMockDb({
    messages: [
      {
        id: 'msg-1',
        campaign_id: 'camp-1',
        user_id: 'test-user-123',
        direction: 'outbound',
        is_followup: false,
        subject: 'Intro to Team',
        body: 'Initial email',
        status: 'sent',
        sent_at: t0,
        created_at: t0,
      },
      {
        id: 'msg-2',
        campaign_id: 'camp-1',
        user_id: 'test-user-123',
        direction: 'outbound',
        is_followup: true,
        subject: 'Re: Intro to Team',
        body: 'Followup 1',
        status: 'sent',
        sent_at: t1,
        created_at: t1,
      },
      {
        id: 'msg-3',
        campaign_id: 'camp-1',
        user_id: 'test-user-123',
        direction: 'outbound',
        is_followup: true,
        subject: 'Re: Intro to Team',
        body: 'Followup 2',
        status: 'sent',
        sent_at: t2,
        created_at: t2,
      },
    ],
  });
  currentMockDb = mock.mockDbClient;

  const [contact] = await listContacts();
  assert.equal(contact.initialSentAt, t0);
  assert.equal(contact.draft, 'Initial email');
});

test('Draft Integrity 4: The latest inbound reply is still correctly identified when preceded by followups', async () => {
  const mock = createListContactsMockDb({
    messages: [
      {
        id: 'msg-1',
        campaign_id: 'camp-1',
        user_id: 'test-user-123',
        direction: 'outbound',
        is_followup: false,
        subject: 'Initial Outreach',
        body: 'My application',
        status: 'sent',
        sent_at: '2026-11-01T10:00:00Z',
        created_at: '2026-11-01T10:00:00Z',
      },
      {
        id: 'msg-2',
        campaign_id: 'camp-1',
        user_id: 'test-user-123',
        direction: 'outbound',
        is_followup: true,
        subject: 'Follow-up',
        body: 'Checking in',
        status: 'sent',
        sent_at: '2026-11-04T10:00:00Z',
        created_at: '2026-11-04T10:00:00Z',
      },
      {
        id: 'msg-3',
        campaign_id: 'camp-1',
        user_id: 'test-user-123',
        direction: 'inbound',
        is_followup: false,
        subject: 'Re: Follow-up',
        body: 'Please unsubscribe me and remove me from your list.',
        status: 'received',
        reply_classification: 'opt_out',
        created_at: '2026-11-05T12:00:00Z',
      },
    ],
  });
  currentMockDb = mock.mockDbClient;

  const [contact] = await listContacts();
  assert.equal(contact.draft, 'My application');
  assert.equal(contact.replyClassification, 'opt_out');
});

test('Backward Compatibility 5: Missing lifecycle fields receive safe defaults', async () => {
  // Campaign with missing lifecycle fields (simulating legacy record or unmigrated schema)
  const mock = createListContactsMockDb({
    campaigns: [
      {
        id: 'camp-legacy',
        user_id: 'test-user-123',
        recruiter_contact_id: 'contact-1',
        status: 'draft',
        // Optional lifecycle fields missing (undefined or null)
      },
    ],
    messages: [],
  });
  currentMockDb = mock.mockDbClient;

  const [contact] = await listContacts();
  assert.equal(contact.followupsSentCount, 0);
  assert.equal(contact.followupsFailedCount, 0);
  assert.equal(contact.maxFollowups, 3);
  assert.equal(contact.autoSendFollowups, false);
  assert.equal(contact.nextFollowupAt, null);
  assert.equal(contact.lastFollowupAt, null);
});

test('Backward Compatibility 6: Missing optional lifecycle columns in outreach_campaigns gracefully fall back', async () => {
  const missingColError = {
    code: '42703',
    message: 'column "followups_sent_count" does not exist in outreach_campaigns',
  };

  const mock = createListContactsMockDb({
    campaigns: [
      {
        id: 'camp-1',
        user_id: 'test-user-123',
        recruiter_contact_id: 'contact-1',
        status: 'draft',
      },
    ],
    campaignsError: missingColError,
    messages: [],
  });
  currentMockDb = mock.mockDbClient;

  const contacts = await listContacts();
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].followupsSentCount, 0);
  assert.equal(contacts[0].maxFollowups, 3);
  assert.equal(contacts[0].autoSendFollowups, false);
});

test('Backward Compatibility 7: Unrelated database errors are not silently swallowed', async () => {
  const connectionError = {
    code: '08006',
    message: 'connection failure: unable to connect to database server',
  };

  const mock = createListContactsMockDb({
    campaignsError: connectionError,
  });
  currentMockDb = mock.mockDbClient;

  await assert.rejects(async () => {
    await listContacts();
  }, (err: any) => {
    return err.code === '08006' || err.message?.includes('connection failure');
  });
});

test('Demo Mode: demo contacts have complete lifecycle properties and match contracts', () => {
  for (const c of demoContacts) {
    assert.ok(typeof c.followupsSentCount === 'number');
    assert.ok(typeof c.followupsFailedCount === 'number');
    assert.ok(typeof c.maxFollowups === 'number');
    assert.ok(typeof c.autoSendFollowups === 'boolean');
    assert.ok(c.nextFollowupAt === null || typeof c.nextFollowupAt === 'string');
    assert.ok(c.lastFollowupAt === null || typeof c.lastFollowupAt === 'string');
  }
});
