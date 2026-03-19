const PUBLICATION_TYPE_PREDICATE = "http://upbkg.data.dice-research.org/vocab/publicationType";

export function excludeSammelbandPattern(paperVar = "?paper"): string {
  const targetVar = paperVar.trim() || "?paper";

  return `
    FILTER NOT EXISTS {
      ${targetVar} <${PUBLICATION_TYPE_PREDICATE}> ?publicationTypeFilterValue .
      FILTER(LCASE(STR(?publicationTypeFilterValue)) = "sammelband")
    }
  `;
}
