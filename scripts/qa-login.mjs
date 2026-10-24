export default async function run(page, ui) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const login = await page.evaluate(async () => {
    const r = await fetch('http://localhost:5000/api/auth/agent/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin@cmu.sn', password: 'superadmin2026' })
    });
    const j = await r.json();
    return { ok: r.ok, token: j.token || (j.data && j.data.token), user: j.user || (j.data && j.data.user) };
  });
  if (!login.ok || !login.token) return login;
  await page.evaluate((l) => {
    localStorage.setItem('cmu-token', l.token);
    localStorage.setItem('cmu-refresh-token', 'qa-refresh');
    localStorage.setItem('agentToken', l.token);
    localStorage.setItem('authToken', l.token);
    localStorage.setItem('cmuUser', JSON.stringify(l.user || {}));
    if (l.user) localStorage.setItem('agentUser', JSON.stringify(l.user));
    localStorage.setItem('portalMode', 'superadmin');
  }, login);
  await page.reload();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.evaluate(() => { window.location.hash = '#/studio-cartes'; });
  await page.waitForTimeout(8000);
  const probe = await page.evaluate(async () => {
    const token = localStorage.getItem('cmu-token');
    const res = await fetch('http://localhost:5000/api/beneficiaries/2288/photo', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const b = await res.blob();
    const imgs = Array.from(document.images).filter((i) => i.src.includes('/api/beneficiaries/') || i.src.startsWith('blob:')).map((i) => ({ src: i.src.slice(0, 80), ok: i.complete && i.naturalWidth > 0 }));
    return { status: res.status, type: b.type, size: b.size, imgs, total: imgs.length };
  });
  const final = await page.evaluate(() => ({
    url: location.href,
    keys: Object.keys(localStorage),
    imgs: Array.from(document.images).map((i) => ({ src: i.src.slice(0, 100), ok: i.complete && i.naturalWidth > 0 }))
  }));
  return { probe, final };
}

