import 'server-only';
import { PDFParse } from 'pdf-parse';
import { authenticatedDatabase } from './applications';
import { extractCandidateProfile } from './gemini';
import type { ExtractedProfile } from '@/lib/ai-schemas';

const MAX_PDF_TEXT_LENGTH = 30000; // Cap extracted text to ~30k characters

/**
 * Extracts raw text from a PDF Buffer using pdf-parse.
 */
export async function parsePdfBufferToText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const text = textResult && typeof textResult.text === 'string' ? textResult.text.trim() : '';

    if (!text || text.length < 20) {
      throw new Error('PDF contains no readable text or is image-only / encrypted');
    }

    return text.slice(0, MAX_PDF_TEXT_LENGTH);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('readable text')) {
      throw err;
    }
    throw new Error('Failed to parse PDF document. It may be corrupt or encrypted.');
  }
}

/**
 * Downloads the authenticated user's private resume from Supabase Storage and performs Gemini extraction.
 * Guarantees:
 * 1. Storage path check matches authenticated user.
 * 2. Short-lived signed download or direct server-side download from private bucket.
 * 3. Text extracted in-memory; no public resume URL sent to AI.
 * 4. Extracted candidate profile returned for user review before saving.
 */
export async function extractResumeFromStorage(resumeId: string): Promise<ExtractedProfile> {
  const { db, user } = await authenticatedDatabase();

  // 1. Fetch metadata row ensuring ownership
  const { data: resumeRow, error: fetchErr } = await db
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !resumeRow) {
    throw new Error('Resume record not found or access denied');
  }

  // 2. Download PDF buffer directly using authenticated client
  const { data: fileBlob, error: downloadErr } = await db.storage
    .from('resumes')
    .download(resumeRow.storage_path);

  if (downloadErr || !fileBlob) {
    throw new Error('Failed to retrieve private resume file from storage');
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Extract text from PDF
  const text = await parsePdfBufferToText(buffer);

  // 4. Send text to Gemini for structured extraction
  const extracted = await extractCandidateProfile(text);

  // 5. Update extraction status to completed in public.resumes
  await db
    .from('resumes')
    .update({ extraction_status: 'completed' })
    .eq('id', resumeId)
    .eq('user_id', user.id);

  return extracted;
}
