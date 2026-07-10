import { test } from '@playwright/test';

test('debug: office floor computed style', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.setItem('__cleared', '1');
    } catch {}
  });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const ov = document.querySelector('.office-view');
    if (!ov) return { found: false };
    const floorDiv = ov.querySelector('div') as HTMLElement;
    const cs = getComputedStyle(floorDiv);
    const ovr = ov.getBoundingClientRect();
    const fr = floorDiv.getBoundingClientRect();
    return {
      found: true,
      ovRect: { x: ovr.x, y: ovr.y, w: ovr.width, h: ovr.height },
      floorBgImage: cs.backgroundImage.slice(0, 160),
      floorBgColor: cs.backgroundColor,
      floorRect: { x: fr.x, y: fr.y, w: fr.width, h: fr.height },
      floorZ: cs.zIndex,
    };
  });
  console.log(JSON.stringify(info, null, 2));
});
