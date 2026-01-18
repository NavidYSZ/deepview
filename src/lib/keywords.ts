import * as XLSX from "xlsx";
import { normalizeDomain } from "./crawler";

export type ParsedKeywordRow = {
  term: string;
  url?: string;
  host?: string;
  path: string;
  volume?: number;
  difficulty?: number;
  position?: number;
  meta: Record<string, unknown>;
};

const stripWww = (host: string) => host.replace(/^www\./i, "");

export const normalizePathValue = (value: string | undefined | null) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "/";
  let pathValue = trimmed;
  const hashIndex = pathValue.indexOf("#");
  if (hashIndex >= 0) {
    pathValue = pathValue.slice(0, hashIndex);
  }
  const queryIndex = pathValue.indexOf("?");
  if (queryIndex >= 0) {
    pathValue = pathValue.slice(0, queryIndex);
  }
  if (!pathValue.startsWith("/")) {
    pathValue = `/${pathValue}`;
  }
  if (pathValue.length > 1 && pathValue.endsWith("/")) {
    pathValue = pathValue.slice(0, -1);
  }
  return pathValue || "/";
};

const toNumber = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : undefined;
};

const findKey = (row: Record<string, unknown>, matchers: string[]) => {
  const entries = Object.keys(row);
  const lowerMap = entries.map((k) => k.toLowerCase());
  for (const matcher of matchers) {
    const idx = lowerMap.findIndex((k) => k.includes(matcher));
    if (idx >= 0) return entries[idx];
  }
  return undefined;
};

const normalizeUrl = (raw: string, fallbackDomain?: string) => {
  const attempts: string[] = [raw];
  if (fallbackDomain && !raw.includes("://")) {
    attempts.push(`https://${stripWww(fallbackDomain).replace(/\/$/, "")}${raw.startsWith("/") ? "" : "/"}${raw}`);
  }

  for (const attempt of attempts) {
    try {
      const u = new URL(attempt);
      u.hash = "";
      u.search = "";
      return {
        url: u.toString(),
        host: u.hostname,
        path: normalizePathValue(u.pathname || "/"),
      };
    } catch {
      // continue
    }
  }

  return { url: undefined, host: fallbackDomain, path: undefined };
};

export function parseKeywordBuffer(
  buffer: Buffer,
  fileName: string | null,
  options: { fallbackDomain?: string } = {}
): ParsedKeywordRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const fallbackHost = options.fallbackDomain
    ? new URL(normalizeDomain(options.fallbackDomain)).hostname
    : undefined;

  const parsed: ParsedKeywordRow[] = [];

  rows.forEach((row) => {
    const termKey = findKey(row, ["keyword", "suchbegriff", "kw"]);
    const urlKey = findKey(row, ["url", "landing", "seite"]);
    const volumeKey = findKey(row, ["volume", "suchvolumen"]);
    const difficultyKey = findKey(row, ["difficulty", "competition", "wettbewerb"]);
    const positionKey = findKey(row, ["position", "rank"]);

    const termRaw = termKey ? row[termKey] : undefined;
    const term = termRaw !== undefined && termRaw !== null ? String(termRaw).trim() : "";
    if (!term) return;

    const urlRaw = urlKey ? row[urlKey] : undefined;
    const urlStr = urlRaw !== undefined && urlRaw !== null ? String(urlRaw).trim() : "";
    const urlInfo = urlStr ? normalizeUrl(urlStr, fallbackHost) : { url: undefined, host: fallbackHost, path: undefined };
    const pathValue = urlInfo.path || "/";

    const meta: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      if ([termKey, urlKey, volumeKey, difficultyKey, positionKey].includes(key)) return;
      if (value === "") return;
      meta[lower] = value;
    });
    if (fileName) {
      meta._sourceFile = fileName;
    }

    parsed.push({
      term,
      url: urlInfo.url,
      host: urlInfo.host || fallbackHost,
      path: normalizePathValue(pathValue),
      volume: toNumber(volumeKey ? row[volumeKey] : undefined),
      difficulty: toNumber(difficultyKey ? row[difficultyKey] : undefined),
      position: toNumber(positionKey ? row[positionKey] : undefined),
      meta,
    });
  });

  return parsed;
}
