type RagSession = {
  id: string;
  token: string;
};

type RagSessionStore = Map<string, RagSession>;

const STORE_KEY = "__rdf_viewer_rag_sessions__";
const DEMO_SESSION_KEY = "demo";

type GlobalWithRagStore = typeof globalThis & {
  [STORE_KEY]?: RagSessionStore;
};

const globalStore = globalThis as GlobalWithRagStore;

export const ragSessions: RagSessionStore = globalStore[STORE_KEY] ?? new Map<string, RagSession>();
globalStore[STORE_KEY] = ragSessions;

export function getDemoRagSession(): RagSession | null {
  return ragSessions.get(DEMO_SESSION_KEY) ?? null;
}

export function setDemoRagSession(session: RagSession): RagSession {
  ragSessions.set(DEMO_SESSION_KEY, session);
  return session;
}

