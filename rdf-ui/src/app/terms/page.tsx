import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import TermsOfUse from "@/components/legal/TermsOfUse";

export const metadata: Metadata = {
  title: "Terms of Use | UNI-KG",
};

export default function TermsPage() {
  return (
    <LegalPage>
      <TermsOfUse />
    </LegalPage>
  );
}
