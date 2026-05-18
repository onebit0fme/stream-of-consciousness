import { sanitizeText } from "./consent.js";
import type { TodoistProject } from "./todoist-rest.js";

export const DEFAULT_NEW_PROJECT_NAME = "Stream";

export function renderProjectPicker(params: {
  pendingId: string;
  projects: TodoistProject[];
  userName: string;
}): { html: string; headers: Record<string, string> } {
  const { pendingId, projects, userName } = params;

  const existingStream = projects.find((p) => p.name === DEFAULT_NEW_PROJECT_NAME);
  const defaultValue = existingStream ? `existing:${existingStream.id}` : "new";

  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
  const options = sorted
    .map((p) => {
      const value = `existing:${p.id}`;
      const checked = value === defaultValue ? " checked" : "";
      return `<label class="opt"><input type="radio" name="choice" value="${sanitizeText(value)}"${checked}> <span class="name">${sanitizeText(p.name)}</span></label>`;
    })
    .join("");

  const newChecked = defaultValue === "new" ? " checked" : "";

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pick a project · Stream of Consciousness</title>
<style>
:root{--primary:#0070f3;--border:#e5e7eb;--text:#333;--bg:#fff;--muted:#6b7280}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:var(--text);background:#f9fafb;margin:0;padding:0}
.container{max-width:600px;margin:2rem auto;padding:1rem}
.precard{padding:2rem;text-align:center}
.title{margin:0;font-size:1.3rem;font-weight:400}
.subtitle{color:var(--muted);font-size:.95rem;margin-top:.5rem}
.card{background:var(--bg);border-radius:8px;box-shadow:0 8px 36px 8px rgba(0,0,0,.1);padding:2rem}
.hint{color:var(--muted);font-size:.9rem;margin:0 0 1rem 0}
.opts{display:flex;flex-direction:column;gap:.4rem;max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:.5rem;margin-bottom:1rem}
.opt{display:flex;align-items:center;gap:.6rem;padding:.45rem .6rem;border-radius:4px;cursor:pointer}
.opt:hover{background:#f3f4f6}
.opt input{margin:0}
.opt .name{font-size:.95rem}
.new{margin-bottom:1.5rem;padding:.75rem .6rem;border:1px dashed var(--border);border-radius:6px;display:flex;align-items:center;gap:.6rem}
.new code{background:#f3f4f6;padding:.1rem .35rem;border-radius:4px;font-size:.85rem}
.actions{display:flex;justify-content:flex-end;gap:1rem}
.button{padding:.75rem 1.5rem;border-radius:6px;font-weight:500;cursor:pointer;border:none;font-size:1rem}
.button-primary{background:var(--primary);color:#fff}
.button-secondary{background:transparent;border:1px solid var(--border);color:var(--text)}
</style></head><body>
<div class="container">
  <div class="precard">
    <h1 class="title"><strong>Stream of Consciousness</strong></h1>
    <p class="subtitle">Signed in as ${sanitizeText(userName)} — pick the Todoist project to use as your stream.</p>
  </div>
  <div class="card">
    <p class="hint">All stream items will live in this project. Tasks in other projects stay untouched.</p>
    <form method="post" action="/select-project">
      <input type="hidden" name="pending_id" value="${sanitizeText(pendingId)}">
      <label class="new"><input type="radio" name="choice" value="new"${newChecked}> <span>Create new project: <code>${sanitizeText(DEFAULT_NEW_PROJECT_NAME)}</code></span></label>
      ${sorted.length ? `<p class="hint">Or pick an existing project:</p><div class="opts">${options}</div>` : ""}
      <div class="actions">
        <button type="submit" class="button button-primary">Use this project</button>
      </div>
    </form>
  </div>
</div>
</body></html>`;

  return {
    html,
    headers: {
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "DENY",
    },
  };
}
