import type { Metadata } from "next";
import Link from "next/link";

import {
  BackLink,
  PageShell,
  PrimaryButtonLink,
  SecondaryButtonLink,
} from "@/components/PageShell";
import { listTermsForAdmin } from "@/lib/terms";

export const metadata: Metadata = {
  title: "Termes — Administration — Crochet Translator",
};

type TermsAdminPageProps = {
  searchParams: Promise<{ deleted?: string }>;
};

function excerpt(text: string | null, max = 100): string {
  if (!text) {
    return "—";
  }

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max).trimEnd()}…`;
}

export default async function TermsAdminPage({
  searchParams,
}: TermsAdminPageProps) {
  const { deleted } = await searchParams;
  const terms = await listTermsForAdmin();
  const deletedCode = deleted?.trim();

  return (
    <PageShell>
      <div className="flex flex-col gap-2">
        <BackLink href="/">← Retour à l’accueil</BackLink>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Administration des termes
        </h1>
        <p className="text-base leading-relaxed text-stone-600">
          {terms.length > 0
            ? `${terms.length} terme${terms.length > 1 ? "s" : ""}`
            : "Aucun terme pour le moment."}
        </p>
      </header>

      {deletedCode ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Le terme « {deletedCode} » a été supprimé.
        </p>
      ) : null}

      <PrimaryButtonLink href="/admin/terms/new">
        Ajouter un terme
      </PrimaryButtonLink>
      <SecondaryButtonLink href="/admin/terms/import">
        Importer un fichier JSON
      </SecondaryButtonLink>

      {terms.length === 0 ? (
        <p className="text-stone-600">
          La base ne contient aucun terme. Ajoute le premier pour que le
          lecteur puisse reconnaître des codes et des alias.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          {terms.map((term) => (
            <article
              key={term.id}
              className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-mono text-sm font-semibold tracking-wide text-rose-700">
                    {term.code}
                  </p>
                  <p className="text-base font-semibold text-stone-900">
                    {term.label}
                  </p>
                  <p className="text-sm text-stone-600">
                    {excerpt(term.description)}
                  </p>
                  <p className="text-xs text-stone-500">
                    Image : {term.imagePath ?? "—"}
                  </p>
                  <p className="text-sm text-stone-500">
                    {term.aliases.length === 0
                      ? "Aucun alias"
                      : `${term.aliases.length} alias : ${term.aliases
                          .map((alias) => alias.alias)
                          .join(", ")}`}
                  </p>
                </div>
                <Link
                  href={`/admin/terms/${term.id}`}
                  className="flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  Modifier
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </PageShell>
  );
}
