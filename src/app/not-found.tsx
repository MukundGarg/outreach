import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth">
      <section className="card">
        <h1>A small detour.</h1>
        <p>That page could not be found.</p>
        <Link className="button primary" href="/dashboard">
          Return to your workspace
        </Link>
      </section>
    </main>
  );
}
