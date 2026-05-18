import type { StreamBackend } from "./backend.js";

export async function createBackend(): Promise<StreamBackend> {
  const backendType = process.env.STREAM_BACKEND ?? "file";

  if (backendType === "todoist") {
    const token = process.env.TODOIST_API_TOKEN;
    if (!token) {
      throw new Error(
        "STREAM_BACKEND=todoist requires TODOIST_API_TOKEN to be set"
      );
    }
    const { TodoistBackend } = await import("./todoist-backend.js");
    return new TodoistBackend(token, process.env.TODOIST_PROJECT_ID);
  }

  if (backendType === "file") {
    const { FileBackend } = await import("./file-backend.js");
    return new FileBackend();
  }

  throw new Error(
    `Unknown STREAM_BACKEND: "${backendType}". Use "file" or "todoist".`
  );
}
