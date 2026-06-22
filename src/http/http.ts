// =====================================================================
// One DSD vNext — tiny HTTP helpers (Layer 6)
// Framework-free request/response helpers over node:http so the spine has
// no web-framework lock-in (portable to Azure Container Apps). Handles
// cookie parsing, JSON body reading (size-capped), and JSON responses.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB cap; reject larger

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers["cookie"];
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export async function readJsonBody<T = unknown>(
  req: IncomingMessage,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}

export function clientIp(req: IncomingMessage): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0]!.trim();
  }
  return req.socket.remoteAddress ?? null;
}

export interface SetCookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  maxAgeSeconds?: number;
  path?: string;
}

export function setCookie(
  res: ServerResponse,
  name: string,
  value: string,
  opts: SetCookieOptions = {},
): void {
  const segs = [`${name}=${encodeURIComponent(value)}`];
  segs.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly !== false) segs.push("HttpOnly");
  if (opts.secure) segs.push("Secure");
  segs.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (typeof opts.maxAgeSeconds === "number") {
    segs.push(`Max-Age=${opts.maxAgeSeconds}`);
  }
  appendHeader(res, "Set-Cookie", segs.join("; "));
}

export function clearCookie(res: ServerResponse, name: string): void {
  appendHeader(res, "Set-Cookie", `${name}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}

function appendHeader(res: ServerResponse, name: string, value: string): void {
  const existing = res.getHeader(name);
  if (existing === undefined) {
    res.setHeader(name, value);
  } else if (Array.isArray(existing)) {
    res.setHeader(name, [...existing, value]);
  } else {
    res.setHeader(name, [String(existing), value]);
  }
}

// --- form-urlencoded body (sign-in form posts) -----------------------
export async function readFormBody(
  req: import("node:http").IncomingMessage,
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
      const out: Record<string, string> = {};
      for (const [k, val] of params) out[k] = val;
      resolve(out);
    });
    req.on("error", reject);
  });
}

export function redirect(
  res: import("node:http").ServerResponse,
  location: string,
  status = 303,
): void {
  res.statusCode = status;
  res.setHeader("Location", location);
  res.end();
}

export function sendHtml(
  res: import("node:http").ServerResponse,
  status: number,
  body: string,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(body);
}

// Multi-valued form parse (checkbox groups). Returns arrays per key.
export async function readFormMulti(
  req: import("node:http").IncomingMessage,
): Promise<Record<string, string[]>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) { reject(new Error("payload_too_large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
      const out: Record<string, string[]> = {};
      for (const [k, v] of params) (out[k] ??= []).push(v);
      resolve(out);
    });
    req.on("error", reject);
  });
}
