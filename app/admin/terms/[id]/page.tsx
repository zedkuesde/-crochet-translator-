import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TermForm } from "@/components/admin/TermForm";
import { BackLink, PageShell } from "@/components/PageShell";
import { getTermById } from "@/lib/terms";

type EditTermPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: EditTermPageProps): Promise<Metadata> {
  const { id } = await params;
  const term = await getTermById(id);

  return {
    title: term
      ? `Modifier ${term.code} — Administration — Crochet Translator`
      : "Terme introuvable — Administration — Crochet Translator",
  };
}

export default async function EditTermPage({ params }: EditTermPageProps) {
  const { id } = await params;
  const term = await getTermById(id);

  if (!term) {
    notFound();
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-2">
        <BackLink href="/admin/terms">← Retour à la liste des termes</BackLink>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Modifier « {term.code} »
        </h1>
        <p className="text-base leading-relaxed text-stone-600">
          Enregistre les champs du terme, puis ajoute ou retire les alias
          séparément.
        </p>
      </header>

      <TermForm
        mode="edit"
        term={{
          id: term.id,
          code: term.code,
          label: term.label,
          description: term.description,
          imagePath: term.imagePath,
          aliases: term.aliases,
        }}
      />
    </PageShell>
  );
}
