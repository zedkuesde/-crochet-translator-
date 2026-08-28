type StepCardProps = {
  index: number;
  label: string;
};

export function StepCard({ index, label }: StepCardProps) {
  return (
    <article className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-medium text-stone-500">Étape {index}</p>
      <p className="mt-1 font-mono text-base leading-relaxed text-stone-900">
        {label}
      </p>
    </article>
  );
}
