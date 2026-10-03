import { chromium } from 'playwright';
import fs from 'fs';
const OUT = '/workspaces/code/opensource-marceloceccon/bitcoinmining/bitcoinmining/docs/case-study/before';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'https://www.bitcoinminingfarmcalculator.com';
const TABS = ['Miners', 'Energy', 'Deploy & Labor', 'Thermal', 'Projections', 'About'];
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const b = await chromium.launch();
const log = [];
for (const [w, h, dsf, mobile] of [[1440, 900, 1, false], [390, 844, 2, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  if (w === 1440) {
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[console.${m.type()}] ${m.text()}`); });
    p.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
    p.on('requestfailed', r => log.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
    p.on('response', r => { if (r.status() >= 400) log.push(`[http ${r.status()}] ${r.url()}`); });
  }
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/${w}-landing.png` });
  const tpl = p.locator('button', { hasText: 'Small Farm' }).first();
  await tpl.scrollIntoViewIfNeeded(); await tpl.click();
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(2000);
  log.push(`[${w}] template applied; metrics panel text: ` + (await p.locator('body').innerText()).includes('No Metrics Yet'));
  for (const t of TABS) {
    const btn = p.locator('button', { hasText: new RegExp(`^\\s*0\\d\\s*${t.replace(/[&]/g, '\\&')}\\s*$`) }).first();
    let ok = await btn.count() && await btn.isVisible();
    let target = btn;
    if (!ok) { target = p.locator('button', { hasText: t }).filter({ visible: true }).first(); ok = await target.count(); }
    if (!ok) { console.log(w, 'TAB NOT FOUND', t); continue; }
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(2000);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(300);
    const f = `${OUT}/${w}-${slug(t)}.png`;
    await p.screenshot({ path: f, fullPage: true });
    console.log(w, t, '->', f, fs.statSync(f).size);
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync('console-1440.log', log.join('\n'));
console.log('--- console/page errors (1440) ---\n' + log.join('\n'));
