import { expect, test } from "@playwright/test";

type SearchItem = {
  id: string;
  iri: string;
  title: string;
  year?: string;
  authorsText: string;
};

type SearchResponse = {
  items: SearchItem[];
  total: number;
};

const SEARCH_RESPONSES: Record<string, Record<number, SearchResponse>> = {
  "graph retrieval": {
    0: {
      total: 3,
      items: [
        {
          id: "1001",
          iri: "https://dice-research.org/id/publication/ris/1001",
          title: "Graph First Result",
          year: "2024",
          authorsText: "Jane Doe",
        },
        {
          id: "1002",
          iri: "https://dice-research.org/id/publication/ris/1002",
          title: "Graph Second Result",
          year: "2023",
          authorsText: "John Smith",
        },
      ],
    },
    2: {
      total: 3,
      items: [
        {
          id: "1003",
          iri: "https://dice-research.org/id/publication/ris/1003",
          title: "Graph Third Result",
          year: "2022",
          authorsText: "Alice Jones",
        },
      ],
    },
  },
  "c: US": {
    0: {
      total: 1,
      items: [
        {
          id: "2001",
          iri: "https://dice-research.org/id/publication/ris/2001",
          title: "US Filtered Result",
          year: "2025",
          authorsText: "Jane Doe",
        },
      ],
    },
  },
};

function matchesApiRequest(url: string, path: string, params?: Record<string, string>): boolean {
  const parsed = new URL(url);
  if (parsed.pathname !== path) return false;
  if (!params) return true;
  return Object.entries(params).every(([key, value]) => parsed.searchParams.get(key) === value);
}

test("search, open details, country filter, load more, and theme persistence", async ({ page }) => {
  await page.route("**/api/top-countries**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rows: {
          totalPapers: 12,
          rows: [
            { name: "US", value: 6 },
            { name: "DE", value: 4 },
            { name: "FR", value: 2 },
          ],
        },
      }),
    });
  });

  await page.route("**/api/search**", async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const qResponses = SEARCH_RESPONSES[q] ?? { 0: { total: 0, items: [] } };
    const response = qResponses[offset] ?? {
      total: qResponses[0]?.total ?? 0,
      items: [],
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.route("**/api/paper**", async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get("id");
    if (id !== "1001") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not found" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "1001",
        iri: "https://dice-research.org/id/publication/ris/1001",
        title: "Graph First Result",
        year: "2024",
        abstract: "This abstract is for smoke-test validation.",
        keywords: ["rdf", "graph"],
        fields: ["Computer Science"],
        subfields: ["Semantic Web"],
        sameAs: "https://doi.org/10.1000/smoke",
        urls: ["https://example.org/paper1001.pdf"],
        codeRepositories: ["https://github.com/example/repo1001"],
        isPartOf: [],
        isPartOfNames: ["Journal of Graph Retrieval"],
        licenses: [],
        publisherNames: [],
        authors: ["Jane Doe"],
        authorsDetailed: [
          {
            iri: "https://example.org/author/jane",
            name: "Jane Doe",
            affiliations: [
              {
                iri: "https://example.org/aff/uni-a",
                name: "University A",
                countryRaw: "US",
              },
            ],
          },
        ],
      }),
    });
  });

  await page.goto("/");

  const searchInput = page.getByPlaceholder("Search paper title... (a:, y:, aff:, c:)");
  const firstSearchResponse = page.waitForResponse(
    (response) =>
      matchesApiRequest(response.url(), "/api/search", {
        q: "graph retrieval",
        offset: "0",
        limit: "25",
      }),
  );
  await searchInput.fill("graph retrieval");
  await firstSearchResponse;

  await expect(page.getByText("Graph First Result")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Graph Second Result")).toBeVisible({ timeout: 15_000 });
  const thirdResult = page.getByText("Graph Third Result");
  if (!(await thirdResult.isVisible().catch(() => false))) {
    const loadMoreHint = page.getByText("Scroll to load more");
    if (await loadMoreHint.isVisible().catch(() => false)) {
      await loadMoreHint.scrollIntoViewIfNeeded();
    } else {
      await page.mouse.wheel(0, 1200);
    }
  }

  await page.getByText("Graph First Result").click();
  await expect(page.getByText("Abstract:")).toBeVisible();
  await expect(page.getByText("This abstract is for smoke-test validation.")).toBeVisible();

  await expect(thirdResult).toBeVisible();
  await expect(page.getByText("End of results.")).toBeVisible();

  const filteredSearchResponse = page.waitForResponse(
    (response) =>
      matchesApiRequest(response.url(), "/api/search", {
        q: "c: US",
        offset: "0",
        limit: "25",
      }),
  );
  await page.getByRole("button", { name: /United States \(US\)/ }).click();
  await filteredSearchResponse;
  await expect(searchInput).toHaveValue("c: US");
  await expect(page.getByText("US Filtered Result")).toBeVisible();

  const themeToggle = page.getByRole("button", { name: /Switch to (light|dark) theme/ });
  const labelBefore = await themeToggle.getAttribute("aria-label");
  await themeToggle.click();
  const labelAfter = await themeToggle.getAttribute("aria-label");
  expect(labelBefore).not.toBe(labelAfter);
  if (!labelAfter) throw new Error("Theme toggle did not expose aria-label after click");

  await page.reload();
  await expect(page.getByRole("button", { name: labelAfter })).toBeVisible();
});
