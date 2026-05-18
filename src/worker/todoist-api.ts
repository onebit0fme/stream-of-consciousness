export interface TodoistUserInfo {
  id: string;
  fullName: string;
}

interface SyncUserResponse {
  user?: { id: string; full_name?: string; email?: string };
}

export async function fetchTodoistUser(accessToken: string): Promise<TodoistUserInfo> {
  const resp = await fetch("https://api.todoist.com/api/v1/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({
      sync_token: "*",
      resource_types: '["user"]',
    }).toString(),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Todoist sync user fetch failed (${resp.status}): ${body}`);
  }

  const data = (await resp.json()) as SyncUserResponse;
  if (!data.user?.id) throw new Error("Todoist sync response missing user");
  return {
    id: String(data.user.id),
    fullName: data.user.full_name ?? data.user.email ?? data.user.id,
  };
}
