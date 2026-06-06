'use client';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="card">
        <h1 className="text-xl font-semibold">Nao foi possivel carregar o dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">Ocorreu uma falha temporaria ao carregar os dados. Tente novamente em instantes.</p>
        <button className="btn mt-5" type="button" onClick={reset}>Tentar novamente</button>
      </section>
    </main>
  );
}
