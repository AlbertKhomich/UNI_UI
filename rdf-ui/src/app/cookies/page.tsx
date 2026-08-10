import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import NecessaryCookies from "@/components/legal/NecessaryCookies";

export const metadata: Metadata = {
  title: "Cookies | UNI-KG",
};

export default function CookiesPage() {
  return (
    <LegalPage>
      <NecessaryCookies />
    </LegalPage>
  );
}
