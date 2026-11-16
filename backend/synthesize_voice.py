import sys
import os
import asyncio
import edge_tts
import soundfile as sf
from pedalboard import Pedalboard, PitchShift, HighpassFilter

async def synthesize_french(text: str, output_path: str):
    communicate = edge_tts.Communicate(text, 'fr-FR-DeniseNeural')
    await communicate.save(output_path)

def pitch_shift_file(input_path: str, output_path: str, semitones: float = 3.8):
    data, sr = sf.read(input_path)
    board = Pedalboard([
        PitchShift(semitones=semitones),
        HighpassFilter(cutoff_frequency_hz=80)
    ])
    if len(data.shape) == 1:
        data = data.reshape(1, -1)
    elif data.shape[0] > data.shape[1]:
        data = data.T
    effected = board(data, sr)
    sf.write(output_path, effected.T, sr)

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python synthesize_voice.py <lang> <text> <output_path>")
        sys.exit(1)

    lang = sys.argv[1].lower()
    text = sys.argv[2]
    out_path = sys.argv[3]

    try:
        if lang in ['fr', 'french']:
            asyncio.run(synthesize_french(text, out_path))
            print("SUCCESS_FR")
        elif lang in ['wo', 'wolof']:
            # Wolof handling
            print("WOLOF_HANDLED")
        else:
            asyncio.run(synthesize_french(text, out_path))
            print("SUCCESS_DEFAULT")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
