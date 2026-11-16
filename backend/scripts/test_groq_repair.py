import urllib.request
import json
import time

groq_key = ''
with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GROQ_API_KEY='):
            groq_key = line.strip().split('=', 1)[1]

system_prompt = """Tu es un expert linguiste bilingue Wolof/Français au Sénégal.
Un utilisateur a parlé au microphone d'un smartphone à Dakar.
La reconnaissance vocale de Google Chrome (qui n'a qu'un modèle français) a transcrit ce qu'elle a cru entendre en français.
Exemples réels :
- "non pas de natte à la cotisation" -> Wolof: "Nanga def, ñaata la cotisation bi ?"
- "j'irai jef" -> Wolof: "Jërejëf"
- "dame à beugue wax" -> Wolof: "Dama bëgg wax"
- "men n'a am ordonnance" -> Wolof: "Mën naa am ordonnance"
- "garde bille pharmacie" -> Wolof: "Garab yi ci pharmacie bi"
- "quel est le prix de la cotisation" -> Français: "Quel est le prix de la cotisation"

Tâche : Détermine si l'utilisateur a parlé en WOLOF (phonétique transcrite) ou en FRANÇAIS.
Réponds STRICTEMENT sous format JSON seul :
{"lang": "wo", "text": "phrase wolof reconstruite"} ou {"lang": "fr", "text": "phrase française originale"}"""

samples = [
    "non pas de natte à la cotisation",
    "garde bille pharmacie",
    "bonjour comment vous allez",
    "dame à beugue xam cotisation",
    "quel est le taux de prise en charge hospitalière"
]

for sample in samples:
    t0 = time.time()
    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        data=json.dumps({
            'model': 'openai/gpt-oss-120b',
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': sample}
            ],
            'temperature': 0.1,
            'response_format': {'type': 'json_object'}
        }).encode('utf-8'),
        headers={'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'}
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print(f'Input: "{sample}" -> Output in {time.time()-t0:.2f}s:')
        print(res['choices'][0]['message']['content'])
