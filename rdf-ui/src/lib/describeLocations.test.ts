import { describe, expect, it } from "vitest";
import type { DescribeQuad } from "@/lib/types";
import { extractDescribeLocationPoints } from "./describeLocations";

describe("extractDescribeLocationPoints", () => {
  it("extracts direct coordinates from the described resource", () => {
    const describedIri = "https://example.org/affiliations/1";
    const quads: DescribeQuad[] = [
      {
        subject: { termType: "NamedNode", value: describedIri },
        predicate: { termType: "NamedNode", value: "https://schema.org/name" },
        object: {
          termType: "Literal",
          value: "Institute One",
          datatype: "http://www.w3.org/2001/XMLSchema#string",
        },
      },
      {
        subject: { termType: "NamedNode", value: describedIri },
        predicate: { termType: "NamedNode", value: "https://schema.org/latitude" },
        object: { termType: "Literal", value: "51.7123", datatype: "http://www.w3.org/2001/XMLSchema#decimal" },
      },
      {
        subject: { termType: "NamedNode", value: describedIri },
        predicate: { termType: "NamedNode", value: "https://schema.org/longitude" },
        object: { termType: "Literal", value: "8.7654", datatype: "http://www.w3.org/2001/XMLSchema#decimal" },
      },
    ];

    expect(extractDescribeLocationPoints(quads, describedIri)).toEqual([
      {
        id: `NamedNode:${describedIri}`,
        label: "Institute One",
        latitude: 51.7123,
        longitude: 8.7654,
        sourceIri: describedIri,
      },
    ]);
  });

  it("extracts coordinates from a nested geo blank node", () => {
    const describedIri = "https://example.org/affiliations/2";
    const geoNode = "geo-1";
    const quads: DescribeQuad[] = [
      {
        subject: { termType: "NamedNode", value: describedIri },
        predicate: { termType: "NamedNode", value: "https://schema.org/name" },
        object: {
          termType: "Literal",
          value: "Institute Two",
          datatype: "http://www.w3.org/2001/XMLSchema#string",
        },
      },
      {
        subject: { termType: "NamedNode", value: describedIri },
        predicate: { termType: "NamedNode", value: "https://schema.org/geo" },
        object: { termType: "BlankNode", value: geoNode },
      },
      {
        subject: { termType: "BlankNode", value: geoNode },
        predicate: { termType: "NamedNode", value: "http://www.w3.org/2003/01/geo/wgs84_pos#lat" },
        object: { termType: "Literal", value: "52.0", datatype: "http://www.w3.org/2001/XMLSchema#decimal" },
      },
      {
        subject: { termType: "BlankNode", value: geoNode },
        predicate: { termType: "NamedNode", value: "http://www.w3.org/2003/01/geo/wgs84_pos#long" },
        object: { termType: "Literal", value: "13.0", datatype: "http://www.w3.org/2001/XMLSchema#decimal" },
      },
    ];

    expect(extractDescribeLocationPoints(quads, describedIri)).toEqual([
      {
        id: `BlankNode:${geoNode}`,
        label: "Institute Two",
        latitude: 52,
        longitude: 13,
        sourceIri: undefined,
      },
    ]);
  });
});
