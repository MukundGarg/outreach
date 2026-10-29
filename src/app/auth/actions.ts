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
    if (error) {
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid_grant')) {
        return { ok: false, message: 'Incorrect email or password. Please try again.' };
      }
      if (errMsg.includes('email not confirmed')) {
        return { ok: false, message: 'Please check your email and click the confirmation link before signing in.' };
      }
      if (errMsg.includes('user already registered')) {
        return { ok: false, message: 'An account with this email already exists. Please sign in instead.' };
      }
      if (errMsg.includes('rate limit')) {
        return { ok: false, message: 'Too many authentication attempts. Please wait a few moments and try again.' };
      }
      return {
        ok: false,
        message: error.message || 'Authentication could not be completed. Check your details.',
      };
    }
    return {
      ok: true,
      message:
        mode === 'signup'
          ? 'Check your email to confirm your account, then sign in.'
          : 'Signed in successfully.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return {
        ok: false,
        message: 'Supabase authentication is not configured. You can explore the demo without an account.',
      };
    }
    return {
      ok: false,
      message: 'Unable to reach authentication service. Please check your connection and try again.',
    };
  }
}
