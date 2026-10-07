import { describe, expect, it } from 'vitest';
import { resolveMarkdownUrl } from './markdown';

const dir = 'https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/1234-foo';

describe('resolveMarkdownUrl', () => {
  it('resolves relative links to GitHub', () => {
    expect(resolveMarkdownUrl('../5678-bar/README.md', 'href', dir))
      .toBe('https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/5678-bar/README.md');
    expect(resolveMarkdownUrl('kep.yaml', 'href', dir))
      .toBe('https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/1234-foo/kep.yaml');
  });

  it('resolves relative images to raw.githubusercontent.com', () => {
    expect(resolveMarkdownUrl('./images/diagram.png', 'src', dir))
      .toBe('https://raw.githubusercontent.com/kubernetes/enhancements/master/keps/sig-node/1234-foo/images/diagram.png');
  });

  it('resolves root-relative paths against the repository root', () => {
    expect(resolveMarkdownUrl('/keps/README.md', 'href', dir))
      .toBe('https://github.com/kubernetes/enhancements/blob/master/keps/README.md');
  });

  it('leaves absolute URLs and in-page anchors alone', () => {
    expect(resolveMarkdownUrl('https://kubernetes.io/docs', 'href', dir)).toBe('https://kubernetes.io/docs');
    expect(resolveMarkdownUrl('#summary', 'href', dir)).toBe('#summary');
  });

  it('still strips dangerous protocols', () => {
    expect(resolveMarkdownUrl('javascript:alert(1)', 'href', dir)).toBe('');
  });
});
