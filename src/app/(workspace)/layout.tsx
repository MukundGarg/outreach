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
    return <Shell isDemo={false}>{children}</Shell>;
  }
  return <Shell isDemo={true}>{children}</Shell>;
}
