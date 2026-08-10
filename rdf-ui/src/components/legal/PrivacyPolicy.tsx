import LegalContent, { type LegalContentProps } from "@/components/legal/LegalContent";

export default function PrivacyPolicy(props: LegalContentProps) {
  return (
    <LegalContent heading="Privacy Policy" headingId="privacy-policy-heading" {...props}>
      <p>
        We process your email address, account information, uploaded documents, and queries to provide and operate this
        service.
      </p>
      <p>
        Uploaded documents and related data are stored only as necessary for providing the service and are not used for
        unrelated purposes.
      </p>
      <p>
        Data is deleted when it is no longer required or when your account/data is deleted, unless legal retention
        requirements apply.
      </p>
      <p>
        You have the rights provided under the GDPR, including access, correction, deletion, restriction, and objection.
      </p>
      <div>
        <p><strong>Controller:</strong> Dice Research Group</p>
        <p>
          <strong>Contact:</strong>{" "}
          <a
            className="font-semibold text-blue-600 underline decoration-blue-600/50 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            href="mailto:akhomich@mail.uni-paderborn.de"
          >
            akhomich@mail.uni-paderborn.de
          </a>
        </p>
      </div>
    </LegalContent>
  );
}
