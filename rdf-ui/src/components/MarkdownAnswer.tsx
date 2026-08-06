import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

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
  tail?: ReactNode;
  text: string;
};

const STREAM_TAIL_HREF = "rag-stream-tail";

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

function escapeMarkdownLabel(label: string): string {
  return label.replace(/([\\[\]])/g, "\\$1");
}

function addSourceLinks(text: string, sources: RagSource[]): string {
  return text.replace(/\[([^\]]*doc\s+[^\]]+)\]/gi, (citation) => {
    const ids = Array.from(citation.matchAll(/doc\s+([A-Za-z0-9-]+)(?:#[\w.-]+)?/gi), (match) => match[1]);
    const seen = new Set<string>();
    const links = ids.flatMap((id) =>
      sources
        .filter((source) => source.document_id === id)
        .flatMap((source, index) => {
          const href = sourceHref(source);
          const key = source.chunk_id ?? href;
          if (!href || !key || seen.has(key)) return [];
          seen.add(key);
          return [`[${escapeMarkdownLabel(shortSourceLabel(source, index))}](${href})`];
        }),
    );

    return links.length > 0 ? links.join(" ") : citation;
  });
}

export default function MarkdownAnswer({ sources = [], tail, text }: MarkdownAnswerProps) {
  const markdown = `${addSourceLinks(text, sources)}${tail ? `[\u200b](${STREAM_TAIL_HREF})` : ""}`;
  const sourceHrefs = new Set(sources.flatMap((source) => sourceHref(source) ?? []));
  const components: Components = {
    a: ({ children, href }) => {
      if (href === STREAM_TAIL_HREF) return tail;
      const isSource = href ? sourceHrefs.has(href) : false;

      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={
            isSource
              ? "mx-0.5 inline-flex h-5 max-w-28 items-center overflow-hidden rounded-full border border-gray-300 px-1.5 text-[10px] leading-none text-gray-600 no-underline transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              : "underline underline-offset-2"
          }
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="space-y-3 break-words [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 dark:[&_blockquote]:border-gray-600 dark:[&_blockquote]:text-gray-300 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.92em] dark:[&_code]:bg-white/10 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:border-gray-300 dark:[&_hr]:border-gray-700 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:leading-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/10 [&_pre]:p-3 dark:[&_pre]:bg-white/10 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 dark:[&_td]:border-gray-700 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:text-left dark:[&_th]:border-gray-700 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
