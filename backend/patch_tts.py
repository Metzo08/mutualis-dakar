with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = "// 7b. Synthèse vocale (TTS) neuronale haute fidélité (Oolel-Voices Wolof + Piper FR + Cache disque)"
repl1 = """// 7b. Synthèse vocale (TTS) neuronale haute fidélité (Oolel-Voices Wolof + Edge-TTS Wolof phonétique + Piper + Cache disque)
const { isWolofText, convertWolofToFrenchPhonetics } = require('./phonetics.js');"""

if target1 in content:
    content = content.replace(target1, repl1, 1)
    print("Replaced target1")
else:
    print("target1 not found")

old_cache_check = """    // 0. Cache instantané : WAV natif (Oolel-Voices) pour Wolof, MP3 (Denise) pour Français
    if (isWolof) {
      if (fs.existsSync(wavCacheFile) && fs.statSync(wavCacheFile).size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT_WAV');
        return res.sendFile(wavCacheFile);
      }
    } else {
      if (fs.existsSync(mp3CacheFile) && fs.statSync(mp3CacheFile).size > 1000) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-TTS-Cache', 'HIT_MP3');
        return res.sendFile(mp3CacheFile);
      }
    }"""

new_cache_check = """    // 0. Cache instantané ultra-rapide (0 ms) : WAV ou MP3
    if (fs.existsSync(wavCacheFile) && fs.statSync(wavCacheFile).size > 1000) {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('X-TTS-Cache', 'HIT_WAV');
      return res.sendFile(wavCacheFile);
    }
    if (fs.existsSync(mp3CacheFile) && fs.statSync(mp3CacheFile).size > 1000) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-TTS-Cache', 'HIT_MP3');
      return res.sendFile(mp3CacheFile);
    }

    // Adaptation phonétique indispensable pour le Wolof (restitue phonèmes, accents et élisions naturelles)
    const textToSynthesize = isWolof ? convertWolofToFrenchPhonetics(cleanText) : cleanText;"""

if old_cache_check in content:
    content = content.replace(old_cache_check, new_cache_check, 1)
    print("Replaced old_cache_check")
else:
    print("old_cache_check not found")

old_edge = """        console.log(`[Neural HD TTS (${langKey})] Synthèse vocale naturelle Denise : "${cleanText.substring(0, 45)}..."`);
        const { execFile } = require('child_process');
        await new Promise((resolve, reject) => {
          execFile('C:/Python313/python.exe', ['-m', 'edge_tts', '--voice', 'fr-FR-DeniseNeural', '--text', cleanText, '--write-media', mp3CacheFile], { timeout: 15000 }, (err) => {"""

new_edge = """        console.log(`[Neural HD TTS (${langKey})] Synthèse vocale Denise (${isWolof ? 'Wolof adapté' : 'Français'}) : "${textToSynthesize.substring(0, 45)}..."`);
        const { execFile } = require('child_process');
        await new Promise((resolve, reject) => {
          execFile('C:/Python313/python.exe', ['-m', 'edge_tts', '--voice', 'fr-FR-DeniseNeural', '--text', textToSynthesize, '--write-media', mp3CacheFile], { timeout: 15000 }, (err) => {"""

if old_edge in content:
    content = content.replace(old_edge, new_edge, 1)
    print("Replaced old_edge")
else:
    print("old_edge not found")

content = content.replace("signal: AbortSignal.timeout(35000)", "signal: AbortSignal.timeout(3000)")

with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Finished patching server.js")
