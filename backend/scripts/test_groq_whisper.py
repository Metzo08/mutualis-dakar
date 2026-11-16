import urllib.request
import json
import os

groq_key = ''
with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GROQ_API_KEY='):
            groq_key = line.strip().split('=', 1)[1]

print('Testing Groq Whisper with key:', groq_key[:6] + '...')

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
audio_path = r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\data\female_wolof_sample.wav'
with open(audio_path, 'rb') as f:
    audio_data = f.read()

body = bytearray()
body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n'.encode('utf-8'))
body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nTranscription bilingue wolof et français au Sénégal (nanga def, jamm rekk, CSU, cotisation, wér-gi-yaram)\r\n'.encode('utf-8'))
body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode('utf-8'))
body.extend(audio_data)
body.extend(b'\r\n')
body.extend(f'--{boundary}--\r\n'.encode('utf-8'))

req = urllib.request.Request(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    data=bytes(body),
    headers={
        'Authorization': f'Bearer {groq_key}',
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
)

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print('SUCCESS! Groq Whisper transcribed:', res)
except Exception as e:
    print('Groq Whisper error:', e)
