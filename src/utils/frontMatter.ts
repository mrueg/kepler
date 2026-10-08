import { load as yamlLoad } from 'js-yaml';

export interface FrontMatter {
  /** Parsed front matter; empty when the file has none. */
  data: Record<string, unknown>;
  /** The document without its front matter. */
  body: string;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function unquote(value: string): string {
  const v = value.trim();
  // A quoted value followed by a note, e.g. `"@user" (original author)`: keep the quoted part.
  const quoted = v.match(/^(["'])(.*?)\1/);
  return quoted ? quoted[2] : v;
}

/**
 * Line-based fallback for front matter that isn't valid YAML, as found in
 * some hand-written proposals: `*` bullets, unquoted `@handles`, bare URLs
 * under a key, notes after quoted values. Handles flat `key: value` pairs and
 * lists of scalars, which is all proposal front matter uses.
 */
export function parseLooseFrontMatter(source: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let key: string | null = null;
  for (const raw of source.split(/\r?\n/)) {
    // Drop comments (a # preceded by whitespace, so URL fragments survive).
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    // A key needs whitespace or end of line after the colon, so "https://…" isn't one.
    const pair = line.match(/^([A-Za-z][\w-]*):(?:\s+(.*))?$/);
    if (pair) {
      key = pair[1];
      const value = pair[2]?.trim();
      data[key] = value ? unquote(value) : undefined;
      continue;
    }
    if (!key) continue;
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    const value = unquote(item ? item[1] : line);
    const current = data[key];
    data[key] = [...(Array.isArray(current) ? current : current === undefined ? [] : [current]), value];
  }
  return data;
}

/** Splits a Markdown document into front matter and body, tolerating invalid YAML. */
export function parseFrontMatter(markdown: string): FrontMatter {
  const match = markdown.match(FRONT_MATTER);
  if (!match) return { data: {}, body: markdown };
  const body = markdown.slice(match[0].length);
  try {
    const parsed = yamlLoad(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, body };
    }
  } catch {
    // Fall through to the line-based parser.
  }
  return { data: parseLooseFrontMatter(match[1]), body };
}

/** The first `# Heading` or setext `Heading\n===` in a Markdown body. */
export function firstHeading(body: string): string | undefined {
  const match = body.match(/^#\s+(.+?)\s*#*\s*$|^([^\n]+)\n=+\s*$/m);
  const heading = (match?.[1] ?? match?.[2])?.trim();
  return heading || undefined;
}
