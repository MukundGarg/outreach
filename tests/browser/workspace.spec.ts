import { test, expect } from '@playwright/test';
test('landing and key routes render without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your next chapter/ })).toBeVisible();
  for (const path of [
    '/login',
    '/signup',
    '/dashboard',
    '/profile',
    '/preferences',
    '/applications',
    '/applications/sample-1',
    '/outreach',
    '/settings',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    if (path === '/dashboard') {
      const bar = page.locator('.recharts-bar-rectangle path').first();
      await expect(bar).toBeVisible();
      expect((await bar.boundingBox())?.height).toBeGreaterThan(20);
      await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
    }
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('application filters, draft creation and transition history persist locally', async ({
  page,
}) => {
  await page.goto('/applications');
  await page.getByRole('textbox', { name: 'Search applications' }).fill('Linear');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Linear');
  await page.getByRole('textbox', { name: 'Search applications' }).fill('');
  await page.getByRole('button', { name: 'Add application', exact: true }).click();
  await page.getByLabel('Job title', { exact: true }).fill('Platform Engineer');
  await page.getByLabel('Company', { exact: true }).fill('Demo Labs');
  await page.getByRole('button', { name: 'Create demo draft' }).click();
  await expect(page.getByRole('heading', { name: 'Platform Engineer' })).toBeVisible();
  await page.getByLabel('Move sample to next stage').selectOption('ready_for_review');
  await expect(
    page.getByText('Demo status changed to ready for review', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Demo status changed to ready for review', { exact: true }),
  ).toBeVisible();
});
test('profile, preferences, mock agent and disabled send are honest', async ({ page }) => {
  await page.goto('/profile');
  await page.getByLabel('Full name', { exact: true }).fill('Demo Candidate');
  await page.getByRole('button', { name: 'Save demo profile' }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  await page.goto('/preferences');
  await page.getByLabel('Preferred roles').fill('Design Engineer');
  await page.getByRole('button', { name: 'Save demo preferences' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  await page.goto('/outreach');
  await page.getByRole('button', { name: 'Run mock agent' }).click();
  await expect(page.getByRole('status')).toContainText('MOCK AGENT');
  await page.getByRole('button', { name: 'Send · not enabled' }).click();
  await expect(page.getByRole('status')).toContainText('No email was sent');
});
test('mobile navigation and dashboard fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Application pipeline' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Candidate profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your story, all in one place.' })).toBeVisible();
});
test('agent input validation and demo database boundary', async ({ request }) => {
  const invalid = await request.post('/api/agents', { data: { kind: 'unknown', context: '' } });
  expect(invalid.status()).toBe(400);
  const valid = await request.post('/api/agents', {
    data: { kind: 'candidate', context: 'sample candidate' },
  });
  expect(valid.status()).toBe(200);
  expect((await valid.json()).data.mode).toBe('mock');
  expect((await request.post('/api/applications', { data: {} })).status()).toBe(409);
});
