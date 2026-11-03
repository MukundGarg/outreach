import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension');

interface FormExtractionField {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  options?: string[];
  required?: boolean;
}

interface AutofillResultResponse {
  filledCount: number;
  skippedCount: number;
  details: Array<{ fieldLabel: string; status: string }>;
}

test('Extension extraction and filling workflow executes cleanly via content script', async () => {
  // Launch persistent context with extension
  const userDataDir = path.resolve(__dirname, '../../test-results/chrome-ext-profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  const page = await browserContext.newPage();
  await page.goto('http://localhost:3000/test-form.html');
  await expect(page.locator('#first_name')).toBeVisible();

  // Test content script injection & extraction directly
  const contentScriptPath = path.resolve(EXTENSION_PATH, 'content.js');
  await page.addScriptTag({ path: contentScriptPath });

  // 1. Verify Extraction
  const extraction = await page.evaluate(async () => {
    return new Promise<FormExtractionField[]>((resolve) => {
      const windowWithFn = window as unknown as { extractApplicationFormFields?: () => FormExtractionField[] };
      const fields = windowWithFn.extractApplicationFormFields?.() || [];
      resolve(fields);
    });
  });

  expect(Array.isArray(extraction)).toBe(true);
  expect(extraction.length).toBeGreaterThan(5);

  const firstNameField = extraction.find((f) => f.fieldId === 'first_name');
  expect(firstNameField).toBeTruthy();
  expect(firstNameField?.fieldLabel).toContain('First Name');

  // Verify radio group extraction
  const radioGroup = extraction.find((f) => f.fieldId === 'relocation_willing');
  expect(radioGroup).toBeTruthy();
  expect(radioGroup?.fieldType).toBe('radio');
  expect(radioGroup?.options).toContain('Yes');

  // Verify file upload was skipped
  const fileField = extraction.find((f) => f.fieldId === 'resume_file');
  expect(fileField).toBeFalsy();

  // 2. Test Autofill with Approved (Reviewed) Fields
  const fillMappings = [
    {
      fieldId: 'first_name',
      fieldLabel: 'First Name',
      fieldType: 'text',
      proposedValue: 'Alex',
      status: 'reviewed', // Approved
    },
    {
      fieldId: 'email',
      fieldLabel: 'Email Address',
      fieldType: 'email',
      proposedValue: 'alex@example.com',
      status: 'reviewed', // Approved
    },
    {
      fieldId: 'prefilled_field',
      fieldLabel: 'Candidate Notes (Already Populated)',
      fieldType: 'text',
      proposedValue: 'New replacement value',
      status: 'reviewed', // Approved, but should be PRESERVED because input is not empty
    },
    {
      fieldId: 'cover_letter',
      fieldLabel: 'Cover Letter / Note',
      fieldType: 'textarea',
      proposedValue: 'Unreviewed AI suggestion text',
      status: 'pending_review', // UNREVIEWED -> MUST BE SKIPPED
    },
    {
      fieldId: 'relocation_willing',
      fieldLabel: 'Are you willing to relocate?',
      fieldType: 'radio',
      proposedValue: 'Yes',
      status: 'reviewed', // Approved
    },
    {
      fieldId: 'legally_authorized',
      fieldLabel: 'I certify all answers submitted are accurate.',
      fieldType: 'checkbox',
      proposedValue: 'true',
      status: 'reviewed', // Approved
    },
  ];

  const fillResult = await page.evaluate(async (mappings) => {
    const windowWithFn = window as unknown as { fillApprovedFields?: (m: unknown) => AutofillResultResponse };
    return windowWithFn.fillApprovedFields?.(mappings);
  }, fillMappings);

  expect(fillResult).toBeTruthy();
  expect(fillResult?.filledCount).toBe(4); // first_name, email, relocation_willing, legally_authorized
  expect(fillResult?.skippedCount).toBe(2); // prefilled_field (preserved) and cover_letter (unreviewed)

  // Verify DOM values
  expect(await page.locator('#first_name').inputValue()).toBe('Alex');
  expect(await page.locator('#email').inputValue()).toBe('alex@example.com');
  expect(await page.locator('#prefilled_field').inputValue()).toBe('Already entered text'); // PRESERVED!
  expect(await page.locator('#cover_letter').inputValue()).toBe(''); // SKIPPED UNREVIEWED!
  expect(await page.locator('input[value="yes"]').isChecked()).toBe(true); // RADIO MATCHED!
  expect(await page.locator('#legally_authorized').isChecked()).toBe(true); // CHECKBOX CHECKED!

  await browserContext.close();
});
