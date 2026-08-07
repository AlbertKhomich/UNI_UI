import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export default function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <main className={`mx-auto max-w-[900px] p-6 font-sans ${className}`}>
      {children}
    </main>
  );
}
