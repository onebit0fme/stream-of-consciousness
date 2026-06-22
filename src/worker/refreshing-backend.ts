import type { StreamBackend } from "../backend.js";
import { TodoistBackend } from "../todoist-backend.js";
import type { ItemType, StreamItem, QueryFilters } from "../types.js";
import { refreshTodoistToken, computeTokenExpiry } from "./todoist-oauth.js";
import { readCredentials, patchCredentials, type StoredTodoistCredentials } from "./token-store.js";
import type { Env } from "./types.js";

function isAuthError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("invalid token")) {
      return true;
    }
  }
  if (typeof err === "object" && err !== null && "httpStatusCode" in err) {
    const status = (err as { httpStatusCode?: number }).httpStatusCode;
    if (status === 401) return true;
  }
  return false;
}

/** Builds the underlying {@link StreamBackend} from a token + project scope. Injectable for tests. */
export type TodoistBackendFactory = (accessToken: string, projectId: string) => StreamBackend;

const defaultBackendFactory: TodoistBackendFactory = (accessToken, projectId) =>
  new TodoistBackend(accessToken, projectId, { useNativeFetch: true });

export class RefreshingTodoistBackend implements StreamBackend {
  /** Per-DO cache of the backend. Rebuilt only when the access token rotates. KV is the source of truth for creds. */
  private cached?: StreamBackend;

  private constructor(
    private env: Env,
    private userId: string,
    /** Project scope for *this* connection, from the OAuth grant props — not the shared creds record. */
    private streamProjectId: string,
    private creds: StoredTodoistCredentials,
    private makeBackend: TodoistBackendFactory,
  ) {}

  static async create(
    env: Env,
    userId: string,
    streamProjectId: string,
    makeBackend: TodoistBackendFactory = defaultBackendFactory,
  ): Promise<RefreshingTodoistBackend> {
    const creds = await readCredentials(env, userId);
    if (!creds) {
      throw new Error(`No Todoist credentials stored for user ${userId}`);
    }
    return new RefreshingTodoistBackend(env, userId, streamProjectId, creds, makeBackend);
  }

  private getBackend(): StreamBackend {
    if (!this.cached) {
      this.cached = this.makeBackend(this.creds.accessToken, this.streamProjectId);
    }
    return this.cached;
  }

  private isExpiring(): boolean {
    if (this.creds.expiresAt === null) return false;
    return Date.now() >= this.creds.expiresAt;
  }

  private async refresh(): Promise<void> {
    if (!this.creds.refreshToken) {
      throw new Error("Todoist access token rejected and no refresh token available — user must re-authorize");
    }
    const resp = await refreshTodoistToken({
      clientId: this.env.TODOIST_CLIENT_ID,
      clientSecret: this.env.TODOIST_CLIENT_SECRET,
      refreshToken: this.creds.refreshToken,
    });
    this.creds = await patchCredentials(this.env, this.userId, {
      accessToken: resp.access_token,
      refreshToken: resp.refresh_token ?? this.creds.refreshToken,
      expiresAt: computeTokenExpiry(resp.expires_in),
    });
    this.cached = undefined;
  }

  private async withRetry<T>(fn: (backend: StreamBackend) => Promise<T>): Promise<T> {
    if (this.isExpiring() && this.creds.refreshToken) {
      await this.refresh();
    }
    try {
      return await fn(this.getBackend());
    } catch (err) {
      if (!isAuthError(err) || !this.creds.refreshToken) throw err;
      await this.refresh();
      return await fn(this.getBackend());
    }
  }

  async add(params: {
    content: string;
    type: ItemType;
    startDate: string;
    deadline: string | null;
  }): Promise<StreamItem> {
    return this.withRetry((b) => b.add(params));
  }

  async resolve(id: number | string): Promise<StreamItem | null> {
    return this.withRetry((b) => b.resolve(id));
  }

  async restream(
    id: number | string,
    changes: { content?: string; type?: ItemType; startDate?: string; deadline?: string | null },
  ): Promise<{ old: StreamItem; new: StreamItem } | null> {
    return this.withRetry((b) => b.restream(id, changes));
  }

  async query(filters: QueryFilters): Promise<StreamItem[]> {
    return this.withRetry((b) => b.query(filters));
  }
}
