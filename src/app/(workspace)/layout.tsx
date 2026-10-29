import { redirect } from 'next/navigation';
import { Shell } from '@/components/shell';
import { demoEnabled } from '@/lib/demo';
import { supabaseServer } from '@/lib/supabase/server';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (!demoEnabled) {
    let authenticated = false;
    try {
      const db = await supabaseServer();
      const {
        data: { user },
      } = await db.auth.getUser();
      authenticated = !!user;
    } catch {}
    if (!authenticated) redirect('/login');
    return (
      <main className="auth">
        <section className="card">
          <h1>Account connected</h1>
          <p>
            The full interactive workspace currently uses isolated demonstration data. Production
            profile and outreach screens will be connected in the next phase.
          </p>
          <p>
            No sample records are shown as your real data. The authenticated application API is
            available at /api/applications.
          </p>
          <form action="/auth/logout" method="post">
            <button className="button">Sign out</button>
          </form>
        </section>
      </main>
    );
  }
  return <Shell>{children}</Shell>;
}
