/**
 * Direct fetch against Todoist REST API v1.
 * Used by the OAuth onboarding flow so the worker doesn't depend on
 * @doist/todoist-api-typescript (which pulls in undici / MessagePort).
 */

const API_BASE = "https://api.todoist.com/api/v1";

export interface TodoistProject {
  id: string;
  name: string;
  is_archived: boolean;
  is_favorite: boolean;
}

interface PaginatedProjects {
  results: TodoistProject[];
  next_cursor: string | null;
}

async function todoistFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Todoist ${init.method ?? "GET"} ${path} failed (${resp.status}): ${body}`);
  }
  return resp;
}

export async function listProjects(accessToken: string): Promise<TodoistProject[]> {
  const all: TodoistProject[] = [];
  let cursor: string | null = null;

  do {
    const url = cursor ? `/projects?cursor=${encodeURIComponent(cursor)}` : "/projects";
    const resp = await todoistFetch(accessToken, url);
    const page = (await resp.json()) as PaginatedProjects;
    all.push(...(page.results ?? []));
    cursor = page.next_cursor ?? null;
  } while (cursor);

  return all.filter((p) => !p.is_archived);
}

export async function createProject(accessToken: string, name: string): Promise<TodoistProject> {
  const resp = await todoistFetch(accessToken, "/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return (await resp.json()) as TodoistProject;
}
