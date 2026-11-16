"""Serveur TTS Neuronal Persistant pour MUTUALIS DAKAR (Zahara).
Tourne en permanence en tâche de fond sur le port 5005.
- Wolof : Cache WAV natif Oolel-Voices/Daande (< 20 ms), puis normalisation
  wolof_normalizer + Wakhalog Oolel-Voices -> Daande XTTS-v2 -> DeniseNeural (FR monolingue, zéro anglais).
- Français : Edge-TTS fr-FR-DeniseNeural (voix féminine claire et naturelle).
"""
import asyncio
import hashlib
import io
import os
import shutil
import threading
import time
from aiohttp import web
from dotenv import load_dotenv
import edge_tts
from wolof_normalizer import normaliser

load_dotenv()
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")

PORT = int(os.environ.get("TTS_PORT", 5005))
BASE_DIR = os.path.dirname(__file__)
CACHE_DIR = os.path.join(BASE_DIR, "data", "tts_cache")
REF_WAV = os.path.join(BASE_DIR, "voix_ref_test.wav")
os.makedirs(CACHE_DIR, exist_ok=True)

VOICE_FRENCH = "fr-FR-DeniseNeural"
VOICE_ENGLISH = "en-US-JennyNeural"
# Wolof Pocket-TTS CPU Space (illimité, voix féminine sénégalaise galsenai) - JAMAIS de voix française pour le Wolof !
WOLOF_POCKET_SPACE = "abdazizsall/wolof-pocket-tts-demo"
WOLOF_POCKET_VOICE = "Voice 1 (galsenai, female)"

_wakhalog_client = None
_wakhalog_cooldown_until = 0.0
_pocket_client = None
_daande_client = None

# Modèle ASR natif Wolof local (soynade-research/Wolof-HuBERT-CTC quantifié INT8)
HUBERT_MODEL_ID = "soynade-research/Wolof-HuBERT-CTC"
_hubert_proc = None
_hubert_model = None
_hubert_lock = threading.Lock()
_hubert_loading = False


def _ensure_hubert_loaded():
    global _hubert_proc, _hubert_model, _hubert_loading
    if _hubert_model is not None:
        return True
    with _hubert_lock:
        if _hubert_model is not None:
            return True
        try:
            _hubert_loading = True
            t0 = time.time()
            import torch
            from transformers import AutoProcessor, AutoModelForCTC
            torch.set_num_threads(min(4, os.cpu_count() or 4))
            proc = AutoProcessor.from_pretrained(HUBERT_MODEL_ID, local_files_only=True)
            mdl = AutoModelForCTC.from_pretrained(HUBERT_MODEL_ID, local_files_only=True)
            mdl.eval()
            qmdl = torch.ao.quantization.quantize_dynamic(mdl, {torch.nn.Linear}, dtype=torch.qint8)
            _hubert_proc = proc
            _hubert_model = qmdl
            print(f"[ASR 5005] Wolof-HuBERT-CTC INT8 prêt en RAM ({time.time() - t0:.2f}s)", flush=True)
            return True
        except Exception as e:
            print(f"[ASR 5005] Erreur chargement Wolof-HuBERT-CTC : {e}", flush=True)
            return False
        finally:
            _hubert_loading = False


def _transcribe_wolof_hubert_sync(audio_bytes: bytes):
    if not _ensure_hubert_loaded():
        return ""
    import numpy as np
    import soundfile as sf
    import torch
    from math import gcd
    from scipy.signal import resample_poly

    audio, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)
    if len(audio) < 1600:
        return ""
    if sr != 16000:
        g = gcd(16000, sr)
        audio = resample_poly(audio, 16000 // g, sr // g).astype(np.float32)

    inputs = _hubert_proc(audio, sampling_rate=16000, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = _hubert_model(**inputs).logits
    pred_ids = torch.argmax(logits, dim=-1)
    return (_hubert_proc.batch_decode(pred_ids)[0] or "").strip()


def _find_cached_audio(clean_text: str, lang_mode: str):
    keys = []
    low = clean_text.lower()
    if lang_mode == "wo":
        norm = normaliser(clean_text).lower()
        keys.append(f"wo_{low}")
        keys.append(f"wo_norm_{norm}")
    elif lang_mode == "en":
        keys.append(f"{VOICE_ENGLISH}_{low}")
    else:
        keys.append(f"{VOICE_FRENCH}_{low}")

    for k in keys:
        h = hashlib.md5(k.encode("utf-8")).hexdigest()
        wav_p = os.path.join(CACHE_DIR, f"{h}.wav")
        if os.path.exists(wav_p) and os.path.getsize(wav_p) > 1000:
            return wav_p, "audio/wav"
        mp3_p = os.path.join(CACHE_DIR, f"{h}.mp3")
        if os.path.exists(mp3_p) and os.path.getsize(mp3_p) > 1000:
            return mp3_p, "audio/mpeg"
    return None, None


def _synth_wolof_gradio_sync(norm_text: str):
    global _pocket_client
    from gradio_client import Client

    # Voix unique unifiée : Pocket-TTS Wolof féminine sénégalaise (galsenai, cpu-basic illimité)
    # Garantit une seule voix féminine 100% cohérente sur tout le site (aucun mélange de deux voix, zéro accent français).
    try:
        if _pocket_client is None:
            _pocket_client = Client(WOLOF_POCKET_SPACE, token=HF_TOKEN, verbose=False) if HF_TOKEN else Client(WOLOF_POCKET_SPACE, verbose=False)
        pocket_text = norm_text[:480]
        if len(norm_text) > 480:
            cut = max(pocket_text.rfind('. '), pocket_text.rfind('! '), pocket_text.rfind('? '))
            if cut > 180:
                pocket_text = pocket_text[:cut + 1]
        res = _pocket_client.predict(
            text=pocket_text,
            voice=WOLOF_POCKET_VOICE,
            api_name="/synthesize",
        )
        wav_out = res[0] if isinstance(res, (list, tuple)) else res
        if wav_out and os.path.exists(wav_out):
            with open(wav_out, "rb") as f:
                return f.read(), "audio/wav", "POCKET_TTS_WOLOF_GALSENAI"
    except Exception as e:
        print(f"[TTS 5005] Pocket-TTS Wolof repli: {e}", flush=True)
        _pocket_client = None

    # Note: Daande (XTTS-v2) volontairement désactivé car il introduit un accent européen/français sur le Wolof.
    return None, None, None


async def handle_tts(request):
    try:
        data = await request.json() if request.can_read_body else {}
    except Exception:
        data = {}

    text = request.query.get("text") or data.get("text", "")
    lang = request.query.get("lang") or data.get("lang", "fr")
    rate = request.query.get("rate") or data.get("rate", "-3%")

    if not text or not text.strip():
        return web.json_response({"error": "Texte requis"}, status=400)

    clean_text = text.strip()
    is_wolof = lang in ("wo", "wolof")
    is_english = lang in ("en", "english")
    lang_mode = "wo" if is_wolof else ("en" if is_english else "fr")

    # 0. Cache disque instantané (WAV natif ou MP3)
    cached_path, cached_mime = _find_cached_audio(clean_text, lang_mode)
    if cached_path:
        with open(cached_path, "rb") as f:
            audio_bytes = f.read()
        return web.Response(
            body=audio_bytes,
            content_type=cached_mime,
            headers={"X-TTS-Cache": "HIT"},
        )

    # 1. Synthèse Wolof native (Pocket-TTS galsenai female après normalisation stricte)
    if is_wolof:
        norm_wolof = normaliser(clean_text)
        loop = asyncio.get_running_loop()
        audio_bytes, mime, tag = await loop.run_in_executor(
            None, _synth_wolof_gradio_sync, norm_wolof
        )
        if audio_bytes and len(audio_bytes) > 1000:
            h_raw = hashlib.md5(f"wo_{clean_text.lower()}".encode("utf-8")).hexdigest()
            h_norm = hashlib.md5(f"wo_norm_{norm_wolof.lower()}".encode("utf-8")).hexdigest()
            for h in (h_raw, h_norm):
                try:
                    with open(os.path.join(CACHE_DIR, f"{h}.wav"), "wb") as f:
                        f.write(audio_bytes)
                except Exception:
                    pass
            return web.Response(
                body=audio_bytes,
                content_type=mime,
                headers={"X-TTS-Cache": tag},
            )

        # INTERDICTION ABSOLUE de lire du Wolof avec une voix française Edge-TTS !
        return web.json_response(
            {"error": "Synthèse Wolof native temporairement indisponible"},
            status=503,
        )
    elif is_english:
        tts_input = clean_text
        voice = VOICE_ENGLISH
    else:
        tts_input = clean_text
        voice = VOICE_FRENCH

    # 2. Synthèse Edge-TTS monolingue (fr-FR-DeniseNeural ou en-US-JennyNeural)
    try:
        communicate = edge_tts.Communicate(tts_input, voice, rate=rate)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        audio_bytes = b"".join(chunks)
        if len(audio_bytes) > 500:
            if not is_wolof:
                h = hashlib.md5(f"{voice}_{clean_text.lower()}".encode("utf-8")).hexdigest()
                try:
                    with open(os.path.join(CACHE_DIR, f"{h}.mp3"), "wb") as f:
                        f.write(audio_bytes)
                except Exception:
                    pass
            return web.Response(
                body=audio_bytes,
                content_type="audio/mpeg",
                headers={"X-TTS-Cache": "DYNAMIC_JENNY_EN" if is_english else "DYNAMIC_DENISE"},
            )
    except Exception as err:
        print(f"[TTS Server Error] : {err}")

    return web.json_response({"error": "Synthese vocale indisponible"}, status=500)


async def handle_asr(request):
    try:
        audio_bytes = await request.read()
        if not audio_bytes or len(audio_bytes) < 1000:
            return web.json_response({"text": "", "ms": 0})
        t0 = time.time()
        loop = asyncio.get_running_loop()
        text = await loop.run_in_executor(None, _transcribe_wolof_hubert_sync, audio_bytes)
        ms = round((time.time() - t0) * 1000)
        print(f"[ASR 5005 HuBERT Wolof] ({ms}ms): \"{text}\"", flush=True)
        return web.json_response({"text": text, "ms": ms})
    except Exception as e:
        print(f"[ASR 5005 Error] {e}", flush=True)
        return web.json_response({"text": "", "error": str(e)}, status=200)


async def handle_health(request):
    return web.json_response({
        "status": "ok",
        "service": "neural-tts-asr",
        "port": PORT,
        "hubert_ready": _hubert_model is not None,
    })


def create_app():
    app = web.Application(client_max_size=10 * 1024 * 1024)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/tts", handle_tts)
    app.router.add_post("/tts", handle_tts)
    app.router.add_post("/asr", handle_asr)
    return app


if __name__ == "__main__":
    print(f"[TTS+ASR Server] Demarrage sur le port {PORT} (prechargement Wolof-HuBERT-CTC)...", flush=True)
    threading.Thread(target=_ensure_hubert_loaded, daemon=True).start()
    web.run_app(create_app(), host="127.0.0.1", port=PORT, print=None)
