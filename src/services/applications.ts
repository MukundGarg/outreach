import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { applicationSchema } from '@/lib/domain';
export async function authenticatedDatabase() {
  const db = await supabaseServer();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error('Authentication required');
  return { db, user };
}
export async function listApplications() {
  const { db } = await authenticatedDatabase();
  return db.from('job_applications').select('*').order('created_at', { ascending: false });
}
export async function createApplication(input: unknown) {
  const value = applicationSchema.parse(input);
  const { db, user } = await authenticatedDatabase();
  return db
    .from('job_applications')
    .insert({ user_id: user.id, ...value, status: 'draft' })
    .select()
    .single();
}
