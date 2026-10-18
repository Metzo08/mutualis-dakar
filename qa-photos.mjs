export default async function run(page, ui) {
  // 1. Portail Super admin.
  await ui.click('@e27');
  await page.waitForTimeout(1500);
  const snap = await ui.snapshot();
  const userRef = (snap.match(/@(e\d+) textbox[^\n]*(?:identifiant|user|email|nom d'utilisateur|login)/i) || [])[1];
  const passRef = (snap.match(/@(e\d+) textbox[^\n]*(?:mot de passe|password)/i) || [])[1];
  const btnRef = (snap.match(/@(e\d+) button[^\n]*(?:Connexion|Se connecter|Login)/i) || [])[1];
  if (!userRef || !passRef || !btnRef) {
    return { etape: 'login-form-introuvable', snapshot: snap.slice(0, 2500) };
  }
  await ui.fill(`@${userRef}`, 'superadmin@anacsu.sn');
  await ui.fill(`@${passRef}`, 'SuperAdmin2026!');
  await ui.click(`@${btnRef}`);
  await page.waitForTimeout(3000);

  // 2. Studio de cartes.
  await page.evaluate(() => { window.location.hash = '#/card-studio'; });
  await page.waitForTimeout(4000);

  // 3. Diagnostic du registre local + rendu des images.
  const diag = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => /unamusc|member|beneficiar/i.test(k));
    let n = 0, urlPhoto = 0, dataUrls = 0, srvIds = 0;
    for (const k of keys) {
      try {
        const arr = JSON.parse(localStorage.getItem(k));
        if (!Array.isArray(arr)) continue;
        n = Math.max(n, arr.length);
        arr.forEach((m) => {
          const u = String(m.photoUrl || '');
          if (u.includes('/api/beneficiaries/') && u.endsWith('/photo')) urlPhoto++;
          else if (u.startsWith('data:image')) dataUrls++;
          if (m.serverId || /^SRV-/.test(String(m.id || ''))) srvIds++;
        });
      } catch { /* pas un tableau */ }
    }
    return { keys, n, urlPhoto, dataUrls, srvIds };
  });

  const imgs = await page.evaluate(() => {
    const all = [...document.querySelectorAll('img')];
    return {
      total: all.length,
      casses: all.filter((i) => i.complete && i.naturalWidth === 0).length,
      blobs: all.filter((i) => (i.src || '').startsWith('blob:')).length
    };
  });

  return { diag, imgs, url: page.url() };
}
