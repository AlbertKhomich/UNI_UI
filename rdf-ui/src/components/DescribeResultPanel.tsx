"use client";

type DescribeResultPanelProps = {
  body: string;
  contentType: string;
  error: string | null;
  iri: string;
  isDark: boolean;
  loading: boolean;
};

export default function DescribeResultPanel(props: DescribeResultPanelProps) {
  const {
    body,
    contentType,
    error,
    iri,
    isDark,
    loading,
  } = props;

  return (
    <section
      className={`mt-4 rounded-xl border p-4 ${
        isDark ? "border-gray-600 bg-gray-900/40" : "border-gray-200 bg-gray-50"
      }`}
      aria-live="polite"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold">Resource Description (DESCRIBE)</h2>
        <a className="text-sm underline" href={iri} target="_blank" rel="noreferrer">
          {iri}
        </a>
      </div>

      {loading ? <div className="text-sm">Loading resource description...</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {!loading && !error ? (
        <>
          {contentType ? (
            <div className={isDark ? "mb-2 text-xs text-gray-400" : "mb-2 text-xs text-gray-600"}>
              Content type: {contentType}
            </div>
          ) : null}
          <pre
            className={`max-h-[420px] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap break-words ${
              isDark ? "bg-black/40 text-gray-100" : "bg-white text-gray-800"
            }`}
          >
            {body || "# No triples returned for this resource."}
          </pre>
        </>
      ) : null}
    </section>
  );
}
