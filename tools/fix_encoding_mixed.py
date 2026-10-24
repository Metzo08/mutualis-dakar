# -*- coding: utf-8 -*-
"""Reparation mojibake MIXTE (fichier contenant des fragments valides ET
corrompus par double encodage).

Le texte originel UTF-8 a ete lu comme latin-1 puis re-enregistre : chaque
caractere multi-octets est devenu une sequence de caracteres U+0080..U+00FF.
La reparation re-decode ces sequences PAR FRAGMENT (paires C2..C5 +
continuation, triplets E2 80/82 + troisieme octet), independamment l'une de
l'autre : les accents dejA valides (isoles, hors sequence) sont preserves.

Seuil de surete : le fichier est re-ecrit seulement si le resultat ne
produit aucun U+FFFD.

Usage : python tools/fix_encoding_mixed.py <fichier...>
"""
import sys
import re

# U+00C2..U+00C5 suivi d'un caractere de continuation U+0080..U+00BF.
PAIR_RE = re.compile('[\u00C2\u00C3\u00C4\u00C5][\u0080-\u00BF]')
# U+00E2 suivi de U+2026 (ellipsis, seconde octet 0x80 lu comme telle) ou
# U+20AC (euro) : triplets E2 8x/9x du mojibake. Troisieme octet : tout
# caractere U+0080..U+00BF ou U+2122/U+201C/U+201D (versions lues larges).
TRIPLE_RE = re.compile(
    '[\u00E2][\u0080\u0081\u0082\u0084\u0099\u009A\u009C\u009D\u009E\u00A0\u20AC\u2019\u201C\u201D\u2122\u2039\u0152\u017E]'
    '[\u0080-\u00BF\u2122\u201C\u201D\u2019\u0153\u0178]'
)


def _fix(m):
    try:
        return m.group(0).encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return m.group(0)


def repair(text):
    prev = None
    cur = text
    rounds = 0
    while prev != cur and rounds < 10:
        prev = cur
        rounds += 1
        cur = TRIPLE_RE.sub(_fix, cur)
        cur = PAIR_RE.sub(_fix, cur)
    return cur


def main():
    for path in sys.argv[1:]:
        with open(path, 'r', encoding='utf-8', newline='') as fh:
            original = fh.read()
        bom = original.startswith('\ufeff')
        if bom:
            original = original[1:]
        if not (PAIR_RE.search(original) or TRIPLE_RE.search(original)):
            print('deja propre :', path)
            continue
        fixed = repair(original)
        restant = len(PAIR_RE.findall(fixed)) + len(TRIPLE_RE.findall(fixed))
        if '\ufffd' in fixed:
            print('ATTENTION U+FFFD produit (fichier NON modifie) :', path)
            continue
        with open(path, 'w', encoding='utf-8', newline='') as fh:
            fh.write(('\ufeff' if bom else '') + fixed)
        print('repare :', path, '- mojibake restant :', restant)
    return 0


if __name__ == '__main__':
    sys.exit(main())
