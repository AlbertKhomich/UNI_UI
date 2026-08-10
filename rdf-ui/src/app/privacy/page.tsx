import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import PrivacyPolicy from "@/components/legal/PrivacyPolicy";

export const metadata: Metadata = {
  title: "Privacy Policy | UNI-KG",
};

export default function PrivacyPage() {
  return (
    <LegalPage>
      <PrivacyPolicy />
    </LegalPage>
  );
}
