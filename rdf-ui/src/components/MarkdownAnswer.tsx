import type { ReactNode } from "react";
import katex from "katex";

type RagSource = {
  chunk_id?: string;
  href?: string;
  label?: string;
  document_id?: string;
  filename?: string;
  page?: number;
};

type MarkdownAnswerProps = {
  sources?: RagSource[];
  text: string;
};

function shortSourceLabel(source: RagSource, index: number): string {
  if (source.label) return source.label;
  const filename = source.filename?.replace(/\.pdf$/i, "") ?? `Source ${index + 1}`;
  return source.page ? `${filename} p.${source.page}` : filename;
}

function sourceHref(source: RagSource): string | null {
  if (source.href) return source.href;
  if (!source.chunk_id) return null;
  const params = new URLSearchParams({
    chunkId: source.chunk_id,
    filename: source.filename ?? "highlighted.pdf",
  });
  return `/api/rag/source?${params.toString()}`;
}

function sourceChip(source: RagSource, index: number, key: string): ReactNode {
  const href = sourceHref(source);
  const className = "mx-0.5 inline-flex h-5 max-w-28 items-center overflow-hidden rounded-full border border-gray-300 px-1.5 text-[10px] leading-none text-gray-600 align-[0.08em] transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800";
  const label = shortSourceLabel(source, index);
  const title = source.filename ?? source.href ?? source.label ?? `Source ${index + 1}`;

  if (!href) {
    return (
      <span key={key} title={title} className={className}>
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      className={className}
    >
      <span className="truncate">{label}</span>
    </a>
  );
}

function splitTrailingUrlPunctuation(raw: string): { clean: string; trailing: string } {
  const match = raw.match(/^(.+?)([\].,;!?]+)?$/);
  return {
    clean: match?.[1] ?? raw,
    trailing: match?.[2] ?? "",
  };
}

function hrefFromRawLink(raw: string): string {
  if (raw.startsWith("www.")) return `https://${raw}`;
  if (/^10\.\d{4,9}\//.test(raw)) return `https://doi.org/${raw}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) return `https://github.com/${raw}`;
  return raw;
}

function isLinkLike(raw: string): boolean {
  return /^(https?:\/\/|www\.|10\.\d{4,9}\/|[\w.-]+\/[\w.-]+$)/.test(raw);
}

function renderBareLink(raw: string, key: string): ReactNode[] {
  return raw.split(/(\s+)/).flatMap((part, index) => {
    if (!part) return [];
    if (/^\s+$/.test(part)) return part;
    if (!isLinkLike(part)) return part;

    const { clean, trailing } = splitTrailingUrlPunctuation(part);
    return [
      <a
        key={`${key}-${index}`}
        href={hrefFromRawLink(clean)}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {clean}
      </a>,
      trailing,
    ];
  });
}

function renderDocumentSourceButtons(rawCitation: string, sources: RagSource[]): ReactNode[] | null {
  const ids = Array.from(rawCitation.matchAll(/doc\s+([A-Za-z0-9-]+)(?:#[\w.-]+)?/g))
    .map((match) => match[1])
    .filter(Boolean);

  if (ids.length === 0) return null;

  const matches = ids.flatMap((id) => sources.filter((source) => source.document_id === id));
  if (matches.length === 0) return null;

  const seen = new Set<string>();
  return matches.flatMap((source, index) => {
    if (!source.chunk_id) return [];
    if (seen.has(source.chunk_id)) return [];
    seen.add(source.chunk_id);
    return sourceChip(source, index, `${source.chunk_id}-${index}`);
  });
}

function renderLatex(raw: string, displayMode: boolean, key: string): ReactNode {
  try {
    return (
      <span
        key={key}
        className={
          displayMode
            ? "my-3 block max-w-full overflow-x-auto overflow-y-hidden"
            : "inline inline-baseline overflow-visible"
        }
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(raw, {
            displayMode,
            throwOnError: false,
          }),
        }}
      />
    );
  } catch {
    return displayMode ? `$$${raw}$$` : `$${raw}$`;
  }
}

function renderInline(text: string, sources: RagSource[]): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\$\$([^$]+)\$\$|\$([^$\n]+)\$|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]((?:\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)))|\[((?:https?:\/\/|www\.)[^\]\s),]+)\]|\[([^\]]*doc\s+[^\]]+)\]|((?:https?:\/\/|www\.)[^\s),]+|10\.\d{4,9}\/[^\s),]+))/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[2]) {
      nodes.push(renderLatex(match[2], true, `latex-block-${match.index}`));
    } else if (match[3]) {
      nodes.push(renderLatex(match[3], false, `latex-inline-${match.index}`));
    } else if (match[4]) {
      nodes.push(<strong key={match.index}>{match[4]}</strong>);
    } else if (match[5]) {
      if (isLinkLike(match[5])) {
        nodes.push(...renderBareLink(match[5], `code-link-${match.index}`));
      } else {
        nodes.push(
          <code key={match.index} className="rounded bg-black/10 px-1 py-0.5 text-[0.92em] dark:bg-white/10">
            {match[5]}
          </code>,
        );
      }
    } else if (match[6] && match[8]) {
      const { clean, trailing } = splitTrailingUrlPunctuation(match[8]);
      nodes.push(
        <a
          key={match.index}
          href={hrefFromRawLink(clean)}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {match[6]}
        </a>,
        trailing,
      );
    } else if (match[9]) {
      nodes.push(...renderBareLink(match[9], `bracket-uri-${match.index}`));
    } else if (match[10]) {
      const sourceButtons = renderDocumentSourceButtons(match[10], sources);
      nodes.push(sourceButtons ?? `[${match[10]}]`);
    } else if (match[11]) {
      nodes.push(...renderBareLink(match[11], `uri-${match.index}`));
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default function MarkdownAnswer({ sources = [], text }: MarkdownAnswerProps) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList(keyPrefix: string): void {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`${keyPrefix}-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`${keyPrefix}-${index}`}>{renderInline(item, sources)}</li>
        ))}
      </ul>,
    );
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);

    if (bullet?.[1]) {
      listItems.push(bullet[1]);
      return;
    }

    flushList(`list-${index}`);

    if (!trimmed) return;
    blocks.push(
      <p key={`p-${index}`} className="leading-6">
        {renderInline(trimmed, sources)}
      </p>,
    );
  });

  flushList("list-end");

  return <div className="space-y-3">{blocks}</div>;
}
