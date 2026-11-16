with open('server.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update Wolof timeout and block DeniseNeural fallback for Wolof
target_str = "execFile('C:/Python313/python.exe', [\n              path.join(__dirname, 'synthesize_wolof.py'),\n              '--text', cleanText,\n              '--out', wolofNativeWav\n            ], { timeout: 25000 }"
replacement_str = "execFile('C:/Python313/python.exe', [\n              path.join(__dirname, 'synthesize_wolof.py'),\n              '--text', cleanText,\n              '--out', wolofNativeWav\n            ], { timeout: 45000 }"

if target_str in code:
    code = code.replace(target_str, replacement_str)
    print("Updated timeout to 45000ms")
else:
    print("timeout target not found directly")

# Block fallback for Wolof
catch_block = "        } catch (wolofErr) {\n          console.warn('[Native Wolof Female TTS] Erreur :', wolofErr.message);\n        }\n      }"
new_catch_block = "        } catch (wolofErr) {\n          console.warn('[Native Wolof Female TTS] Erreur :', wolofErr.message);\n        }\n        return res.status(503).json({ error: 'Synthèse vocale Wolof temporairement indisponible.' });\n      }"

if catch_block in code:
    code = code.replace(catch_block, new_catch_block)
    print("Blocked French fallback for Wolof")
else:
    print("catch block not found")

# Groq prompt update
old_groq = "STYLE CONVERSATIONNEL NATUREL : Fais des phrases courtes, fluides et chaleureuses (2 à 3 phrases claires max)."
new_groq = "STYLE CONVERSATIONNEL NATUREL : Fais des réponses très courtes, fluides et directes (1 à 2 phrases claires, maximum 25 à 35 mots). Évite les listes à puces."

if old_groq in code:
    code = code.replace(old_groq, new_groq)
    print("Updated Groq style instruction")

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("server.js updated successfully!")
