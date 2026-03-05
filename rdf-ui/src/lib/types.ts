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
    nextCursor?: string | null;
    authorIri?: string;
    authorName?: string;
}

export type DescribeTerm = {
    termType: "NamedNode" | "BlankNode" | "Literal" | "DefaultGraph";
    value: string;
    language?: string;
    datatype?: string;
};

export type DescribeQuad = {
    subject: DescribeTerm;
    predicate: DescribeTerm;
    object: DescribeTerm;
    graph?: DescribeTerm;
};

export type DescribeResponse = {
    iri: string;
    contentType: string;
    body: string;
    quads?: DescribeQuad[];
    prefixes?: Record<string, string>;
    parseError?: string | null;
};

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
    codeRepositories?: string[];
    isPartOfNames?: string[];

    volume?: string | null;
    issue?: string | null;
    pageStart?: string | null;
    pageEnd?: string | null;
}

export type Row = { name: string; value: number; color?: string; code?: string };
