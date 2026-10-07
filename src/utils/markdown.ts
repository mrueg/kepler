import { defaultUrlTransform } from 'react-markdown';

const GITHUB_TREE_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^/]+)\/(.+?)\/?$/;

/**
 * Resolves a URL from a README rendered on this site so that relative links
 * point at GitHub and relative images load from raw.githubusercontent.com,
 * instead of resolving against the Kepler site.
 *
 * @param url the URL as written in the markdown
 * @param key the attribute it came from (`href` for links, `src` for images)
 * @param githubDirUrl the GitHub tree URL of the folder the markdown lives in,
 *   e.g. https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/1234-foo
 */
export function resolveMarkdownUrl(url: string, key: string, githubDirUrl: string): string {
  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//');
  const match = githubDirUrl.match(GITHUB_TREE_URL);
  if (isAbsolute || url.startsWith('#') || !match) return defaultUrlTransform(url);

  const [, repo, branch, dir] = match;
  const base = key === 'src'
    ? `https://raw.githubusercontent.com/${repo}/${branch}/`
    : `https://github.com/${repo}/blob/${branch}/`;
  // Like on GitHub, root-relative paths are relative to the repository root.
  const resolved = url.startsWith('/') ? new URL(url.slice(1), base) : new URL(url, `${base}${dir}/`);
  return resolved.href;
}
