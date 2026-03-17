"use client";

import Image from "next/image";
import { FaFilePdf, FaGithub } from "react-icons/fa";
import { countryCodeToFlag, countryCodeToName, toCountryCode } from "@/lib/country";
import { isGithubUrl } from "@/lib/query";
import type { PaperDetails } from "@/lib/types";

type PaperDetailsPanelProps = {
  detail: PaperDetails | undefined;
  detailsClass: string;
  detailsError: string | undefined;
  isDark: boolean;
  loadingDetails: boolean;
  onSelectAuthor: (iri: string, name: string) => void;
};

function toUniqueTrimmed(values: string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

export default function PaperDetailsPanel(props: PaperDetailsPanelProps) {
  const { detail, detailsClass, detailsError, isDark, loadingDetails, onSelectAuthor } = props;

  const keywords = detail?.keywords ?? [];
  const fields = detail?.fields ?? [];
  const subfields = detail?.subfields ?? [];
  const whereParts: string[] = [];
  if (detail?.volume) whereParts.push(`Vol. ${detail.volume}`);
  if (detail?.issue) whereParts.push(`Issue ${detail.issue}`);

  const pages =
    detail?.pageStart && detail?.pageEnd
      ? `pp. ${detail.pageStart}-${detail.pageEnd}`
      : detail?.pageStart
        ? `p. ${detail.pageStart}`
        : detail?.pageEnd
          ? `p. ${detail.pageEnd}`
          : null;

  if (pages) whereParts.push(pages);

  const pdfUrls = toUniqueTrimmed(detail?.urls);
  const repositoryUrls = toUniqueTrimmed(detail?.codeRepositories);
  const githubUrls = repositoryUrls.filter(isGithubUrl);
  const otherRepositoryUrls = repositoryUrls.filter((url) => !isGithubUrl(url));

  return (
    <div className={detailsClass}>
      {loadingDetails && <div>Loading details...</div>}
      {detailsError && (
        <div
          role="alert"
          className={
            isDark
              ? "rounded-lg border border-red-500/60 bg-red-950/30 px-3 py-2 text-sm text-red-100"
              : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          <div className="font-medium">Couldn&apos;t load expanded paper information.</div>
          <div className="mt-1">{detailsError}</div>
        </div>
      )}

      {detail && !loadingDetails && !detailsError && (
        <div className="space-y-2">
          {detail.subtitle && (
            <div>
              <span className="font-medium">Subtitle:</span> {detail.subtitle}
            </div>
          )}

          {detail.isPartOfNames?.[0] && (
            <div>
              <span className="font-medium">Journal:</span> {detail.isPartOfNames[0]}
            </div>
          )}

          {whereParts.length > 0 && (
            <div>
              <span className="font-medium">Where:</span> {whereParts.join(", ")}
            </div>
          )}

          {keywords.length > 0 && (
            <div>
              <span className="font-medium">Keywords:</span> {keywords.slice(0, 12).join(", ")}
            </div>
          )}
          {fields.length > 0 && (
            <div>
              <span className="font-medium">Fields:</span> {fields.slice(0, 12).join(", ")}
            </div>
          )}
          {subfields.length > 0 && (
            <div>
              <span className="font-medium">Subfields:</span> {subfields.slice(0, 12).join(", ")}
            </div>
          )}

          {detail.abstract && (
            <div className={isDark ? "text-gray-400" : "text-gray-600"}>
              <span className="font-medium">Abstract:</span>{" "}
              <span className={isDark ? "mt-1 block line-clamp-4 text-gray-200" : "mt-1 block line-clamp-4 text-gray-700"}>
                {detail.abstract}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {detail.sameAs && (
              <a className="underline" href={detail.sameAs} target="_blank" rel="noreferrer">
                DOI
              </a>
            )}

            {githubUrls.map((githubUrl) => (
              <a
                key={githubUrl}
                className="inline-flex items-center gap-1.5 underline"
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub repository"
                title="GitHub repository"
              >
                <FaGithub />
                <span>GitHub</span>
              </a>
            ))}

            {otherRepositoryUrls.map((repoUrl, idx) => (
              <a key={repoUrl} className="underline" href={repoUrl} target="_blank" rel="noreferrer">
                {otherRepositoryUrls.length > 1 ? `Repository ${idx + 1}` : "Repository"}
              </a>
            ))}

            {pdfUrls.map((pdfUrl, idx) => (
              <a
                key={pdfUrl}
                className="inline-flex items-center gap-1.5 underline"
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="PDF file"
                title="PDF file"
              >
                <FaFilePdf />
                <span>{pdfUrls.length > 1 ? `PDF ${idx + 1}` : "PDF"}</span>
              </a>
            ))}
          </div>

          <div>
            <span className="font-medium">Authors:</span>
            <ul className="mt-1 space-y-1">
              {detail.authorsDetailed?.map((author) => (
                <li key={author.iri}>
                  <div className={isDark ? "text-gray-200" : "text-gray-800"}>
                    <button type="button" className="hover:underline" onClick={() => onSelectAuthor(author.iri, author.name)}>
                      {author.name}
                    </button>
                    {author.orcid ? (
                      <a
                        href={author.orcid}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex align-middle"
                        aria-label={`${author.name} ORCID`}
                        title="ORCID"
                      >
                        <Image src="/orcid2.png" alt="ORCID" width={14} height={14} />
                      </a>
                    ) : null}
                  </div>

                  {author.affiliations.length > 0 && (
                    <div className={isDark ? "text-xs text-gray-400" : "text-xs text-gray-500"}>
                      {author.affiliations.map((affiliation, index) => {
                        const ccRaw = (affiliation.countryRaw ?? "").trim();
                        const ccCode = toCountryCode(ccRaw);
                        const flag = ccCode ? countryCodeToFlag(ccCode) : "";
                        const countryTitle = ccCode ? `${countryCodeToName(ccCode, "en")} (${ccCode})` : ccRaw;
                        const affHref = (affiliation.sameAs ?? "").toLowerCase().includes("ror.org")
                          ? affiliation.sameAs
                          : undefined;

                        return (
                          <span key={`${author.iri}-aff-${index}`}>
                            <span title={affiliation.name}>
                              {affHref ? (
                                <a href={affHref} target="_blank" rel="noopener noreferrer">
                                  {affiliation.name}
                                </a>
                              ) : (
                                <span>{affiliation.name}</span>
                              )}
                            </span>
                            {countryTitle ? (
                              <span className="ml-1" title={countryTitle}>
                                {flag || countryTitle}
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
