import { test, expect } from '@playwright/test';

test('Test form page renders all target MVP fields and dynamic controls', async ({ page }) => {
  await page.goto('/test-form.html');
  await expect(page.getByRole('heading', { name: 'Acme Corp — Senior Software Engineer Application' })).toBeVisible();

  // Standard inputs
  await expect(page.locator('#first_name')).toBeVisible();
  await expect(page.locator('#last_name')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#phone')).toBeVisible();
  await expect(page.locator('#linkedin_url')).toBeVisible();
  await expect(page.locator('#portfolio_url')).toBeVisible();
  await expect(page.locator('#cover_letter')).toBeVisible();
  await expect(page.locator('#work_authorization')).toBeVisible();
  await expect(page.locator('input[type="radio"][name="relocation_willing"]')).toHaveCount(3);
  await expect(page.locator('#legally_authorized')).toBeVisible();

  // Already populated input
  await expect(page.locator('#prefilled_field')).toHaveValue('Already entered text');

  // Unsupported file input
  await expect(page.locator('#resume_file')).toHaveAttribute('type', 'file');

  // Trigger dynamic field
  await page.getByRole('button', { name: 'Add Additional Information' }).click();
  await expect(page.locator('#dynamic_info')).toBeVisible();
});
