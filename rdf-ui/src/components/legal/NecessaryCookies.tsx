import LegalContent, { type LegalContentProps } from "@/components/legal/LegalContent";

export default function NecessaryCookies(props: LegalContentProps) {
  return (
    <LegalContent heading="Necessary Cookies" headingId="necessary-cookies-heading" {...props}>
      <p>We use only strictly necessary cookies for authentication and security.</p>
      <p>These include:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>a session-token cookie to keep you signed in,</li>
        <li>CSRF cookies to protect the authentication process, and</li>
        <li>callback cookies used during sign-in.</li>
      </ul>
      <p>
        These cookies are not used for advertising, analytics, or tracking. They are configured as <code>HttpOnly</code>,{" "}
        <code>SameSite=Lax</code>, and, in production, <code>Secure</code> over HTTPS.
      </p>
    </LegalContent>
  );
}
