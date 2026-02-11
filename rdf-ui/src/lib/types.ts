import React from "react";

export type SearchItem = {
  id: string;
  iri: string;
  title: string;
  year?: string;
  authorsText: string;
};

export type SearchResponse = {
    items: SearchItem[];
}

export type PersonWithAffiliations = {
    iri: string;
    name: string;
    affiliations: string[];
    ccRaw?: string[];
};

export type PaperDetails = {
    id: string;
    iri: string;
    title: string;
    year?:string | null;

    subtitle?: string | null
    abstract?: string | null;

    authors?: string[];
    editors?: string[];

    authorsDetailed?: PersonWithAffiliations[];

    keywords?: string[];
    sameAs?: string;
    urls?: string[];
    isPartOfNames?: string[];

    volume?: string | null;
    issue?: string | null;
    pageStart?: string | null;
    pageEnd?: string | null;
}

export type Row = { name: string; value: number; color?: string };