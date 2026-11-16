with open('server.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = """    // 0. VÉRIFICATION DU CACHE WOLOF NATIF EN PRIORITÉ ABSOLUE (0 ms)
    if (isWolof) {
      if (fs.existsSync(wolofNativeWav) && fs.statSync(wolofNativeWav).size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT_WOLOF_NATIVE');
        return res.sendFile(wolofNativeWav);
      }"""

replacement = """    // 0. VÉRIFICATION DU CACHE WOLOF NATIF EN PRIORITÉ ABSOLUE (0 ms - RAM STREAM)
    if (isWolof) {
      if (fs.existsSync(wolofNativeWav) && fs.statSync(wolofNativeWav).size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT_WOLOF_NATIVE');
        const buf = fs.readFileSync(wolofNativeWav);
        return res.send(buf);
      }"""

fallback_target = """      if (fallbackFile && fs.existsSync(fallbackFile) && fs.statSync(fallbackFile).size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT_WOLOF_CANONICAL');
        return res.sendFile(fallbackFile);
      }"""

fallback_replacement = """      if (fallbackFile && fs.existsSync(fallbackFile) && fs.statSync(fallbackFile).size > 1000) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-TTS-Cache', 'HIT_WOLOF_CANONICAL');
        const buf = fs.readFileSync(fallbackFile);
        return res.send(buf);
      }"""

assert target in code, "target not found"
assert fallback_target in code, "fallback_target not found"

code = code.replace(target, replacement)
code = code.replace(fallback_target, fallback_replacement)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("RAM buffer streaming enabled in server.js!")
