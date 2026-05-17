import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

type SearchParams = Promise<{
  callbackUrl?: string;
  error?: string;
}>;

const ERROR_LABELS: Record<string, string> = {
  AccessDenied:
    "Cet email n'est pas autorisé à utiliser l'application. Demande à l'admin de t'ajouter à l'allowlist.",
  Configuration:
    "Erreur de configuration de l'authentification. Vérifie les variables AUTH_*.",
  Verification: "Lien expiré ou déjà utilisé.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  if (session?.user) {
    redirect(callbackUrl ?? "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold">Agent IA Comptable</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Accès réservé. Authentification Google requise.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {ERROR_LABELS[error] ?? `Erreur : ${error}`}
          </div>
        ) : null}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", {
              redirectTo: callbackUrl ?? "/",
            });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
          >
            Se connecter avec Google
          </button>
        </form>
      </div>
    </main>
  );
}
