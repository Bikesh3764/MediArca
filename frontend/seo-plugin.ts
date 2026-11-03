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
  SITE_ALT_NAMES,
  SITE_DESCRIPTION,
  SITE_IMAGE,
  SITE_NAME,
  SITE_SAME_AS,
  SITE_SOCIAL,
  SITE_URL,
  type SeoPage,
} from './src/seo/site.ts';
import { ANDROID_APK_URL, APP_DOWNLOAD_PATH } from './src/config/app.ts';

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const setTag = (html: string, pattern: RegExp, replacement: string) => {
  if (!pattern.test(html)) throw new Error(`seo-plugin: tag not found in index.html: ${pattern}`);
  return html.replace(pattern, replacement);
};

const removeTag = (html: string, pattern: RegExp) => html.replace(pattern, '');

const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

// Brand facts for Google, so a search for "mediarca" is read as this site's name
// and not as a misspelling of a similar word.
const organization = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: SITE_ALT_NAMES,
  url: `${SITE_URL}/`,
  logo: { '@type': 'ImageObject', url: SITE_IMAGE, width: 512, height: 512 },
  image: SITE_IMAGE,
  description: SITE_DESCRIPTION,
  email: 'contact@mediarca.in',
  areaServed: { '@type': 'Country', name: 'India' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'contact@mediarca.in',
    areaServed: 'IN',
    availableLanguage: ['en', 'hi'],
  },
  ...(SITE_SAME_AS.length ? { sameAs: SITE_SAME_AS } : {}),
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  alternateName: SITE_ALT_NAMES,
  description: SITE_DESCRIPTION,
  inLanguage: 'en-IN',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const structuredData = (page: SeoPage): string => {
  const url = `${SITE_URL}${page.path}`;
  const graph: unknown[] = [];
  if (page.path === '/') {
    graph.push(organization, website);
  } else {
    graph.push({
      '@type': 'WebPage',
      '@id': url,
      url,
      name: page.title,
      description: page.description,
      inLanguage: 'en-IN',
      isPartOf: website,
      publisher: { '@id': `${SITE_URL}/#organization` },
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

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const NAV_LINKS: Array<[path: string, label: string]> = [
  ['/doctors', 'Find a doctor'],
  ['/how-it-works', 'How it works'],
  ['/faq', 'FAQ'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
];

// The page's text as plain HTML inside #root (FIX-070). Crawlers that don't run JavaScript
// (Bing, link previews) read it; the app replaces it when it starts. Inline styles only,
// because Tailwind doesn't scan this file.
const pageBody = (page: SeoPage) => {
  const link = (path: string, label: string) =>
    `<a href="${path}" style="color:#0066cc;text-decoration:none">${escapeText(label)}</a>`;
  const block = (title: string, text: string, tag = 'h2') =>
    `<section style="margin-top:20px"><${tag} style="font-size:19px;font-weight:600;margin:0">${escapeText(title)}</${tag}><p style="margin:6px 0 0;color:#424245">${escapeText(text)}</p></section>`;
  const points = (page.points ?? []).map((p) => block(p.title, p.text));
  const faqs = page.path === '/faq' ? FAQS.map((f) => block(f.question, f.answer, 'h3')) : [];
  const footerLinks = SEO_PAGES.filter((p) => p.path !== '/')
    .map((p) => link(p.path, p.title.replace(/ — MediArca$/, '')))
    .concat(SITE_SOCIAL.map((s) => `<a href="${s.url}" rel="me noopener" style="color:#0066cc;text-decoration:none">${s.label}</a>`))
    .join(' · ');
  return [
    '<div style="max-width:960px;margin:0 auto;padding:16px;color:#1d1d1f;line-height:1.5">',
    `<header style="display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center"><a href="/" style="font-weight:600;font-size:19px;color:#1d1d1f;text-decoration:none">${SITE_NAME}</a><nav style="display:flex;flex-wrap:wrap;gap:16px;font-size:14px">${NAV_LINKS.map(([p, l]) => link(p, l)).join('')}</nav></header>`,
    `<main style="padding:40px 0"><h1 style="font-size:34px;line-height:1.15;font-weight:600;margin:0">${escapeText(page.heading)}</h1><p style="margin:12px 0 0;font-size:17px;color:#424245">${escapeText(page.intro)}</p>${points.join('')}${faqs.join('')}<p style="margin-top:28px">${link('/doctors', 'Find a doctor and book a token')}</p></main>`,
    `<footer style="border-top:1px solid #e5e5ea;padding-top:16px;font-size:13px;color:#86868b">${footerLinks}<p style="margin:8px 0 0">© ${SITE_NAME} · ${SITE_URL.replace('https://', '')}</p></footer>`,
    '</div>',
  ].join('');
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
  html = setTag(html, /<div id="root"><\/div>/, `<div id="root">${pageBody(page)}</div>`);
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
    // Short link to the latest Android app (302, so it can point to a newer build later)
    `${APP_DOWNLOAD_PATH}  ${ANDROID_APK_URL}  302`,
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
