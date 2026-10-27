// Build step for search engines. After Vite builds dist/index.html it writes:
// - one HTML file per public page (own title, description, canonical, structured data)
// - app.html for app screens (no canonical; the app marks private screens noindex)
// - 404.html, so unknown URLs (e.g. the old website's pages) return a real 404
// - sitemap.xml, robots.txt and _redirects (Cloudflare Pages)
// The page list lives in src/seo/site.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import {
  APP_ROUTES,
  FAQS,
  ROBOTS_DISALLOW,
  SEO_PAGES,
  SEO_REDIRECTS,
  SITE_IMAGE,
  SITE_NAME,
  SITE_URL,
  type SeoPage,
} from './src/seo/site.ts';

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const setTag = (html: string, pattern: RegExp, replacement: string) => {
  if (!pattern.test(html)) throw new Error(`seo-plugin: tag not found in index.html: ${pattern}`);
  return html.replace(pattern, replacement);
};

const removeTag = (html: string, pattern: RegExp) => html.replace(pattern, '');

const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const organization = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: SITE_IMAGE,
  email: 'contact@mediarca.in',
  areaServed: 'IN',
};

const structuredData = (page: SeoPage): string => {
  const url = `${SITE_URL}${page.path}`;
  const graph: unknown[] = [];
  if (page.path === '/') {
    graph.push(organization, {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      inLanguage: 'en-IN',
      publisher: { '@id': `${SITE_URL}/#organization` },
    });
  } else {
    graph.push({
      '@type': 'WebPage',
      '@id': url,
      url,
      name: page.title,
      description: page.description,
      inLanguage: 'en-IN',
      isPartOf: { '@id': `${SITE_URL}/#website` },
    });
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.title.replace(/ — MediArca$/, ''), item: url },
      ],
    });
  }
  if (page.path === '/faq') {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }
  return jsonLd({ '@context': 'https://schema.org', '@graph': graph });
};

const renderPage = (template: string, page: SeoPage) => {
  const url = `${SITE_URL}${page.path}`;
  const title = escapeAttr(page.title);
  const description = escapeAttr(page.description);
  let html = template;
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = setTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`);
  html = setTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`);
  html = setTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`);
  html = setTag(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`);
  html = setTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  return html.replace('</head>', `    ${structuredData(page)}\n  </head>`);
};

const renderWithoutCanonical = (template: string, title: string, robots?: string) => {
  let html = template;
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`);
  html = removeTag(html, /\s*<link rel="canonical" href="[^"]*" \/>/);
  html = removeTag(html, /\s*<meta property="og:url" content="[^"]*" \/>/);
  if (robots) html = html.replace('<meta name="viewport"', `<meta name="robots" content="${robots}" />\n    <meta name="viewport"`);
  return html;
};

const todayInIndia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const sitemapXml = () => {
  const lastmod = todayInIndia();
  const urls = SEO_PAGES.map(
    (page) =>
      `  <url>\n    <loc>${SITE_URL}${page.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const robotsTxt = () =>
  [
    'User-agent: *',
    'Allow: /',
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');

// Cloudflare Pages: first matching rule wins. Public pages are real files, so they are not listed.
// No catch-all rule: any other path falls through to 404.html with status 404.
const redirectsFile = () =>
  [
    '# Generated by seo-plugin.ts. Edit src/seo/site.ts instead.',
    ...SEO_REDIRECTS.map(([from, to]) => `${from}  ${to}  301`),
    ...APP_ROUTES.map((route) => `${route}  /app  200`),
    '',
  ].join('\n');

export const seoPlugin = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'mediarca-seo',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    writeBundle() {
      const template = readFileSync(join(outDir, 'index.html'), 'utf-8');
      for (const page of SEO_PAGES) writeFileSync(join(outDir, page.file), renderPage(template, page));
      writeFileSync(join(outDir, 'app.html'), renderWithoutCanonical(template, SITE_NAME));
      writeFileSync(join(outDir, '404.html'), renderWithoutCanonical(template, `Page Not Found — ${SITE_NAME}`, 'noindex'));
      writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml());
      writeFileSync(join(outDir, 'robots.txt'), robotsTxt());
      writeFileSync(join(outDir, '_redirects'), redirectsFile());
    },
  };
};
