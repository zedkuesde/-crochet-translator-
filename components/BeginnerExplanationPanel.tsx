import {
  toBeginnerExplanationCopy,
  UNSUPPORTED_EXPLANATION_NOTE,
  type BeginnerExplanation,
} from "@/lib/beginner-explanation";

type BeginnerExplanationPanelProps = {
  explanation: BeginnerExplanation;
};

export function BeginnerExplanationPanel({
  explanation,
}: BeginnerExplanationPanelProps) {
  const headingId = "beginner-explanation-title";

  if (explanation.kind === "unsupported") {
    return (
      <section
        aria-labelledby={headingId}
        className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5"
      >
        <h2
          id={headingId}
          className="text-base font-semibold text-stone-800"
        >
          Explication débutant
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          {UNSUPPORTED_EXPLANATION_NOTE}
        </p>
      </section>
    );
  }

  const copy = toBeginnerExplanationCopy(explanation);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5"
    >
      <h2 id={headingId} className="text-base font-semibold text-stone-800">
        Explication débutant
      </h2>

      <div className="mt-3 flex flex-col gap-3 text-base leading-relaxed text-stone-800">
        {copy.rowIntro ? <p>{copy.rowIntro}</p> : null}

        {copy.parts.map((part, partIndex) => {
          const useNumberedList =
            part.heading !== undefined || part.actionLines.length > 1;

          return (
            <div key={`${part.heading ?? "actions"}-${partIndex}`} className="flex flex-col gap-3">
              {part.heading ? <p>{part.heading}</p> : null}

              {useNumberedList ? (
                <ol className="list-decimal space-y-1 pl-6">
                  {part.actionLines.map((line, index) => (
                    <li key={`${partIndex}-${index}`}>{line}</li>
                  ))}
                </ol>
              ) : (
                <p>{part.actionLines[0]}</p>
              )}
            </div>
          );
        })}

        {copy.positionCautionNote ? (
          <p className="text-sm leading-relaxed text-stone-600">
            {copy.positionCautionNote}
          </p>
        ) : null}

        {copy.expectedStitchCountLine ? (
          <p>{copy.expectedStitchCountLine}</p>
        ) : null}
      </div>
    </section>
  );
}
