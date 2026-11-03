import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseCsv } from '@/lib/csv-parser';
import { routeAITask } from '@/services/ai-router';
import { validateRecruiter } from '@/services/recruiter-verification';
import { executeRecruiterImport } from '@/services/recruiter-directory';
import { demoEnabled } from '@/lib/demo';
import { canonicalRecruiterRecordSchema, type CsvRecruiterBatchAnalysis } from '@/lib/ai-schemas';

export const runtime = 'nodejs';

// 1. Analyze / Preview CSV
const analyzeRequestSchema = z.object({
  action: z.literal('analyze'),
  csvText: z.string().min(5, 'CSV content is empty').max(500000, 'CSV exceeds 500KB size limit'),
  filename: z.string().default('recruiters.csv'),
});

// 2. Commit / Confirm Import
const commitRequestSchema = z.object({
  action: z.literal('commit'),
  filename: z.string().default('recruiters.csv'),
  records: z.array(canonicalRecruiterRecordSchema).min(1).max(200),
  shareConsent: z.boolean().default(false),
});

const importPayloadSchema = z.discriminatedUnion('action', [
  analyzeRequestSchema,
  commitRequestSchema,
]);

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = importPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: `Invalid import request: ${parsed.error.issues[0]?.message}` },
        { status: 400 },
      );
    }

    // --- Action: ANALYZE ---
    if (parsed.data.action === 'analyze') {
      const { csvText, filename } = parsed.data;
      const parsedCsv = parseCsv(csvText, 100);

      if (parsedCsv.headers.length === 0 || parsedCsv.rows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Could not detect any valid headers or rows in the CSV file.' },
          { status: 400 },
        );
      }

      // Route through Gemini to canonicalize columns and extract fields
      const aiResponse = await routeAITask<CsvRecruiterBatchAnalysis>(
        'recruiter_csv_analyze',
        {
          csvHeaders: parsedCsv.headers,
          csvRows: parsedCsv.rows,
        },
        { isDemo: demoEnabled },
      );

      const analysis = aiResponse.data;

      // Run server-side verification and MX check on each extracted candidate
      const validatedRecruiters = await Promise.all(
        analysis.recruiters.map(async (r) => {
          if (!r.email) {
            return {
              ...r,
              verification_status: 'needs_review' as const,
              validation_issues: [...r.validation_issues, 'Missing email address'],
            };
          }

          const validation = await validateRecruiter(
            {
              fullName: r.full_name || '',
              email: r.email,
              jobTitle: r.job_title,
              company: r.company,
              linkedinUrl: r.linkedin_url,
              companyWebsite: r.company_website,
              location: r.location,
              recruitingSpecialties: r.recruiting_specialties,
            },
            { checkDns: true },
          );

          return {
            ...r,
            email: validation.normalizedEmail,
            linkedin_url: validation.normalizedLinkedin || r.linkedin_url,
            company_website: validation.normalizedCompanyWebsite || r.company_website,
            verification_status: validation.status,
            validation_issues: Array.from(new Set([...r.validation_issues, ...validation.issues])),
          };
        }),
      );

      return NextResponse.json({
        ok: true,
        data: {
          filename,
          headers: parsedCsv.headers,
          totalRows: parsedCsv.totalRows,
          columnMapping: analysis.column_mapping,
          recruiters: validatedRecruiters,
        },
      });
    }

    // --- Action: COMMIT ---
    if (parsed.data.action === 'commit') {
      const { filename, records, shareConsent } = parsed.data;

      if (demoEnabled) {
        return NextResponse.json({
          ok: true,
          data: {
            total: records.length,
            imported: records.length,
            rejected: 0,
            sharedCount: shareConsent ? records.length : 0,
            demo: true,
          },
        });
      }

      const result = await executeRecruiterImport({
        filename,
        records,
        shareConsent,
      });

      return NextResponse.json({
        ok: true,
        data: result,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to process recruiter import';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

