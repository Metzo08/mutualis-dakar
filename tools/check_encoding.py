# -*- coding: utf-8 -*-
"""Detecte (et repare) le mojibake du code source : double encodage UTF-8.

Un texte UTF-8 valide a parfois ete re-encode en latin-1 : "é" (C3 A9) devient
la paire de caracteres U+00C3 U+00A9. Dans un fichier UTF-8 correct,
U+00C2..U+00C5 n'apparaissent jamais seuls en francais ; suivis d'un caractere
de continuation (U+0080..U+00BF), ils trahissent le double encodage.

Usage :
  python tools/check_encoding.py           # scan, rapport seul
  python tools/check_encoding.py --fix     # repare puis rescanne

La reparation est appliquee LIGNE PAR LIGNE et uniquement aux lignes
entierement corrompues ; une ligne melangeant accents valides et mojibake est
signalee pour correction manuelle (reparation non sure). Ecriture UTF-8 sans
BOM, sans modification du saut de ligne d'origine.
"""
import os
import re
import sys

EXTS = {'.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md', '.py', '.sql'}
SKIP_DIRS = {'node_modules', '.git', 'dist', 'build', '.vite', '__pycache__',
             '.opencode', 'coverage'}

# C2..C5 suivi d'un octet continuation ; "â‚¬" (euro double-encode) ; U+FFFD.
MOJIBAKE_RE = re.compile(
    '[\u00C2\u00C3\u00C4\u00C5][\u0080-\u00BF]'
    '|\u00E2\u20AC'
    '|\uFFFD'
)


def iter_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if os.path.splitext(name)[1].lower() in EXTS:
                yield os.path.join(dirpath, name)


def repair_line(line):
    """Retourne la ligne reparee, None si non repareable, '' si deja propre."""
    if not MOJIBAKE_RE.search(line):
        return ''
    current = line
    for _ in range(3):  # au plus 3 niveaux de double encodage
        if any(ord(c) > 255 for c in current):
            return None  # melange accents valides + mojibake : reparer a la main
        try:
            current = current.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            return None
        if not MOJIBAKE_RE.search(current):
            return current
    return None


def main():
    fix = '--fix' in sys.argv
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    report = []
    for path in iter_files(root):
        rel = os.path.relpath(path, root)
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                original = fh.read()
        except (UnicodeDecodeError, OSError):
            print('Lecture impossible (octets invalides) :', rel)
            continue
        if not MOJIBAKE_RE.search(original):
            continue
        if not fix:
            hits = sum(len(MOJIBAKE_RE.findall(ln))
                       for ln in original.splitlines())
            report.append((rel, hits, 'SCAN'))
            continue
        nl = '\r\n' if '\r\n' in original else '\n'
        lines = original.splitlines()
        fixed_lines, n_fixed, n_manual = [], 0, 0
        for line in lines:
            fixed = repair_line(line)
            if fixed == '':
                fixed_lines.append(line)
            elif fixed is None:
                fixed_lines.append(line)
                n_manual += 1
            else:
                fixed_lines.append(fixed)
                n_fixed += 1
        if n_fixed:
            with open(path, 'w', encoding='utf-8', newline='') as fh:
                fh.write(nl.join(fixed_lines) + nl if original.endswith(nl) else nl.join(fixed_lines))
        still = sum(len(MOJIBAKE_RE.findall(ln)) for ln in fixed_lines)
        report.append((rel, still, 'REPARE %d | MANUEL %d' % (n_fixed, n_manual)))

    if not report:
        print('AUCUN mojibake detecte.')
        return 0
    print('%-60s %8s  %s' % ('FICHIER', 'RESTE', 'ACTION'))
    for rel, hits, action in report:
        print('%-60s %8d  %s' % (rel, hits, action))
    manual = sum(1 for _, _, a in report if 'MANUEL' in a and not a.startswith('REPARE 0 |') and a.split('MANUEL ')[1] != '0')
    print('Total fichiers suspects :', len(report))
    if not fix:
        print('Relancez avec --fix pour reparer.')
    elif manual:
        print('Fichiers demandant une correction manuelle :', manual)
    return 0


if __name__ == '__main__':
    sys.exit(main())
