import 'server-only';
import { authenticatedDatabase } from './applications';

import { validatePdfBuffer } from '@/lib/pdf-validator';
export { validatePdfBuffer };

export interface ResumeRecord {
  id: string;
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Uploads a validated PDF file to private Supabase Storage and records metadata in public.resumes.
 * Enforces:
 * - Scoped path: <user-id>/<uuid>.pdf
 * - Private bucket: resumes
 * - Metadata row in public.resumes
 */
export async function uploadResume(file: File): Promise<{ resume: ResumeRecord; signedUrl: string }> {
  const { db, user } = await authenticatedDatabase();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const validation = validatePdfBuffer(buffer);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  // Generate randomized storage path scoped to the authenticated user
  const fileId = crypto.randomUUID();
  const storagePath = `${user.id}/${fileId}.pdf`;

  // 1. Upload to Supabase Storage private bucket
  const { error: uploadError } = await db.storage
    .from('resumes')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
  }

  // 2. Insert metadata into public.resumes table
  const { data: resumeRow, error: dbError } = await db
    .from('resumes')
    .insert({
      user_id: user.id,
      storage_path: storagePath,
      file_name: file.name.slice(0, 255),
      mime_type: 'application/pdf',
      size_bytes: buffer.length,
      extraction_status: 'pending',
    })
    .select()
    .single();

  if (dbError) {
    // Attempt rollback of storage file if DB insert fails
    await db.storage.from('resumes').remove([storagePath]).catch(() => {});
    throw new Error(`Failed to save resume metadata: ${dbError.message}`);
  }

  // 3. Generate short-lived signed download URL (valid for 10 minutes)
  const { data: signedData, error: signError } = await db.storage
    .from('resumes')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData?.signedUrl) {
    throw new Error('Failed to generate secure resume access URL');
  }

  return {
    resume: {
      id: resumeRow.id,
      storagePath: resumeRow.storage_path,
      fileName: resumeRow.file_name,
      sizeBytes: resumeRow.size_bytes,
      createdAt: resumeRow.created_at,
    },
    signedUrl: signedData.signedUrl,
  };
}

/**
 * Gets the latest resume for the authenticated user and generates a fresh short-lived signed URL.
 */
export async function getLatestResume(): Promise<{ resume: ResumeRecord; signedUrl: string } | null> {
  const { db, user } = await authenticatedDatabase();

  const { data, error } = await db
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { data: signedData, error: signError } = await db.storage
    .from('resumes')
    .createSignedUrl(data.storage_path, 600);

  if (signError || !signedData?.signedUrl) {
    return null;
  }

  return {
    resume: {
      id: data.id,
      storagePath: data.storage_path,
      fileName: data.file_name,
      sizeBytes: data.size_bytes,
      createdAt: data.created_at,
    },
    signedUrl: signedData.signedUrl,
  };
}

/**
 * Deletes a resume by ID: removes from storage and public.resumes table.
 */
export async function deleteResume(id: string): Promise<void> {
  const { db, user } = await authenticatedDatabase();

  const { data, error } = await db
    .from('resumes')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    throw new Error('Resume not found');
  }

  // Delete from storage
  await db.storage.from('resumes').remove([data.storage_path]);

  // Delete from table
  await db.from('resumes').delete().eq('id', id).eq('user_id', user.id);
}
