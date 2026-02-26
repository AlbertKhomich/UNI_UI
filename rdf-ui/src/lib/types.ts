export type SearchItem = {
  id: string;
  iri: string;
  title: string;
  year?: string;
  authorsText: string;
};

export type SearchResponse = {
    items: SearchItem[];
    total?: number;
}

export type PersonWithAffiliations = {
    iri: string;
    name: string;
    orcid?: string;
    affiliations: Aff[];
};

export type Aff = {
    name: string; 
    iri: string;
    countryRaw?: string;
    sameAs?: string;
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
    fields?: string[];
    subfields?: string[];
    sameAs?: string;
    urls?: string[];
    isPartOfNames?: string[];

    volume?: string | null;
    issue?: string | null;
    pageStart?: string | null;
    pageEnd?: string | null;
}

export type Row = { name: string; value: number; color?: string; code?: string };
