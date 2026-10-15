import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { AiUnavailableError, FixRequest, fixTiming } from "./fixTiming";

const PORT = Number(process.env.PORT ?? 8787);
const DIST = join(import.meta.dirname, "..", "dist");
const MAX_BODY = 512 * 1024;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, rel);
  if (!file.startsWith(DIST)) return json(res, 403, { error: "forbidden" });
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(DIST, "index.html"); // SPA fallback
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    json(res, 404, { error: "not found — run `npm run build` first" });
  }
}

const server = createServer(async (req, res) => {
  if (req.url === "/api/health") {
    return json(res, 200, { ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY) });
  }
  if (req.url === "/api/fix-timing" && req.method === "POST") {
    let input: FixRequest;
    try {
      input = FixRequest.parse(await readBody(req));
    } catch (err) {
      return json(res, 400, { error: `bad request: ${(err as Error).message}` });
    }
    const t0 = Date.now();
    try {
      const out = await fixTiming(input);
      console.log(`fix-timing notes=${input.notes.length} ms=${Date.now() - t0} usage=${JSON.stringify(out.usage)}`);
      return json(res, 200, { summary: out.summary, notes: out.notes });
    } catch (err) {
      if (err instanceof AiUnavailableError) return json(res, 503, { error: err.message });
      if (err instanceof Anthropic.AuthenticationError) {
        return json(res, 503, { error: "AI unavailable: ANTHROPIC_API_KEY was rejected." });
      }
      if (err instanceof Anthropic.RateLimitError) {
        return json(res, 429, { error: "AI rate limited — try again in a moment." });
      }
      if (err instanceof Anthropic.APIError) {
        console.error("anthropic error", err.status, err.message);
        return json(res, 502, { error: `AI error (${err.status ?? "network"})` });
      }
      console.error(err);
      return json(res, 500, { error: (err as Error).message });
    }
  }
  if (req.method === "GET") return serveStatic(req, res);
  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`midimaker api on :${PORT} (ai=${Boolean(process.env.ANTHROPIC_API_KEY)})`));
