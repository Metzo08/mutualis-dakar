# -*- coding: utf-8 -*-
"""Reparation globale du mojibake (double encodage UTF-8) fichier par fichier.

Contrairement a tools/check_encoding.py (ligne par ligne, refuse les lignes
melangees), ce script decode le FICHIER ENTIER de facon iterative :
  mojibake = utf8_originel lu comme latin-1 puis re-enregistre en utf-8.
Le decodage inverse (latin-1 -> utf-8) est applique autant de fois que
necessaire. Seuil de surete : le resultat final ne doit contenir NI U+FFFD
NI la marque de mojibake ; sinon le fichier est laisse intact.

Usage : python tools/fix_encoding_full.py <fichier...>
"""
import sys
import re

MOJIBAKE_RE = re.compile(
    '[\u00C2\u00C3\u00C4\u00C5][\u0080-\u00BF]'
    '|\u00E2\u20AC'
    '|\uFFFD'
)


def repair(text):
    for _ in range(5):
        if not MOJIBAKE_RE.search(text):
            return text
        if any(ord(c) > 255 for c in text):
            return None  # melange irreparable automatiquement
        try:
            text = text.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            return None
    return None


def main():
    ok = True
    for path in sys.argv[1:]:
        with open(path, 'r', encoding='utf-8', newline='') as fh:
            original = fh.read()
        if not MOJIBAKE_RE.search(original):
            print('deja propre :', path)
            continue
        # Preserve les fins de ligne : le decodage latin-1 ne les touche pas.
        fixed = repair(original)
        if fixed is None:
            print('NON REPARABLE (melange), intact :', path)
            ok = False
            continue
        with open(path, 'w', encoding='utf-8', newline='') as fh:
            fh.write(fixed)
        restant = len(MOJIBAKE_RE.findall(fixed))
        print('repare :', path, '— mojibake restant :', restant)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
