import type { ReactNode } from "react";

export default function CookiesLayout({ children }: { children: ReactNode }) {
  return <div className="legal-register-palette contents">{children}</div>;
}
