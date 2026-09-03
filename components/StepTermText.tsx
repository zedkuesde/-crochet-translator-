"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TermHelpModal } from "@/components/TermHelpModal";
import {
  segmentStepText,
  type CrochetTermHelp,
  type CrochetTermWithAliases,
} from "@/lib/crochet-terms";

type StepTermTextProps = {
  text: string;
  terms: CrochetTermWithAliases[];
};

export function StepTermText({ text, terms }: StepTermTextProps) {
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<CrochetTermHelp | null>(
    null,
  );

  const closeTermHelp = useCallback((): void => {
    setSelectedTerm(null);
  }, []);

  useEffect(() => {
    closeTermHelp();
  }, [text, closeTermHelp]);

  const segments = segmentStepText(text, terms);

  return (
    <>
      <p className="text-center font-mono text-xl leading-relaxed text-stone-900 sm:text-2xl">
        {segments.map((segment, index) => {
          if (segment.type === "text") {
            return <span key={`text-${index}`}>{segment.value}</span>;
          }

          return (
            <button
              key={`term-${segment.term.id}-${index}`}
              type="button"
              className="relative inline rounded-md bg-rose-50 px-0.5 py-0.5 text-inherit underline decoration-rose-300 decoration-1 underline-offset-2 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              aria-label={`Aide : ${segment.term.label}`}
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setSelectedTerm(segment.term);
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-y-2 -inset-x-1 sm:-inset-y-1"
              />
              {segment.value}
            </button>
          );
        })}
      </p>

      <TermHelpModal
        term={selectedTerm}
        onClose={closeTermHelp}
        returnFocusRef={openerRef}
      />
    </>
  );
}
