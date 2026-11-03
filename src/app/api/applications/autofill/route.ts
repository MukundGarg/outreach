import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile, getApplication, saveApplicationPreparation } from '@/services/applications';
import { routeAITask } from '@/services/ai-router';
import { mapProfileField, isSensitiveField } from '@/lib/autofill-mapping';
import { demoEnabled } from '@/lib/demo';
import {
  extractedFormFieldSchema,
  type ExtractedFormField,
  type BatchAutofillAnalysis,
} from '@/lib/ai-schemas';
import type { AutofillFieldMapping } from '@/lib/domain';

export const runtime = 'nodejs';

const analyzeUrlSchema = z.object({
  action: z.literal('analyze_url'),
  applicationId: z.string().uuid(),
  url: z.string().url().max(2048),
});

const processFieldsSchema = z.object({
  action: z.literal('process_fields'),
  applicationId: z.string().uuid(),
  url: z.string().url().max(2048).optional(),
  fields: z.array(extractedFormFieldSchema).min(1).max(100),
});

const saveAutofillSchema = z.object({
  action: z.literal('save_autofill'),
  applicationId: z.string().uuid(),
  url: z.string().url().max(2048).optional(),
  fields: z.array(
    z.object({
      fieldId: z.string(),
      fieldLabel: z.string(),
      fieldType: z.enum(['text', 'textarea', 'email', 'tel', 'select', 'radio', 'checkbox']),
      proposedValue: z.string(),
      source: z.enum(['profile', 'gemini_basic', 'gemini_complex', 'user']),
      category: z.enum(['profile', 'mapped_answer', 'gemini_basic', 'complex_review', 'sensitive', 'missing']),
      status: z.enum(['reviewed', 'pending_review', 'user_required']),
      confidence: z.number().min(0).max(1),
      options: z.array(z.string()).optional(),
      required: z.boolean().default(false),
    }),
  ),
  autofillStatus: z.enum(['idle', 'analyzed', 'partially_filled', 'completed']).optional(),
});

const autofillPayloadSchema = z.discriminatedUnion('action', [
  analyzeUrlSchema,
  processFieldsSchema,
  saveAutofillSchema,
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const applicationId = url.searchParams.get('applicationId');
    if (!applicationId) {
      return NextResponse.json({ ok: false, error: 'Missing applicationId' }, { status: 400 });
    }

    if (demoEnabled) {
      return NextResponse.json({
        ok: true,
        data: {
          applicationUrl: 'https://boards.greenhouse.io/example/jobs/12345',
          fields: [],
          autofillStatus: 'idle',
        },
      });
    }

    const app = await getApplication(applicationId);
    if (!app) {
      return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: app.preparation?.autofill || {
        applicationUrl: app.url || '',
        fields: [],
        autofillStatus: 'idle',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve autofill data';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = autofillPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: `Invalid request: ${parsed.error.issues[0]?.message}` },
        { status: 400 },
      );
    }

    // --- Action: ANALYZE_URL ---
    if (parsed.data.action === 'analyze_url') {
      const { applicationId, url } = parsed.data;

      if (demoEnabled) {
        return NextResponse.json({
          ok: true,
          data: {
            applicationUrl: url,
            detectedPlatform: detectPlatform(url),
            message: 'Application URL validated and saved in demo mode.',
          },
        });
      }

      const app = await getApplication(applicationId);
      if (!app) {
        return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 });
      }

      // Update application preparation with the target autofill URL
      const currentPrep = app.preparation || {};
      const updatedPrep = {
        ...currentPrep,
        autofill: {
          ...(currentPrep.autofill || {}),
          applicationUrl: url,
          autofillStatus: currentPrep.autofill?.autofillStatus || 'idle',
        },
      };

      await saveApplicationPreparation(applicationId, updatedPrep);

      return NextResponse.json({
        ok: true,
        data: {
          applicationUrl: url,
          detectedPlatform: detectPlatform(url),
          message: 'Application URL saved successfully.',
        },
      });
    }

    // --- Action: PROCESS_FIELDS ---
    if (parsed.data.action === 'process_fields') {
      const { applicationId, url, fields } = parsed.data;

      if (demoEnabled) {
        // Return deterministic mock analysis in demo mode
        const aiMock = await routeAITask<BatchAutofillAnalysis>(
          'autofill_classify_and_answer',
          { formFields: fields },
          { isDemo: true },
        );
        return NextResponse.json({
          ok: true,
          data: {
            applicationUrl: url || '',
            fields: aiMock.data.fields,
          },
        });
      }

      const [app, profile] = await Promise.all([
        getApplication(applicationId),
        getProfile(),
      ]);

      if (!app) {
        return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 });
      }

      // Pre-screen fields:
      // - Direct profile matches map immediately
      // - Sensitive fields are locked to user_required
      // - Remaining questions go to Gemini
      const candidateFieldsForAI: ExtractedFormField[] = [];
      const preMappedResults: AutofillFieldMapping[] = [];

      for (const f of fields) {
        if (isSensitiveField(f.fieldLabel)) {
          preMappedResults.push({
            fieldId: f.fieldId,
            fieldLabel: f.fieldLabel,
            fieldType: f.fieldType,
            proposedValue: '',
            source: 'user',
            category: 'sensitive',
            status: 'user_required',
            confidence: 1.0,
            options: f.options,
            required: f.required,
          });
          continue;
        }

        const profileMatch = mapProfileField(f, profile);
        if (profileMatch.isMatch) {
          preMappedResults.push({
            fieldId: f.fieldId,
            fieldLabel: f.fieldLabel,
            fieldType: f.fieldType,
            proposedValue: profileMatch.value,
            source: 'profile',
            category: 'profile',
            status: 'reviewed',
            confidence: profileMatch.confidence,
            options: f.options,
            required: f.required,
          });
          continue;
        }

        // Needs Gemini question classification & answer generation
        candidateFieldsForAI.push(f);
      }

      let aiResults: BatchAutofillAnalysis = { fields: [] };
      if (candidateFieldsForAI.length > 0) {
        const aiResponse = await routeAITask<BatchAutofillAnalysis>(
          'autofill_classify_and_answer',
          {
            formFields: candidateFieldsForAI,
            jobTitle: app.title,
            company: app.company,
            jobDescription: app.jobDescription || undefined,
            screeningAnswers: app.preparation?.screeningAnswers || undefined,
          },
          { isDemo: false },
        );
        aiResults = aiResponse.data;
      }

      // Merge results preserving order
      const combinedFields: AutofillFieldMapping[] = [];
      for (const f of fields) {
        const direct = preMappedResults.find((p) => p.fieldId === f.fieldId);
        if (direct) {
          combinedFields.push(direct);
        } else {
          const fromAI = aiResults.fields.find((p) => p.fieldId === f.fieldId);
          if (fromAI) {
            combinedFields.push(fromAI);
          } else {
            combinedFields.push({
              fieldId: f.fieldId,
              fieldLabel: f.fieldLabel,
              fieldType: f.fieldType,
              proposedValue: '',
              source: 'user',
              category: 'missing',
              status: 'user_required',
              confidence: 0,
              options: f.options,
              required: f.required,
            });
          }
        }
      }

      // Save processed fields into application preparation
      const currentPrep = app.preparation || {};
      const updatedPrep = {
        ...currentPrep,
        autofill: {
          ...(currentPrep.autofill || {}),
          applicationUrl: url || currentPrep.autofill?.applicationUrl || app.url || '',
          fields: combinedFields,
          extractedAt: new Date().toISOString(),
          autofillStatus: 'analyzed' as const,
        },
      };

      await saveApplicationPreparation(applicationId, updatedPrep);

      return NextResponse.json({
        ok: true,
        data: {
          applicationUrl: updatedPrep.autofill.applicationUrl,
          fields: combinedFields,
        },
      });
    }

    // --- Action: SAVE_AUTOFILL ---
    if (parsed.data.action === 'save_autofill') {
      const { applicationId, url, fields, autofillStatus } = parsed.data;

      if (demoEnabled) {
        return NextResponse.json({
          ok: true,
          message: 'Autofill preparation saved in demo mode.',
        });
      }

      const app = await getApplication(applicationId);
      if (!app) {
        return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 });
      }

      const currentPrep = app.preparation || {};
      const updatedPrep = {
        ...currentPrep,
        autofill: {
          ...(currentPrep.autofill || {}),
          applicationUrl: url || currentPrep.autofill?.applicationUrl || app.url || '',
          fields: fields as AutofillFieldMapping[],
          autofillStatus: autofillStatus || currentPrep.autofill?.autofillStatus || 'analyzed',
          lastAutofilledAt:
            autofillStatus === 'completed' || autofillStatus === 'partially_filled'
              ? new Date().toISOString()
              : currentPrep.autofill?.lastAutofilledAt,
        },
      };

      await saveApplicationPreparation(applicationId, updatedPrep);

      return NextResponse.json({
        ok: true,
        message: 'Autofill answers and review states saved successfully.',
        data: updatedPrep.autofill,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process autofill request';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('greenhouse.io')) return 'Greenhouse';
  if (lower.includes('lever.co')) return 'Lever';
  if (lower.includes('workday.com') || lower.includes('myworkdayjobs.com')) return 'Workday';
  if (lower.includes('ashbyhq.com')) return 'Ashby';
  if (lower.includes('smartrecruiters.com')) return 'SmartRecruiters';
  return 'Standard HTML Form';
}
