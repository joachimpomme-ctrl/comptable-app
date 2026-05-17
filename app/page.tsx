import { auth, signOut } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold">
            Agent IA Comptable &amp; Patrimoine
          </h1>
          <p className="text-sm text-neutral-500">Phase 0 — scaffold</p>
        </div>
        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
            >
              Se déconnecter
            </button>
          </form>
        ) : null}
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Session
        </h2>
        <div className="mt-3 space-y-1 text-sm">
          <div>
            <span className="text-neutral-500">Email :</span>{" "}
            <span className="font-mono">{session?.user?.email ?? "—"}</span>
          </div>
          <div>
            <span className="text-neutral-500">User ID :</span>{" "}
            <span className="font-mono">{session?.user?.id ?? "—"}</span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Prochaines étapes
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-neutral-700">
          <li>Phase 1 — UI chat (streaming) + persistance conversations</li>
          <li>Phase 1 — Tool use Claude (read_document, search_knowledge…)</li>
          <li>Phase 2 — Intégration Drive (upload, lecture, création Sheets)</li>
          <li>Phase 2 — Templates de simulations (Zod + compute déterministe)</li>
        </ul>
      </section>
    </main>
  );
}
