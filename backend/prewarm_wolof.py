import os
import sys
import hashlib
import subprocess

tts_cache_dir = os.path.join(os.path.dirname(__file__), 'data', 'tts_cache')
os.makedirs(tts_cache_dir, exist_ok=True)

# Phrases types standardisées pour réponse immédiate (0 ms)
prewarm_items = [
    # Salutations
    "Ngoon ak jàmm ! Man la Zahara, sa ndaw ci MUTUALIS DAKAR. 😊 Naka ngoon gi ? Jàmm rekk, alxandulillaah ? Tey, ci sa wér-gi-yaram ak sa mutuelle, lan laa la mënee dimbali ?",
    "Ngoon ak jàmm ! Man la Zahara, sa ndaw ci MUTUALIS DAKAR. Naka ngoon gi ? Lan laa la mënee dimbali ci sa wér-gi-yaram ak sa mutuelle ?",
    "Suba ak jàmm ! Man la Zahara, sa ndaw ci MUTUALIS DAKAR. Naka suba si ? Lan laa la mënee dimbali ci sa wér-gi-yaram ak sa mutuelle ?",
    # CSU
    "CSU mooy Couverture Santé Universelle bu UNAMUSC ci Ndakaaru ! Dafa lay may Tiers-Payant ngir faju ci lu yomb : 4 500 FCFA ci at mi, 80% ba 100% ci hôpitaux yi, 50% ci garab yi pharmacie, ak 100% gratuité maternité.",
    "CSU mooy Couverture Santé Universelle bu UNAMUSC : Tiers-Payant bu lay may nga faju ci 4 500 FCFA rekk ci at mi, 80% ba 100% ci lopitaal ak 50% ci garab yi. Lan nga bëgg ci yeneen leeral ? 😊",
    # Cotisation
    "Cotisation bi 4 500 FCFA la ci at mi ngir kenn ku nekk, walla 1 000 FCFA ci kart bi ak 3 500 FCFA ci njaboot gi. Mën nga fay ci Wave walla Orange Money.",
    # Maternite
    "Programme Gratuité Maternité & BSF bi dafa gratuit 100% ci UNAMUSC ! Lépp lu jëm ci consultation prénatale, kit d'accouchement, fer, acide folique ak vaccins yépp mën nga ko am ci 0 FCFA."
]

def get_hash(text):
    clean = text.strip()
    return hashlib.md5(('wo_' + clean.lower()).encode('utf-8')).hexdigest()

python_bin = 'C:/Python313/python.exe'
synthesize_script = os.path.join(os.path.dirname(__file__), 'synthesize_wolof.py')

for text in prewarm_items:
    h = get_hash(text)
    out_file = os.path.join(tts_cache_dir, f'wolof_galsen_{h}.wav')
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        print(f"[ALREADY CACHED] {h} -> {text[:45]}...")
        continue
    
    print(f"\n[SYNTHESIZING] {h} -> {text[:45]}...")
    try:
        res = subprocess.run([python_bin, synthesize_script, '--text', text, '--out', out_file], capture_output=True, text=True, timeout=60)
        if res.returncode == 0 and os.path.exists(out_file):
            print(f"[SUCCESS] Cached {os.path.getsize(out_file)} bytes")
        else:
            print(f"[ERROR] {res.stderr}")
    except Exception as e:
        print(f"[EXCEPTION] {e}")

print("\nPre-warm complete!")
