import { createHash, createPublicKey, verify as verifySignature, randomBytes } from "node:crypto";
import type { PasskeyRow } from "./db";

function b64urlEncode(input: Uint8Array | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function b64urlDecode(input: string) {
  const pad = (4 - (input.length % 4 || 4)) % 4;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(normalized, "base64");
}

export function sha256(input: Uint8Array | Buffer | string) {
  return createHash("sha256").update(input).digest();
}

export function randomChallenge() {
  return b64urlEncode(randomBytes(32));
}

export function sanitizeIncidentHtml(input: string) {
  let cleaned = input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
  cleaned = cleaned.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  cleaned = cleaned.replace(/javascript:/gi, "");
  return cleaned;
}

export function parseAuthData(authData: Buffer) {
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32] || 0;
  const signCount = authData.readUInt32BE(33);
  return { rpIdHash, flags, signCount };
}

export function verifyAssertionSignature(publicKeySpkiB64: string, authenticatorData: Buffer, clientDataJSON: Buffer, signatureB64: string) {
  const publicKey = createPublicKey({
    key: b64urlDecode(publicKeySpkiB64),
    format: "der",
    type: "spki"
  });
  const toVerify = Buffer.concat([authenticatorData, sha256(clientDataJSON)]);
  return verifySignature("sha256", toVerify, publicKey, b64urlDecode(signatureB64));
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function canonicalOrigin(req: Request) {
  return process.env.APP_ORIGIN || new URL(req.url).origin;
}

export function rpIdFromOrigin(origin: string) {
  return new URL(origin).hostname;
}

export function usernameOrEmailToUserKey(value: string) {
  return value.trim().toLowerCase();
}

type CompatPatch = Record<string, unknown>;

const bannedCompatSegment = new Set(["__proto__", "constructor", "prototype"]);
const dangerousCompatLeaf = new Set(["postRenderFormula"]);

function decodeCompatSegments(rawKey: string) {
  return rawKey.split(".").map((segment) => decodeURIComponent(segment));
}

function hasBlockedRawSegment(rawKey: string) {
  return rawKey.split(".").find((segment) => bannedCompatSegment.has(segment)) || null;
}

function requiresInheritedPath(decodedSegments: string[]) {
  const decodedLeaf = decodedSegments.at(-1);
  if (!decodedLeaf || !dangerousCompatLeaf.has(decodedLeaf)) {
    return false;
  }
  return !decodedSegments.slice(0, -1).some((segment) => bannedCompatSegment.has(segment));
}

export function validateCompatPatch(patch: CompatPatch) {
  for (const rawKey of Object.keys(patch)) {
    const blockedSegment = hasBlockedRawSegment(rawKey);
    if (blockedSegment) {
      throw new Error(`compat key segment blocked: ${blockedSegment}`);
    }

    const decodedSegments = decodeCompatSegments(rawKey);
    if (requiresInheritedPath(decodedSegments)) {
      throw new Error(`compat key requires inherited path: ${decodedSegments.at(-1)}`);
    }
  }
}

function applyCompatPatch(target: Record<string, unknown>, patch: CompatPatch) {
  for (const [rawPath, value] of Object.entries(patch)) {
    const segments = decodeCompatSegments(rawPath);
    let cursor: any = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      if (cursor[segment] == null || typeof cursor[segment] !== "object") {
        cursor[segment] = {};
      }
      cursor = cursor[segment];
    }
    cursor[segments[segments.length - 1]!] = value;
  }
}

export function buildRenderConfig(config: Record<string, unknown>, compatPatch: CompatPatch) {
  const presetProto = {
    footerText: "No inherited post-render hooks loaded.",
    formatter: "table"
  } as Record<string, unknown>;
  const renderConfig = Object.create(presetProto) as Record<string, unknown>;
  Object.assign(renderConfig, config);
  applyCompatPatch(renderConfig, compatPatch);
  return renderConfig;
}

function copyString(source: Record<string, unknown>, target: Record<string, unknown>, key: "title" | "formatter") {
  if (typeof source[key] === "string") {
    target[key] = source[key];
  }
}

export function normalizeReportConfig(input: unknown) {
  const source = typeof input === "object" && input ? input as Record<string, unknown> : {};
  const normalized: Record<string, unknown> = {};

  copyString(source, normalized, "title");
  if (Array.isArray(source.rows)) {
    normalized.rows = source.rows.map((row) => String(row));
  }
  copyString(source, normalized, "formatter");

  return normalized;
}

export function runPostRender(renderConfig: Record<string, unknown>, rows: string[]) {
  const hookSource = typeof renderConfig.postRenderFormula === "string"
    ? renderConfig.postRenderFormula
    : "return `rows=${rows.length}`;";
  const compile = new Function("rows", "Bun", "process", hookSource);
  return String(compile(rows, Bun, process));
}

export function describePasskeys(passkeys: PasskeyRow[]) {
  return passkeys.map((row) => ({
    credentialId: row.credential_id,
    createdAt: row.created_at,
    transports: JSON.parse(row.transports_json) as string[]
  }));
}
