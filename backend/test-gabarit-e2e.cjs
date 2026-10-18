/* Test de bout en bout : connexion Super Admin → téléchargement du gabarit */
(async () => {
  // 1. Connexion Super Admin
  const login = await fetch('http://localhost:5000/api/auth/agent/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin@anacsu.sn', password: process.env.TEST_SA_PASSWORD || 'super123' }),
  }).catch((e) => { console.error('login injoignable :', e.message); process.exit(1); });
  console.log('login :', login.status);
  if (!login.ok) {
    console.log('réponse :', await login.text());
    process.exit(1);
  }
  const data = await login.json();
  const token = data.token || (data.data && data.data.token) || '';
  console.log('token reçu :', token ? 'oui' : 'NON');
  if (!token) { console.log('payload :', JSON.stringify(data).slice(0, 300)); process.exit(1); }

  // 2. Gabarit
  const res = await fetch('http://localhost:5000/api/msds/DKR/gabarit-adhesion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cotisation: 6000, adhesion: 15000 }),
  });
  console.log('gabarit :', res.status, res.headers.get('content-type'));
  if (!res.ok) {
    console.log('erreur :', await res.text());
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('taille du fichier :', buf.length, 'octets');
  // Un xlsx commence par PK (zip)
  console.log('signature xlsx :', buf.slice(0, 2).toString() === 'PK' ? 'OK (PK)' : 'INVALIDE');
  require('fs').writeFileSync('backend/reports/test-gabarit-telecharge.xlsx', buf);
  console.log('→ backend/reports/test-gabarit-telecharge.xlsx');
  process.exit(0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
