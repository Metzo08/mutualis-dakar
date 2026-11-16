import argparse
import sys
import shutil
import os
import re
import numpy as np
import soundfile as sf
from gradio_client import Client

def clean_for_speech(raw_text):
    t = str(raw_text or '')
    
    # 1. Supprimer Markdown et balises
    t = re.sub(r'\*\*(.*?)\*\*', r'\1', t)
    t = re.sub(r'\*(.*?)\*', r'\1', t)
    t = re.sub(r'#{1,6}\s*', '', t)
    t = re.sub(r'[\(\)\[\]\{\}]', ' ', t)
    
    # 2. Puces et numéros (remplacer par des virgules de pause)
    t = re.sub(r'^\s*\d+[\.\)]\s*', ', ', t, flags=re.MULTILINE)
    t = re.sub(r'^\s*[-•*]\s*', ', ', t, flags=re.MULTILINE)
    
    # 3. Remplacements et sigles essentiels
    t = re.sub(r'\bCSU\b', 'Couverture Santé Universelle', t)
    t = re.sub(r'\bUNAMUSC\b', 'UNAMUSC', t)
    t = re.sub(r'\bFCFA\b', 'francs CFA', t)
    t = re.sub(r'\bex:\s*', 'ci misaal ', t, flags=re.IGNORECASE)
    
    # 4. Supprimer emojis et caractères hors alphabet étendu
    t = re.sub(r'[^\w\s\.,!\?\'’àéèëñâôîûç-]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    
    # 5. Découper proprement à une fin de phrase si le texte dépasse la capacité maximale du modèle (500 car.)
    if len(t) > 480:
        sentences = re.split(r'([.!?]+)', t)
        accumulated = ''
        for i in range(0, len(sentences) - 1, 2):
            sentence = (sentences[i] + sentences[i + 1]).strip()
            if len(accumulated) + len(sentence) > 480 and len(accumulated) > 100:
                break
            accumulated += (' ' if accumulated else '') + sentence
        t = accumulated.strip() or t[:460]
        
    return t

def trim_and_anti_pop(audio_file):
    try:
        data, sr = sf.read(audio_file)
        if len(data) == 0:
            return
            
        # Détection du début et de la fin de parole réelle (seuil 0.008)
        # Supprime tout silence mort de fin de génération qui causait le "son comme du vide"
        threshold = 0.008
        non_silent = np.where(np.abs(data) > threshold)[0]
        if len(non_silent) > 0:
            start_idx = max(0, non_silent[0] - int(0.04 * sr))
            end_idx = min(len(data), non_silent[-1] + int(0.08 * sr))
            data = data[start_idx:end_idx]
            
        # Fondu d'entrée (15ms) et fondu de sortie doux (35ms) : zéro clic, zéro bruit résiduel
        fade_in_len = min(len(data), int(0.015 * sr))
        if fade_in_len > 0:
            data[:fade_in_len] *= np.linspace(0.0, 1.0, fade_in_len)
            
        fade_out_len = min(len(data), int(0.035 * sr))
        if fade_out_len > 0:
            data[-fade_out_len:] *= np.linspace(1.0, 0.0, fade_out_len)
            
        sf.write(audio_file, data, sr)
    except Exception as e:
        print(f"Warn trim_and_anti_pop: {e}", file=sys.stderr)

def synthesize(text, output_file):
    hf_token = os.environ.get('HUGGINGFACE_API_KEY', os.environ.get("HUGGINGFACE_API_KEY", ""))
    clean_text = clean_for_speech(text)
    
    if not clean_text:
        clean_text = "Nanga def, man la Zahara."
        
    try:
        client = Client('abdazizsall/wolof-pocket-tts-demo', headers={'Authorization': f'Bearer {hf_token}'})
        res = client.predict(
            text=clean_text,
            voice='Voice 1 (galsenai, female)',
            api_name='/synthesize'
        )
        if res and res[0] and os.path.exists(res[0]):
            shutil.copy(res[0], output_file)
            trim_and_anti_pop(output_file)
            print(f"OK: {os.path.getsize(output_file)} bytes for '{clean_text[:50]}...'")
            sys.exit(0)
        else:
            print("ERROR: No output audio file", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    synthesize(args.text, args.out)
