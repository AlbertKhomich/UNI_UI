import Image from "next/image";

type DiceFooterProps = {
  className?: string;
};

export default function DiceFooter({ className = "" }: DiceFooterProps) {
  return (
    <footer className={`flex items-center justify-center ${className}`}>
      <a
        aria-label="DICE research group"
        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-slate-950"
        href="https://dice-research.org/"
        rel="noreferrer"
        target="_blank"
      >
        <Image
          alt="DICE research group"
          className="h-auto dark:invert"
          height={48}
          src="/logo.svg"
          width={120}
        />
      </a>
    </footer>
  );
}
