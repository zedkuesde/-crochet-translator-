import type { Metadata } from "next";

import { TermForm } from "@/components/admin/TermForm";
import { BackLink, PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Nouveau terme — Administration — Crochet Translator",
};

export default function NewTermPage() {
  return (
    <PageShell>
      <div className="flex flex-col gap-2">
        <BackLink href="/admin/terms">← Retour à la liste des termes</BackLink>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Ajouter un terme
        </h1>
        <p className="text-base leading-relaxed text-stone-600">
          Le code est obligatoire. Les alias peuvent être préparés ici, puis
          enregistrés avec le terme.
        </p>
      </header>

      <TermForm mode="create" />
    </PageShell>
  );
}
