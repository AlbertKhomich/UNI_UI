"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import PaperDetailsPanel from "@/components/PaperDetailsPanel";
import type { PaperDetails, SearchItem } from "@/lib/types";

type PaperListItemProps = {
  detail: PaperDetails | undefined;
  detailsClass: string;
  detailsError: string | undefined;
  isDark: boolean;
  isOpen: boolean;
  item: SearchItem;
  loadingDetails: boolean;
  onSelectAuthor: (iri: string, name: string) => void;
  onTogglePaperOpen: (id: string) => void;
};

function shouldSkipRowToggle(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>): boolean {
  const target = event.target as HTMLElement | null;
  if (target?.closest("a,button,input,textarea,select,label,[contenteditable='true']")) {
    return true;
  }

  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim().length > 0);
}

export default function PaperListItem(props: PaperListItemProps) {
  const {
    detail,
    detailsClass,
    detailsError,
    isDark,
    isOpen,
    item,
    loadingDetails,
    onSelectAuthor,
    onTogglePaperOpen,
  } = props;

  return (
    <li
      className={`rounded-xl border p-4 transition ${
        isDark ? (isOpen ? "border-gray-500" : "border-gray-700") : isOpen ? "border-gray-400" : "border-gray-200"
      }`}
    >
      <div
        className="flex cursor-pointer items-start justify-between gap-3"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={(event) => {
          if (shouldSkipRowToggle(event)) return;
          onTogglePaperOpen(item.id);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (shouldSkipRowToggle(event)) return;
          onTogglePaperOpen(item.id);
        }}
      >
        <div className="min-w-0 flex-1 select-text">
          <div className="break-words text-[17px] font-semibold">{item.title || item.id}</div>
          <div className={isDark ? "mt-1.5 text-sm text-gray-300" : "mt-1.5 text-sm text-gray-600"}>
            <span>{item.year ?? "—"}</span>
            <span className="mx-2">·</span>
            <span>{item.authorsText || "Authors: —"}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            isDark ? "border-gray-500 text-gray-100 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
          aria-hidden="true"
        >
          {isOpen ? "Hide" : "Details"}
        </span>
      </div>

      {isOpen ? (
        <PaperDetailsPanel
          detail={detail}
          detailsClass={detailsClass}
          detailsError={detailsError}
          isDark={isDark}
          loadingDetails={loadingDetails}
          onSelectAuthor={onSelectAuthor}
        />
      ) : null}
    </li>
  );
}
