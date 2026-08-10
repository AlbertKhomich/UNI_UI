import type { ElementType, ReactNode } from "react";

export type LegalContentProps = {
  className?: string;
  headingLevel?: "h1" | "h2";
};

type LegalSectionProps = LegalContentProps & {
  children: ReactNode;
  heading: string;
  headingId: string;
};

export default function LegalContent({
  children,
  className = "",
  heading,
  headingId,
  headingLevel = "h1",
}: LegalSectionProps) {
  const Heading: ElementType = headingLevel;

  return (
    <section aria-labelledby={headingId} className={className}>
      <Heading
        className={`font-bold tracking-[-0.02em] text-slate-950 dark:text-white ${
          headingLevel === "h1" ? "text-2xl sm:text-3xl" : "text-lg"
        }`}
        id={headingId}
      >
        {heading}
      </Heading>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300 sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}
