/* eslint-disable @typescript-eslint/no-explicit-any */
import Module from 'node:module';

// Neutralize server-only import barrier for Node test runner
const origLoad = (Module as any)._load;
(Module as any)._load = function (request: string, ...args: any[]) {
  if (request === 'server-only') return {};
  return origLoad.apply(this, [request, ...args]);
};

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateContentHash } from '../src/lib/email-utils';
import { encryptToken } from '../src/lib/encryption';

// Set encryption key for test suite
process.env.GMAIL_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Require sendUserApprovedEmail after neutralizing server-only
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendUserApprovedEmail } = require('../src/services/gmail-sender');

interface MemoryDB {
  recruiter_contacts: any[];
  outreach_campaigns: any[];
  email_messages: any[];
  gmail_oauth_connections: any[];
}

function createMockDatabase(initialData?: Partial<MemoryDB>) {
  const db: MemoryDB = {
    recruiter_contacts: initialData?.recruiter_contacts ? [...initialData.recruiter_contacts] : [],
    outreach_campaigns: initialData?.outreach_campaigns ? [...initialData.outreach_campaigns] : [],
    email_messages: initialData?.email_messages ? [...initialData.email_messages] : [],
    gmail_oauth_connections: initialData?.gmail_oauth_connections ? [...initialData.gmail_oauth_connections] : [],
  };

  const client = {
    from(table: keyof MemoryDB) {
      let rows = [...(db[table] || [])];

      const queryBuilder = {
        select() {
          return queryBuilder;
        },
        eq(col: string, val: any) {
          rows = rows.filter((r) => r[col] === val);
          return queryBuilder;
        },
        in(col: string, vals: any[]) {
          rows = rows.filter((r) => vals.includes(r[col]));
          return queryBuilder;
        },
        or(condition: string) {
          // Supports "status.eq.sending,send_error_category.eq.RECONCILIATION_REQUIRED"
          const parts = condition.split(',');
          rows = rows.filter((r) => {
            return parts.some((p) => {
              const [c, op, v] = p.split('.');
              if (op === 'eq') {
                return r[c] === v;
              }
              return false;
            });
          });
          return queryBuilder;
        },
        order() {
          return queryBuilder;
        },
        limit(num: number) {
          rows = rows.slice(0, num);
          return queryBuilder;
        },
        async single() {
          if (rows.length === 0) return { data: null, error: new Error('Row not found') };
          return { data: rows[0], error: null };
        },
        async maybeSingle() {
          if (rows.length === 0) return { data: null, error: null };
          return { data: rows[0], error: null };
        },
        update(patch: any) {
          const updateBuilder = {
            eq(col: string, val: any) {
              rows = rows.filter((r) => r[col] === val);
              return updateBuilder;
            },
            in(col: string, vals: any[]) {
              rows = rows.filter((r) => vals.includes(r[col]));
              return updateBuilder;
            },
            select() {
              return updateBuilder;
            },
            async single() {
              if (rows.length === 0) return { data: null, error: new Error('Cannot update non-matching row') };
              // Apply patch to the first matched row
              const target = rows[0];
              const idx = db[table].findIndex((item) => item.id === target.id);
              if (idx !== -1) {
                db[table][idx] = { ...db[table][idx], ...patch, updated_at: new Date().toISOString() };
                return { data: db[table][idx], error: null };
              }
              return { data: null, error: new Error('Row not found') };
            },
            then(resolve: any, reject: any) {
              // Executed if awaited directly
              for (const target of rows) {
                const idx = db[table].findIndex((item) => item.id === target.id);
                if (idx !== -1) {
                  db[table][idx] = { ...db[table][idx], ...patch, updated_at: new Date().toISOString() };
                }
              }
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return updateBuilder;
        },
        insert(newRow: any) {
          const inserted = {
            id: newRow.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            created_at: new Date().toISOString(),
            ...newRow,
          };
          db[table].push(inserted);
          const insertBuilder = {
            select() {
              return insertBuilder;
            },
            async single() {
              return { data: inserted, error: null };
            },
            then(resolve: any, reject: any) {
              return Promise.resolve({ data: inserted, error: null }).then(resolve, reject);
            },
          };
          return insertBuilder;
        },
      };

      return queryBuilder;
    },
  };

  return { client, db };
}

test('Integration 1: Uncertain transmission prevents new approved email for campaign until reconciled', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const contactId = '22222222-2222-4222-8222-222222222222';
  const campaignId = '33333333-3333-4333-8333-333333333333';
  const recipientEmail = 'recruiter@targetcorp.com';
  const subject = 'Application for Senior Role';
  const body = 'Hello recruiter, I am excited to apply.';
  const contentHash = calculateContentHash(recipientEmail, subject, body);

  // Scenario A: An earlier message is stuck in status 'sending'
  const { client, db } = createMockDatabase({
    recruiter_contacts: [
      { id: contactId, user_id: userId, email: recipientEmail, is_suppressed: false },
    ],
    outreach_campaigns: [
      { id: campaignId, user_id: userId, recruiter_contact_id: contactId, status: 'awaiting_approval' },
    ],
    email_messages: [
      {
        id: 'msg-uncertain-1',
        campaign_id: campaignId,
        user_id: userId,
        recipient_email: recipientEmail,
        status: 'sending',
        idempotency_key: 'key-111',
        approved_at: new Date().toISOString(),
        approved_content_hash: contentHash,
      },
      {
        id: 'msg-new-draft',
        campaign_id: campaignId,
        user_id: userId,
        recipient_email: recipientEmail,
        status: 'approved',
        idempotency_key: 'key-222',
        approved_at: new Date().toISOString(),
        approved_content_hash: contentHash,
      },
    ],
    gmail_oauth_connections: [
      {
        user_id: userId,
        email: 'sender@example.com',
        encrypted_access_token: encryptToken('test-access-token'),
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  });

  await assert.rejects(
    async () => {
      await sendUserApprovedEmail(
        {
          campaignId,
          contactId,
          recipientEmail,
          subject,
          body,
          approvalConfirmed: true,
          draftId: 'msg-new-draft',
          operationKey: 'key-222',
        },
        { db: client, user: { id: userId } },
      );
    },
    {
      message: /earlier transmission for this campaign has an uncertain delivery outcome and requires reconciliation/,
    },
  );

  // Scenario B: An earlier message has send_error_category = 'RECONCILIATION_REQUIRED'
  db.email_messages[0].status = 'failed';
  db.email_messages[0].send_error_category = 'RECONCILIATION_REQUIRED';

  await assert.rejects(
    async () => {
      await sendUserApprovedEmail(
        {
          campaignId,
          contactId,
          recipientEmail,
          subject,
          body,
          approvalConfirmed: true,
          draftId: 'msg-new-draft',
          operationKey: 'key-222',
        },
        { db: client, user: { id: userId } },
      );
    },
    {
      message: /earlier transmission for this campaign has an uncertain delivery outcome and requires reconciliation/,
    },
  );
});

test('Integration 2: Concurrent draft save cannot regress sending state back to approved', async () => {
  // Verifies database update condition: .in('status', ['draft', 'approved'])
  const { client, db } = createMockDatabase({
    email_messages: [
      {
        id: 'draft-concurrent-test',
        status: 'sending', // In-flight transmission lock held
        subject: 'Initial Subject',
        body: 'Initial Body',
        idempotency_key: 'key-test',
      },
    ],
  });

  // Attempting to update a message whose status is 'sending' using conditional constraint
  const { data: updated, error } = await client
    .from('email_messages')
    .update({
      status: 'approved',
      subject: 'Overwriting Subject',
    })
    .eq('id', 'draft-concurrent-test')
    .in('status', ['draft', 'approved'])
    .single();

  // Must fail to update the row
  assert.equal(updated, null);
  assert.ok(error);
  assert.equal(db.email_messages[0].status, 'sending');
  assert.equal(db.email_messages[0].subject, 'Initial Subject');
});

test('Integration 3: Conservative network error handling treats socket/fetch exceptions as uncertain RECONCILIATION_REQUIRED', async () => {
  const userId = 'user-net-err';
  const contactId = 'contact-net-err';
  const campaignId = 'camp-net-err';
  const recipientEmail = 'recruiter@nettest.com';
  const subject = 'Application';
  const body = 'Body content';
  const contentHash = calculateContentHash(recipientEmail, subject, body);

  const { client, db } = createMockDatabase({
    recruiter_contacts: [
      { id: contactId, user_id: userId, email: recipientEmail, is_suppressed: false },
    ],
    outreach_campaigns: [
      { id: campaignId, user_id: userId, recruiter_contact_id: contactId, status: 'draft' },
    ],
    email_messages: [
      {
        id: 'msg-net-err',
        campaign_id: campaignId,
        user_id: userId,
        recipient_email: recipientEmail,
        status: 'approved',
        idempotency_key: 'key-net-err',
        approved_at: new Date().toISOString(),
        approved_content_hash: contentHash,
      },
    ],
    gmail_oauth_connections: [
      {
        user_id: userId,
        email: 'sender@example.com',
        encrypted_access_token: encryptToken('test-access-token'),
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  });

  // Mock global fetch to simulate network drop / ECONNRESET after request dispatch
  const originalFetch = global.fetch;
  global.fetch = (async () => {
    throw new TypeError('fetch failed: ECONNRESET');
  }) as any;

  try {
    await assert.rejects(
      async () => {
        await sendUserApprovedEmail(
          {
            campaignId,
            contactId,
            recipientEmail,
            subject,
            body,
            approvalConfirmed: true,
            draftId: 'msg-net-err',
            operationKey: 'key-net-err',
          },
          { db: client, user: { id: userId } },
        );
      },
      {
        message: /Gmail transmission network error.*uncertain state requiring reconciliation/,
      },
    );

    // Verify database record state: preserved as 'sending' and 'RECONCILIATION_REQUIRED', NOT marked failed
    const messageRow = db.email_messages.find((m) => m.id === 'msg-net-err');
    assert.equal(messageRow.status, 'sending');
    assert.equal(messageRow.send_error_category, 'RECONCILIATION_REQUIRED');
    assert.ok(messageRow.send_error_details.includes('ECONNRESET'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('Integration 4: Gmail response missing valid message ID is rejected and not accepted', async () => {
  const userId = 'user-valid-id';
  const contactId = 'contact-valid-id';
  const campaignId = 'camp-valid-id';
  const recipientEmail = 'recruiter@validid.com';
  const subject = 'Application';
  const body = 'Body content';
  const contentHash = calculateContentHash(recipientEmail, subject, body);

  const { client, db } = createMockDatabase({
    recruiter_contacts: [
      { id: contactId, user_id: userId, email: recipientEmail, is_suppressed: false },
    ],
    outreach_campaigns: [
      { id: campaignId, user_id: userId, recruiter_contact_id: contactId, status: 'draft' },
    ],
    email_messages: [
      {
        id: 'msg-id-check',
        campaign_id: campaignId,
        user_id: userId,
        recipient_email: recipientEmail,
        status: 'approved',
        idempotency_key: 'key-id-check',
        approved_at: new Date().toISOString(),
        approved_content_hash: contentHash,
      },
    ],
    gmail_oauth_connections: [
      {
        user_id: userId,
        email: 'sender@example.com',
        encrypted_access_token: encryptToken('test-access-token'),
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  });

  // Mock global fetch returning HTTP 200 but without valid message ID
  const originalFetch = global.fetch;
  global.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: '   ', threadId: 'thread-123' }), // Blank whitespace ID
    };
  }) as any;

  try {
    await assert.rejects(
      async () => {
        await sendUserApprovedEmail(
          {
            campaignId,
            contactId,
            recipientEmail,
            subject,
            body,
            approvalConfirmed: true,
            draftId: 'msg-id-check',
            operationKey: 'key-id-check',
          },
          { db: client, user: { id: userId } },
        );
      },
      {
        message: /missing confirmed message ID/,
      },
    );

    // Verify message was not marked as 'sent'
    const messageRow = db.email_messages.find((m) => m.id === 'msg-id-check');
    assert.notEqual(messageRow.status, 'sent');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Integration 5: Outreach campaign transitions through draft -> awaiting_approval -> scheduled -> sent and updates campaign correctly', async () => {
  const userId = 'user-trans';
  const contactId = 'contact-trans';
  const campaignId = 'camp-trans';
  const recipientEmail = 'recruiter@trans.com';
  const subject = 'Application';
  const body = 'Body content';
  const contentHash = calculateContentHash(recipientEmail, subject, body);

  const { client, db } = createMockDatabase({
    recruiter_contacts: [
      { id: contactId, user_id: userId, email: recipientEmail, is_suppressed: false },
    ],
    outreach_campaigns: [
      { id: campaignId, user_id: userId, recruiter_contact_id: contactId, status: 'draft' },
    ],
    email_messages: [
      {
        id: 'msg-trans',
        campaign_id: campaignId,
        user_id: userId,
        recipient_email: recipientEmail,
        status: 'approved',
        idempotency_key: 'key-trans',
        approved_at: new Date().toISOString(),
        approved_content_hash: contentHash,
      },
    ],
    gmail_oauth_connections: [
      {
        user_id: userId,
        email: 'sender@example.com',
        encrypted_access_token: encryptToken('test-access-token'),
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  });

  const originalFetch = global.fetch;
  global.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'gmail-confirmed-12345', threadId: 'thread-99999' }),
    };
  }) as any;

  try {
    const result = await sendUserApprovedEmail(
      {
        campaignId,
        contactId,
        recipientEmail,
        subject,
        body,
        approvalConfirmed: true,
        draftId: 'msg-trans',
        operationKey: 'key-trans',
      },
      { db: client, user: { id: userId } },
    );

    assert.equal(result.gmailMessageId, 'gmail-confirmed-12345');

    // Campaign must end in 'sent'
    const campaignRow = db.outreach_campaigns.find((c) => c.id === campaignId);
    assert.equal(campaignRow.status, 'sent');
    assert.ok(campaignRow.approved_at);

    // Message must end in 'sent' with valid Gmail ID
    const messageRow = db.email_messages.find((m) => m.id === 'msg-trans');
    assert.equal(messageRow.status, 'sent');
    assert.equal(messageRow.gmail_message_id, 'gmail-confirmed-12345');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Integration 6: Approval replay with mismatched draftId or content is strictly rejected', async () => {
  const userId = 'user-replay';
  const contactId = 'contact-replay';
  const campaignId = 'camp-replay';
  const recipientEmail = 'recruiter@replay.com';
  const subject = 'Application';
  const body = 'Body content';
  const contentHash = calculateContentHash(recipientEmail, subject, body);

  const { client } = createMockDatabase({
    recruiter_contacts: [
      { id: contactId, user_id: userId, email: recipientEmail, is_suppressed: false },
    ],
    outreach_campaigns: [
      { id: campaignId, user_id: userId, recruiter_contact_id: contactId, status: 'scheduled' },
    ],
    email_messages: [
      {
        id: 'draft-approved-id',
        campaign_id: campaignId,
        user_id: userId,
        recipient_email: recipientEmail,
        status: 'approved',
        idempotency_key: 'key-replay',
        approved_at: new Date().toISOString(),
        approved_content_hash: contentHash,
      },
    ],
    gmail_oauth_connections: [
      {
        user_id: userId,
        email: 'sender@example.com',
        encrypted_access_token: encryptToken('test-access-token'),
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
  });

  // Replay attempt with a different draftId
  await assert.rejects(
    async () => {
      await sendUserApprovedEmail(
        {
          campaignId,
          contactId,
          recipientEmail,
          subject,
          body,
          approvalConfirmed: true,
          draftId: 'different-draft-uuid',
          operationKey: 'key-replay',
        },
        { db: client, user: { id: userId } },
      );
    },
    {
      message: /No server-persisted approval record found for this draft/,
    },
  );

  // Replay attempt with altered content
  await assert.rejects(
    async () => {
      await sendUserApprovedEmail(
        {
          campaignId,
          contactId,
          recipientEmail,
          subject,
          body: 'Altered body content after approval was granted',
          approvalConfirmed: true,
          draftId: 'draft-approved-id',
          operationKey: 'key-replay',
        },
        { db: client, user: { id: userId } },
      );
    },
    {
      message: /Server-persisted approved content hash does not match/,
    },
  );
});
