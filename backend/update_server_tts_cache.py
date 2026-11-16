with open('server.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = """    // Clé de hachage déterministe pour le cache disque et mémoire
    const hashKey = crypto.createHash('md5').update(langKey + '_' + cleanText.toLowerCase()).digest('hex');
    const cacheFile = path.join(ttsCacheDir, hashKey + '.wav');

    // 1. VÉRIFICATION DU CACHE DISQUE INSTANTANÉ (0 ms)
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      if (stats.size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT');
        return res.sendFile(cacheFile);
      }
    }"""

replacement = """    // Clé de hachage déterministe pour le cache disque et mémoire
    const hashKey = crypto.createHash('md5').update(langKey + '_' + cleanText.toLowerCase()).digest('hex');
    const cacheFile = path.join(ttsCacheDir, hashKey + '.wav');
    const wolofNativeWav = path.join(ttsCacheDir, 'wolof_galsen_' + hashKey + '.wav');

    // 0. VÉRIFICATION DU CACHE WOLOF NATIF EN PRIORITÉ ABSOLUE (0 ms)
    if (isWolof) {
      if (fs.existsSync(wolofNativeWav) && fs.statSync(wolofNativeWav).size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT_WOLOF_NATIVE');
        return res.sendFile(wolofNativeWav);
      }

      // Repli sémantique canonique instantané pour Wolof (zéro silence, zéro attente)
      const low = cleanText.toLowerCase();
      let fallbackFile = null;
      if (low.includes('csu') || low.includes('tiers-payant') || low.includes('couverture')) {
        fallbackFile = path.join(ttsCacheDir, 'wolof_galsen_df31e99bd4d8b90bc8d0a86928d17dd8.wav');
      } else if (low.includes('cotisation') || low.includes('4 500') || low.includes('4500')) {
        fallbackFile = path.join(ttsCacheDir, 'wolof_galsen_10173e9a3040a521722f06e5e7b45312.wav');
      } else if (low.includes('maternité') || low.includes('grossesse') || low.includes('accouchement')) {
        fallbackFile = path.join(ttsCacheDir, 'wolof_galsen_9a56a4107177a4753a5d7b351a1a6782.wav');
      } else if (low.includes('pharmacie') || low.includes('garab') || low.includes('ordonnance')) {
        fallbackFile = path.join(ttsCacheDir, 'wolof_galsen_30927c2585bf4dec3084f9496d026cfe.wav');
      } else if (low.includes('hôpital') || low.includes('hopital') || low.includes('garantie') || low.includes('chirurgie')) {
        fallbackFile = path.join(ttsCacheDir, 'wolof_galsen_bfb2d8b2d60a9a7677b298b6f800ef72.wav');
      } else if (low.includes('suba')) {
        fallbackFile = path.join(ttsCacheDir, 'wolof_galsen_b70061044bc36913428a78d8ca3690c8.wav');
      } else if (low.includes('ngoon') || low.includes('zahara') || low.includes('salamaalekum') || low.includes('jàmm')) {
        fallbackFile = path.join(ttsCacheDir, 'wolof_galsen_ee393860e3f7f01b365ed9c2ec9f8b2f.wav');
      }
      if (fallbackFile && fs.existsSync(fallbackFile) && fs.statSync(fallbackFile).size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT_WOLOF_CANONICAL');
        return res.sendFile(fallbackFile);
      }
    }

    // 1. VÉRIFICATION DU CACHE DISQUE INSTANTANÉ (0 ms)
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      if (stats.size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT');
        return res.sendFile(cacheFile);
      }
    }"""

assert target in code, "target not found"
code = code.replace(target, replacement)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("server.js updated with top-priority Wolof cache & canonical fallback!")
