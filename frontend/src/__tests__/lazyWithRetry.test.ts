import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// FIX-054: a page whose code is already downloaded must show at once, not a spinner
const Hello: React.FC<{ name: string }> = ({ name }) => React.createElement('p', null, `Hello ${name}`);
const render = (Page: React.FC<{ name: string }>) =>
  renderToString(
    React.createElement(Suspense, { fallback: React.createElement('i', null, 'spinner') }, React.createElement(Page, { name: 'Asha' }))
  );

describe('lazyWithRetry', () => {
  it('shows the loading fallback while the page code is not downloaded yet', () => {
    const Page = lazyWithRetry(() => new Promise<{ default: typeof Hello }>(() => {}));
    expect(render(Page)).toContain('spinner');
  });

  it('renders straight away once preloaded', async () => {
    let imports = 0;
    const Page = lazyWithRetry(async () => {
      imports += 1;
      return { default: Hello };
    });
    Page.preload();
    Page.preload();
    await new Promise((r) => setTimeout(r, 0));
    const html = render(Page);
    expect(html).toContain('Hello');
    expect(html).toContain('Asha');
    expect(html).not.toContain('spinner');
    expect(imports).toBe(1);
  });

  it('tries the download again after a failed preload', async () => {
    let attempts = 0;
    const Page = lazyWithRetry(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network down');
      return { default: Hello };
    });
    Page.preload();
    await new Promise((r) => setTimeout(r, 0));
    Page.preload();
    await new Promise((r) => setTimeout(r, 0));
    expect(attempts).toBe(2);
    expect(render(Page)).toContain('Hello');
  });
});
