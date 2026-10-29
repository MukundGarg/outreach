'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authenticate } from '@/app/auth/actions';
import { Brand } from './shell';
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth">
      <section className="card">
        <Brand />
        <h1>{mode === 'login' ? 'Welcome back.' : 'Your next chapter starts here.'}</h1>
        <p className="muted">
          {mode === 'login'
            ? 'Sign in to your ApplyPilot account.'
            : 'Create your ApplyPilot account.'}
        </p>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const result = await authenticate({
                email: f.get('email'),
                password: f.get('password'),
                mode,
              });
              setMessage(result.message);
              if (result.ok && mode === 'login') router.push('/dashboard');
            } catch {
              setMessage('Unable to reach authentication. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              minLength={8}
              maxLength={128}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </form>
        <p className="muted" style={{ fontSize: 12, marginTop: 22 }}>
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <Link href={mode === 'login' ? '/signup' : '/login'} style={{ color: '#27694e' }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
        <Link className="button" style={{ width: '100%' }} href="/dashboard">
          Explore sample workspace
        </Link>
        <p className="muted" style={{ fontSize: 10, marginTop: 15 }}>
          Sample workspace requires demo mode. Supabase credentials are only needed for
          authentication.
        </p>
      </section>
    </main>
  );
}
