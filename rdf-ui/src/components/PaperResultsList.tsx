"use client";

import type { RefObject } from "react";
import PaperListItem from "@/components/PaperListItem";
import type { PaperDetails, SearchItem } from "@/lib/types";

type PaperResultsListProps = {
  canSearch: boolean;
  details: Record<string, PaperDetails>;
  detailsClass: string;
  detailsErr: Record<string, string>;
  detailsLoading: Record<string, boolean>;
  hasMore: boolean;
  isDark: boolean;
  items: SearchItem[];
  loadMoreRef: RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  onSelectAuthor: (iri: string, name: string) => void;
  onTogglePaperOpen: (id: string) => void;
  openIds: Set<string>;
  subtleTextClass: string;
};

export default function PaperResultsList(props: PaperResultsListProps) {
  const {
    canSearch,
    details,
    detailsClass,
    detailsErr,
    detailsLoading,
    hasMore,
    isDark,
    items,
    loadMoreRef,
    loadingMore,
    onSelectAuthor,
    onTogglePaperOpen,
    openIds,
    subtleTextClass,
  } = props;

  return (
    <>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <PaperListItem
            key={item.iri}
            detail={details[item.id]}
            detailsClass={detailsClass}
            detailsError={detailsErr[item.id]}
            isDark={isDark}
            isOpen={openIds.has(item.id)}
            item={item}
            loadingDetails={!!detailsLoading[item.id]}
            onSelectAuthor={onSelectAuthor}
            onTogglePaperOpen={onTogglePaperOpen}
          />
        ))}
      </ul>

      {canSearch && items.length > 0 ? (
        <div ref={loadMoreRef} className={`mt-3 min-h-6 text-sm ${subtleTextClass}`}>
          {loadingMore ? "Loading more..." : hasMore ? "Scroll to load more" : "End of results."}
        </div>
      ) : null}
    </>
  );
}
