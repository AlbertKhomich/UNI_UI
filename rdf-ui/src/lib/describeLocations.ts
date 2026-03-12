import type { DescribeQuad, DescribeTerm } from "@/lib/types";

export type DescribeLocationPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  sourceIri?: string;
};

type NodeRecord = {
  latitude?: number;
  longitude?: number;
  label?: string;
  sourceIri?: string;
};

type Edge = {
  predicate: string;
  objectKey: string;
  objectTermType: "NamedNode" | "BlankNode";
};

const LATITUDE_PREDICATES = new Set([
  "https://schema.org/latitude",
  "http://schema.org/latitude",
  "http://www.w3.org/2003/01/geo/wgs84_pos#lat",
]);

const LONGITUDE_PREDICATES = new Set([
  "https://schema.org/longitude",
  "http://schema.org/longitude",
  "http://www.w3.org/2003/01/geo/wgs84_pos#long",
  "http://www.w3.org/2003/01/geo/wgs84_pos#lng",
]);

const WKT_POINT_PREDICATE = "http://www.opengis.net/ont/geosparql#asWKT";

const LABEL_PREDICATES = new Set([
  "https://schema.org/name",
  "http://schema.org/name",
  "http://www.w3.org/2000/01/rdf-schema#label",
  "http://www.w3.org/2004/02/skos/core#prefLabel",
]);

const GEO_LINK_PREDICATES = new Set([
  "https://schema.org/geo",
  "http://schema.org/geo",
  "https://schema.org/location",
  "http://schema.org/location",
  "http://www.w3.org/2003/01/geo/wgs84_pos#location",
  "http://www.opengis.net/ont/geosparql#hasGeometry",
  "http://www.opengis.net/ont/geosparql#hasCentroid",
]);

function isNamedOrBlank(term: DescribeTerm): term is DescribeTerm & { termType: "NamedNode" | "BlankNode" } {
  return term.termType === "NamedNode" || term.termType === "BlankNode";
}

function toTermKey(term: DescribeTerm & { termType: "NamedNode" | "BlankNode" }): string {
  return `${term.termType}:${term.value}`;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function parseCoordinateLiteral(term: DescribeTerm): number | null {
  if (term.termType !== "Literal") return null;
  const value = Number(term.value.trim());
  return isFiniteNumber(value) ? value : null;
}

function parseWktPoint(value: string): { latitude: number; longitude: number } | null {
  const match = value.trim().match(/^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i);
  if (!match) return null;

  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;
  return { latitude, longitude };
}

function isValidCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  if (!isFiniteNumber(latitude ?? Number.NaN) || !isFiniteNumber(longitude ?? Number.NaN)) return false;
  return Math.abs(latitude ?? 0) <= 90 && Math.abs(longitude ?? 0) <= 180;
}

function fallbackLabelFromIri(iri: string): string {
  try {
    const parsed = new URL(iri);
    const pathPart = parsed.pathname.split("/").filter(Boolean).at(-1);
    if (pathPart) return decodeURIComponent(pathPart);
  } catch {
    return iri;
  }
  return iri;
}

function getOrCreateNode(nodes: Map<string, NodeRecord>, key: string, sourceIri?: string): NodeRecord {
  const existing = nodes.get(key);
  if (existing) {
    if (!existing.sourceIri && sourceIri) existing.sourceIri = sourceIri;
    return existing;
  }

  const next: NodeRecord = { sourceIri };
  nodes.set(key, next);
  return next;
}

function collectScoredTargets(
  targetKey: string,
  outgoingEdges: Map<string, Edge[]>,
): { directTargets: Set<string>; secondaryTargets: Set<string> } {
  const directTargets = new Set<string>();
  const secondaryTargets = new Set<string>();

  for (const edge of outgoingEdges.get(targetKey) ?? []) {
    if (edge.objectTermType === "BlankNode" || GEO_LINK_PREDICATES.has(edge.predicate)) {
      directTargets.add(edge.objectKey);
    }
  }

  for (const directTarget of directTargets) {
    for (const edge of outgoingEdges.get(directTarget) ?? []) {
      if (edge.objectTermType === "BlankNode" || GEO_LINK_PREDICATES.has(edge.predicate)) {
        secondaryTargets.add(edge.objectKey);
      }
    }
  }

  return { directTargets, secondaryTargets };
}

export function extractDescribeLocationPoints(quads: DescribeQuad[], describedIri: string): DescribeLocationPoint[] {
  if (!describedIri || quads.length === 0) return [];

  const nodes = new Map<string, NodeRecord>();
  const outgoingEdges = new Map<string, Edge[]>();
  const targetKey = `NamedNode:${describedIri}`;
  const fallbackLabel = fallbackLabelFromIri(describedIri);

  for (const quad of quads) {
    if (!isNamedOrBlank(quad.subject) || quad.predicate.termType !== "NamedNode") continue;
    const subjectKey = toTermKey(quad.subject);
    const subjectNode = getOrCreateNode(
      nodes,
      subjectKey,
      quad.subject.termType === "NamedNode" ? quad.subject.value : undefined,
    );
    const predicateIri = quad.predicate.value;

    if (LABEL_PREDICATES.has(predicateIri)) {
      const nextLabel = quad.object.value.trim();
      if (nextLabel && !subjectNode.label) subjectNode.label = nextLabel;
    }

    const numericValue = parseCoordinateLiteral(quad.object);
    if (LATITUDE_PREDICATES.has(predicateIri) && numericValue !== null) {
      subjectNode.latitude = numericValue;
    }
    if (LONGITUDE_PREDICATES.has(predicateIri) && numericValue !== null) {
      subjectNode.longitude = numericValue;
    }

    if (predicateIri === WKT_POINT_PREDICATE && quad.object.termType === "Literal") {
      const parsedPoint = parseWktPoint(quad.object.value);
      if (parsedPoint) {
        subjectNode.latitude = parsedPoint.latitude;
        subjectNode.longitude = parsedPoint.longitude;
      }
    }

    if (isNamedOrBlank(quad.object)) {
      const subjectEdges = outgoingEdges.get(subjectKey) ?? [];
      subjectEdges.push({
        predicate: predicateIri,
        objectKey: toTermKey(quad.object),
        objectTermType: quad.object.termType,
      });
      outgoingEdges.set(subjectKey, subjectEdges);

      getOrCreateNode(
        nodes,
        toTermKey(quad.object),
        quad.object.termType === "NamedNode" ? quad.object.value : undefined,
      );
    }
  }

  const { directTargets, secondaryTargets } = collectScoredTargets(targetKey, outgoingEdges);
  const allPoints = Array.from(nodes.entries())
    .filter(([, node]) => isValidCoordinatePair(node.latitude, node.longitude))
    .map(([key, node]) => {
      const label = node.label ?? (key === targetKey ? fallbackLabel : nodes.get(targetKey)?.label ?? fallbackLabel);
      return {
        id: key,
        label,
        latitude: node.latitude as number,
        longitude: node.longitude as number,
        sourceIri: node.sourceIri,
      };
    });

  const prioritizedPoints = allPoints.filter((point) => {
    if (point.id === targetKey) return true;
    if (directTargets.has(point.id)) return true;
    if (secondaryTargets.has(point.id)) return true;
    return false;
  });

  const points = prioritizedPoints.length > 0 ? prioritizedPoints : allPoints;
  return points
    .slice()
    .sort((a, b) => {
      const aScore = a.id === targetKey ? 3 : directTargets.has(a.id) ? 2 : secondaryTargets.has(a.id) ? 1 : 0;
      const bScore = b.id === targetKey ? 3 : directTargets.has(b.id) ? 2 : secondaryTargets.has(b.id) ? 1 : 0;
      if (aScore !== bScore) return bScore - aScore;
      return a.label.localeCompare(b.label);
    });
}
