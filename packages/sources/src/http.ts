import type { SourceContext } from "@mangadl/core";

export async function fetchText(ctx: SourceContext, url: string): Promise<string> {
  const response = await ctx.fetch(url, {
    signal: ctx.signal,
    headers: {
      "user-agent": ctx.userAgent,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}

export async function fetchJson<T>(ctx: SourceContext, url: string): Promise<T> {
  const response = await ctx.fetch(url, {
    signal: ctx.signal,
    headers: {
      "user-agent": ctx.userAgent,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json() as Promise<T>;
}

export function absoluteUrl(baseUrl: string, value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export function sameHost(url: string, hostnames: string[]): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return hostnames.some((hostname) => host === hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}
