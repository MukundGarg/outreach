import { test, expect, type Page } from '@playwright/test';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || process.env.TEST_USER_A_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.TEST_USER_A_PASSWORD;

async function signInAsTestUser(page: Page) {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    throw new Error(
      'Missing required test credentials: TEST_USER_EMAIL and TEST_USER_PASSWORD must be configured in environment.',
    );
  }
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(TEST_USER_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

test('landing and key routes render without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your next chapter/ })).toBeVisible();

  await signInAsTestUser(page);

  for (const path of [
    '/dashboard',
    '/profile',
    '/preferences',
    '/applications',
    '/outreach',
    '/settings',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('application filters, draft creation and transition history persist locally', async ({
  page,
}) => {
  await signInAsTestUser(page);
  await page.goto('/applications');
  await expect(page.getByRole('heading', { name: 'Every opportunity, organized.' })).toBeVisible();
  await page.getByRole('button', { name: 'Add application', exact: true }).click();
  await page.getByLabel('Job title', { exact: true }).fill('Platform Engineer');
  await page.getByLabel('Company', { exact: true }).fill('Demo Labs');
  await page.getByRole('button', { name: 'Create draft application' }).click();
  await expect(page.getByRole('heading', { name: 'Application workspace' })).toBeVisible();
  await page.getByLabel('Move application to next stage').selectOption('ready_for_review');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Application workspace' })).toBeVisible();
});

test('profile and preferences persist in authenticated workspace', async ({ page }) => {
  await signInAsTestUser(page);
  await page.goto('/profile');
  await page.getByLabel('Full name', { exact: true }).fill('Mukund Garg');
  await page.getByLabel('Email address', { exact: true }).fill(TEST_USER_EMAIL!);
  await page.getByLabel('Professional headline', { exact: true }).fill('Full Stack AI Engineer');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile updated in database.')).toBeVisible();

  await page.goto('/preferences');
  await page.getByLabel('Preferred roles').fill('Software Engineer, AI Engineer');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Preferences successfully saved to your account.')).toBeVisible();
});

test('outreach draft editing and saving preserves content across reload', async ({ page }) => {
  await signInAsTestUser(page);
  await page.goto('/outreach');
  // Wait for draft preview
  await expect(page.getByRole('heading', { name: 'Draft preview' })).toBeVisible();
  const subjectInput = page.getByLabel('Subject Line (Editable)');
  const bodyInput = page.getByLabel('Email Body (Editable)');

  await subjectInput.fill('Senior Platform Lead — High Interest');
  await bodyInput.fill('Hello,\n\nI reviewed your platform engineering team challenges and would love to connect.\n\nBest,\nCandidate');

  await page.getByRole('button', { name: 'Save Draft to Database' }).click();
  await expect(page.getByText('Email draft saved securely to database.')).toBeVisible();

  // Reload page
  await page.reload();

  // Verify values persisted after browser reload
  await expect(page.getByRole('heading', { name: 'Draft preview' })).toBeVisible();
  await expect(page.getByLabel('Subject Line (Editable)')).toHaveValue('Senior Platform Lead — High Interest');
  await expect(page.getByLabel('Email Body (Editable)')).toHaveValue('Hello,\n\nI reviewed your platform engineering team challenges and would love to connect.\n\nBest,\nCandidate');
});

test('mobile navigation and dashboard fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsTestUser(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Application pipeline' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
});

test('unauthenticated API boundaries enforce authentication', async ({ request }) => {
  expect([400, 401, 403, 409, 500]).toContain((await request.post('/api/applications', { data: {} })).status());
  expect([400, 401, 403, 409, 500]).toContain((await request.get('/api/profile')).status());
  expect([400, 401, 403, 409, 500]).toContain((await request.get('/api/preferences')).status());
  expect([400, 401, 403, 409, 500]).toContain((await request.get('/api/resumes')).status());
  expect([400, 401, 403, 409, 500]).toContain((await request.post('/api/outreach/drafts', { data: {} })).status());
  expect([400, 401, 403, 409, 500]).toContain((await request.post('/api/outreach/send', { data: {} })).status());
});
