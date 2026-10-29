'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth">
      <section className="card">
        <h1>Something interrupted your workspace.</h1>
        <p>Please try again. No external action was performed.</p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
