import type { Metadata } from "next";

import { ImportTermsForm } from "@/components/admin/ImportTermsForm";
import { BackLink, PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Importer des termes — Administration — Crochet Translator",
};

export default function ImportTermsPage() {
  return (
    <PageShell>
      <div className="flex flex-col gap-2">
        <BackLink href="/admin/terms">← Retour à la liste des termes</BackLink>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Importer des termes
        </h1>
        <p className="text-base leading-relaxed text-stone-600">
          L’import ajoute seulement ce qui est nouveau. Il n’écrase jamais une
          fiche déjà présente (label, description, chemin d’image) et ne
          supprime aucun alias. Une prévisualisation est obligatoire avant
          toute écriture.
        </p>
        <p className="text-sm leading-relaxed text-stone-500">
          L’administration n’a aucune authentification dans ce jalon. Elle est
          destinée à un usage local ou privé.
        </p>
      </header>

      <ImportTermsForm />
    </PageShell>
  );
}
