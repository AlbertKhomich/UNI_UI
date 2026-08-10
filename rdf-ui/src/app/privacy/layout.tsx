import type { ReactNode } from "react";

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return <div className="legal-register-palette contents">{children}</div>;
}
