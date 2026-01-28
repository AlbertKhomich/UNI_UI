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

export type PaperDetails = {
    id: string;
    iri: string;
    title: string;
    year?:string | null;

    subtitle?: string | null
    abstract?: string | null;

    authors?: string[];
    editors?: string[];

    keywords?: string[];
    sameAs?: string[];
    urls?: string[];

    volume?: string | null;
    issue?: string | null;
    pageStart?: string | null;
    pageEnd?: string | null;
}