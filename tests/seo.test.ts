import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';
import { GET as apiDocs } from '@/app/api-docs/route';
import { FAQ, FAQ_JSON_LD } from '@/lib/faq';
import { SITE_URL, pageMetadata } from '@/lib/site';

describe('sitemap', () => {
  it('lists every public page once, with a real (not build-time) lastmod', () => {
    const entries = sitemap();
    expect(entries.map((e) => e.url)).toEqual([
      SITE_URL,
      `${SITE_URL}/methodology`,
      `${SITE_URL}/mcp`,
      `${SITE_URL}/api-docs`,
    ]);
    for (const e of entries) {
      const d = e.lastModified as Date;
      expect(Number.isNaN(d.getTime())).toBe(false);
      expect(Date.now() - d.getTime()).toBeGreaterThan(0);
    }
  });
});

describe('pageMetadata', () => {
  it('sets canonical, og:url and social titles for the page, not the homepage', () => {
    const m = pageMetadata({ path: '/mcp', socialTitle: 'T', description: 'D' });
    expect(m.alternates?.canonical).toBe('/mcp');
    expect(m.openGraph).toMatchObject({ url: '/mcp', title: 'T', description: 'D' });
    expect(m.twitter).toMatchObject({ title: 'T', description: 'D' });
  });
});

describe('FAQ structured data', () => {
  it('is generated from the visible FAQ, question for question', () => {
    expect(FAQ_JSON_LD.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      FAQ.map((f) => [f.question, f.answer]),
    );
  });
});

describe('/api-docs SEO', () => {
  it('declares its canonical and lists every endpoint for no-JS crawlers', async () => {
    const html = await (await apiDocs()).text();
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/api-docs" />`);
    for (const ep of ['POST /api/calculate', 'POST /api/forecast', 'GET /api/miners', 'GET /api/network']) {
      expect(html).toContain(ep);
    }
  });
});
