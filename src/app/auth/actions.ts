'use server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
const schema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  mode: z.enum(['login', 'signup']),
});
export async function authenticate(input: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: 'Enter a valid email and a password of at least 8 characters.' };
  try {
    const db = await supabaseServer();
    const { email, password, mode } = parsed.data;
    const { error } =
      mode === 'login'
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });
    if (error)
      return {
        ok: false,
        message:
          'Authentication could not be completed. Check your details and Supabase configuration.',
      };
    return {
      ok: true,
      message:
        mode === 'signup'
          ? 'Check your email to confirm your account, then sign in.'
          : 'Signed in successfully.',
    };
  } catch {
    return {
      ok: false,
      message:
        'Supabase authentication is not configured. You can explore the demo without an account.',
    };
  }
}
