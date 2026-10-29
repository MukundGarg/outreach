import Link from 'next/link';
import {
  ArrowRight,
  Check,
  FileUser,
  Mail,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Brand } from '@/components/shell';
export default function Landing() {
  return (
    <main className="landing">
      <nav>
        <Brand />
        <div className="row">
          <Link href="/login">Log in</Link>
          <Link className="button primary" href="/signup">
            Get started <ArrowRight size={15} />
          </Link>
        </div>
      </nav>
      <section className="landing-hero">
        <span className="badge">
          <Sparkles size={13} /> A more intentional job search
        </span>
        <h1>
          Your next chapter.
          <br />
          <span style={{ color: '#54816a' }}>With a little tailwind.</span>
        </h1>
        <p>
          Bring your applications, recruiter conversations, and next steps into one calm,
          intelligent workspace.
        </p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="button primary" href="/dashboard">
            Explore the demo <ArrowRight size={17} />
          </Link>
          <Link className="button" href="/signup">
            Create an account
          </Link>
        </div>
        <p style={{ fontSize: 11, marginTop: 17 }}>
          Credential-free demo · Clearly labeled sample data · You stay in control
        </p>
      </section>
      <section className="landing-preview">
        <div className="between">
          <div>
            <span className="eyebrow muted">YOUR CAREER, IN MOTION</span>
            <h2 style={{ fontSize: 27, marginTop: 14 }}>Less tracking. More possibility.</h2>
          </div>
          <TrendingUp size={38} color="#54816a" />
        </div>
        <div className="grid2">
          <div className="card">
            <div className="eyebrow muted">A THOUGHTFUL PIPELINE</div>
            <h1 style={{ margin: '18px 0' }}>8 opportunities</h1>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="badge interview">1 interview</span>
              <span className="badge offer">1 offer</span>
              <span className="badge">Sample overview</span>
            </div>
          </div>
          <div className="card">
            <h3>Your next move, made clear</h3>
            {[
              'Build a verified candidate profile',
              'Prepare tailored answers and outreach',
              'Review every important action',
            ].map((v) => (
              <p className="row" key={v}>
                <Check size={16} color="#54816a" />
                {v}
              </p>
            ))}
          </div>
        </div>
      </section>
      <section style={{ marginTop: 70 }}>
        <span className="eyebrow muted">HOW IT WORKS</span>
        <h1 style={{ marginTop: 16 }}>From possibility to progress.</h1>
        <div className="landing-features">
          {[
            [
              FileUser,
              '01 · Make it yours',
              'Bring your experience, skills, and preferences into a single candidate profile.',
            ],
            [
              ScanLine,
              '02 · Find your focus',
              'Organize opportunities and prepare thoughtful, job-specific applications.',
            ],
            [
              Mail,
              '03 · Keep the conversation going',
              'Review outreach and plan follow-ups with a clear view of every next step.',
            ],
          ].map(([Icon, title, copy]) => {
            const I = Icon as typeof Mail;
            return (
              <article className="card" key={String(title)}>
                <I size={24} color="#54816a" />
                <h2 style={{ marginTop: 23 }}>{String(title)}</h2>
                <p className="muted">{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <div className="notice row">
        <ShieldCheck size={20} />
        <span>
          This foundation demonstrates your workspace with mock AI. Live Gmail, automated
          submissions, and external agent execution are not enabled. Your approval will always come
          first.
        </span>
      </div>
      <footer className="footer">
        <Brand />
        <span>Built for thoughtful careers. ApplyPilot AI · 2026</span>
      </footer>
    </main>
  );
}
