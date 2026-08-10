import LegalContent, { type LegalContentProps } from "@/components/legal/LegalContent";

export default function TermsOfUse(props: LegalContentProps) {
  return (
    <LegalContent heading="Terms of Use" headingId="terms-of-use-heading" {...props}>
      <p>
        This service is provided for research and informational purposes. Users are responsible for the content they
        upload and must not upload unlawful or unauthorized material.
      </p>
      <p>
        Uploaded documents may be stored and processed to provide the RAG functionality. The service may change or
        become temporarily unavailable.
      </p>
      <p>By using this service, you agree to these Terms of Use.</p>
    </LegalContent>
  );
}
