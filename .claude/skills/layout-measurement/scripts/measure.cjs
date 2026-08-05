#!/usr/bin/env node
/**
 * Measure real layout in real Chromium. CommonJS on purpose: playwright is
 * installed globally here and ESM ignores NODE_PATH.
 *
 * Pairs every number with a presence check, because a measurement that reports
 * "overflow: 0" after the overflowing elements were deleted is not evidence.
 *
 * Exit codes:
 *   0  measured, and every --expect-present selector was found
 *   1  measured, but an expected element is MISSING -- the number is not evidence
 *   2  could not measure (browser/page/selector error)
 */

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
if (!process.env.NODE_PATH?.includes('/opt/node22/lib/node_modules')) {
  process.env.NODE_PATH = ['/opt/node22/lib/node_modules', process.env.NODE_PATH]
    .filter(Boolean)
    .join(':');
  require('module').Module._initPaths();
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
function argAll(name) {
  return process.argv.reduce(
    (acc, a, i) => (a === `--${name}` ? [...acc, process.argv[i + 1]] : acc),
    [],
  );
}

(async () => {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('Cannot resolve playwright. It is installed globally here; run with');
    console.error('  NODE_PATH=/opt/node22/lib/node_modules node <this script>');
    console.error('and keep the harness .cjs -- ESM ignores NODE_PATH.');
    process.exit(2);
  }

  const url = arg('url');
  if (!url) {
    console.error('--url is required (point it at a running dev server)');
    process.exit(2);
  }
  const width = Number(arg('width', 390));
  const height = Number(arg('height', 844));
  const expects = argAll('expect-present');
  const wantOverflow = Boolean(arg('report-overflow', false));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    if (!resp || !resp.ok()) {
      console.error(`page did not load cleanly: ${resp ? resp.status() : 'no response'}`);
      process.exit(2);
    }

    console.log(`viewport ${width}x${height}  ${url}`);

    if (wantOverflow) {
      const o = await page.evaluate(() => {
        const d = document.documentElement;
        const over = [...document.querySelectorAll('*')]
          .map((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
              tag: el.tagName.toLowerCase(),
              cls: (el.className?.toString?.() || '').slice(0, 40),
              w: Math.round(r.width),
              right: Math.round(r.right),
              shrink: cs.flexShrink,
              maxW: cs.maxWidth,
            };
          })
          .filter((e) => e.right > d.clientWidth + 1)
          .sort((a, b) => b.right - a.right)
          .slice(0, 5);
        return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, over };
      });
      const overflow = o.scrollWidth - o.clientWidth;
      console.log(`overflow: ${overflow}px  (scrollWidth ${o.scrollWidth} vs clientWidth ${o.clientWidth})`);
      for (const e of o.over) {
        console.log(
          `  ${e.tag}.${e.cls} w=${e.w} right=${e.right} flex-shrink=${e.shrink} max-width=${e.maxW}`,
        );
      }
    }

    let missing = 0;
    for (const sel of expects) {
      const n = await page.locator(sel).count();
      console.log(`  present[${n}]  ${sel}`);
      if (n === 0) missing++;
    }

    if (expects.length === 0) {
      console.log('\nNOTE: no --expect-present given. A number on its own is not evidence --');
      console.log('deleting the overflowing element also reports zero overflow. Pass the');
      console.log('elements your fix could plausibly destroy.');
    }
    if (missing > 0) {
      console.error(`\n${missing} expected element(s) MISSING -- treat the numbers above as void.`);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`measurement failed: ${err.message}`);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
