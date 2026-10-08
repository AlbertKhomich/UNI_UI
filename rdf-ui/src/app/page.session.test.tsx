import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HomePage from "./page";
const auth = vi.hoisted(() => ({ status: "authenticated", data: { user: { email: "user@example.com" } } }));
vi.mock("next-auth/react", () => ({ useSession: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("@/hooks/useCountryStats", () => ({ useCountryStats: () => ({ countryRowsWithColors: [] }) }));
vi.mock("@/hooks/useDescribeState", () => ({ useDescribeState: () => ({}) }));
vi.mock("@/hooks/useSearchState", () => ({ useSearchState: () => ({ items: [], knownAuthorNames: {} }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/CountryWidget", () => ({ default: () => null }));
vi.mock("@/components/PaperResultsList", () => ({ default: () => null }));
vi.mock("@/components/SearchControls", () => ({ default: (props: {
  aiSessionReady: boolean; onToggleAi: (enabled: boolean) => void;
}) => <><button onClick={() => props.onToggleAi(true)}>Enable AI</button><span>{props.aiSessionReady ? "ready" : "waiting"}</span></> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("waits for demo initialization after logout", async () => {
  let finishDemo!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.endsWith("/documents")) return Promise.resolve(Response.json([]));
    if (auth.status === "unauthenticated") return new Promise<Response>((resolve) => { finishDemo = resolve; });
    return Promise.resolve(Response.json({ ready: true }));
  }));
  const { rerender } = render(<HomePage />);
  await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
  act(() => screen.getByText("Enable AI").click());
  await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
  auth.status = "unauthenticated";
  rerender(<HomePage />);
  expect(screen.getByText("waiting")).toBeInTheDocument();
  await act(async () => { finishDemo(Response.json({ ready: true })); });
  await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
});
