import { CreateTutorialForm } from "@/components/CreateTutorialForm";
import { PageShell, SecondaryButtonLink } from "@/components/PageShell";

export default function HomePage() {
  return (
    <PageShell>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Créer un tuto de crochet
        </h1>
        <p className="text-base leading-relaxed text-stone-600">
          Colle ton patron ligne par ligne. Chaque rang devient une étape que tu
          pourras suivre pas à pas.
        </p>
      </header>

      <SecondaryButtonLink href="/tutorials">Voir mes tutos</SecondaryButtonLink>

      <CreateTutorialForm />
    </PageShell>
  );
}
