"""Normaliseur linguistique Wolof avant synthèse vocale (MUTUALIS DAKAR).

Adapté de Wakhalog TTS (Oolel-Voices) et enrichi pour le domaine CSU UNAMUSC :
- Montants en francs CFA (4500 F CFA, 4 500 FCFA, 4500 francs CFA, etc.) -> mots wolof exacts
- Pourcentages (100%, 80%, 50%) -> mots wolof exacts (téeméer ci téeméer, juróom-ñett-fukk ci téeméer...)
- Dates (jj/mm/aaaa) -> dates parlées
- Sigles & marques (CSU, UNAMUSC, Wave, Orange Money) -> prononciation naturelle sans bascule anglaise
"""
import re

LEXIQUE = {
    "unites": {
        0: "zeero",
        1: "benn",
        2: "ñaar",
        3: "ñett",
        4: "ñeent",
        5: "juróom",
        6: "juróom-benn",
        7: "juróom-ñaar",
        8: "juróom-ñett",
        9: "juróom-ñeent",
    },
    "multiplicatifs": {
        1: "",
        2: "ñaari",
        3: "ñetti",
        4: "ñeenti",
        5: "juróomi",
        6: "juróom-benni",
        7: "juróom-ñaari",
        8: "juróom-ñetti",
        9: "juróom-ñeenti",
    },
    "dix": "fukk",
    "cent": "téeméer",
    "mille": "junni",
    "million": "tamndareet",
    "et": "ak",
    "mois": {
        1: "sanwiye", 2: "feewriye", 3: "mars", 4: "awril",
        5: "mee", 6: "suwe", 7: "sulet", 8: "ut",
        9: "septàmbar", 10: "oktoobar", 11: "nowàmbar", 12: "desàmbar",
    },
    "franc": "faràn seefa",
}


def nombre_en_mots(n: int) -> str:
    if n < 0:
        return f"mwen {nombre_en_mots(-n)}"
    u = LEXIQUE["unites"]
    m = LEXIQUE["multiplicatifs"]

    if n < 10:
        return u[n]

    if n < 100:
        dizaines, reste = divmod(n, 10)
        tete = LEXIQUE["dix"] if dizaines == 1 else f"{u[dizaines]}-{LEXIQUE['dix']}"
        return tete if reste == 0 else f"{tete} {LEXIQUE['et']} {nombre_en_mots(reste)}"

    if n < 1000:
        centaines, reste = divmod(n, 100)
        tete = LEXIQUE["cent"] if centaines == 1 else f"{m[centaines]} {LEXIQUE['cent']}"
        return tete if reste == 0 else f"{tete} {LEXIQUE['et']} {nombre_en_mots(reste)}"

    if n < 1_000_000:
        milliers, reste = divmod(n, 1000)
        tete = (
            LEXIQUE["mille"]
            if milliers == 1
            else f"{m[milliers]} {LEXIQUE['mille']}" if milliers < 10
            else f"{nombre_en_mots(milliers)} {LEXIQUE['mille']}"
        )
        return tete if reste == 0 else f"{tete} {LEXIQUE['et']} {nombre_en_mots(reste)}"

    millions, reste = divmod(n, 1_000_000)
    tete = (
        LEXIQUE["million"]
        if millions == 1
        else f"{nombre_en_mots(millions)} {LEXIQUE['million']}"
    )
    return tete if reste == 0 else f"{tete} {LEXIQUE['et']} {nombre_en_mots(reste)}"


def chiffres_epeles(suite: str) -> str:
    u = LEXIQUE["unites"]
    sortie = []
    for c in suite:
        if c.isdigit():
            sortie.append(u[int(c)])
        elif c.isalpha():
            sortie.append(c)
    return " ".join(sortie)


def date_en_mots(jour: int, mois: int, annee: int) -> str:
    nom_mois = LEXIQUE["mois"].get(mois)
    if nom_mois is None:
        return f"{nombre_en_mots(jour)} {nombre_en_mots(mois)} {nombre_en_mots(annee)}"
    return f"{nombre_en_mots(jour)} {nom_mois} {nombre_en_mots(annee)}"


_REFERENCE = re.compile(r"\b([A-Z]{2,}[-/]?\d[\dA-Z]*(?:[-/.]\d[\dA-Z]*)*)\b")
_DATE = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b")
_POURCENT = re.compile(r"\b(\d{1,3})\s*%")
# Gère 4500 FCFA, 4 500 F CFA, 4500 francs CFA, 4 500 francs, 4500F
_MONTANT = re.compile(
    r"\b(\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)\s*(?:francs?\s*CFA|F\s*CFA|FCFA|francs?|F)\b",
    re.IGNORECASE,
)
_HEURE = re.compile(r"\b(\d{1,2})h(\d{2})?\b", re.IGNORECASE)
_NOMBRE = re.compile(r"\b\d{1,3}(?:[\s\u00a0\u202f]\d{3})+\b|\b\d+\b")

_LEXIQUE_METIER = [
    (re.compile(r"\bMUTUALIS\s+DAKAR\b", re.IGNORECASE), "Mutuwalis Ndakaaru"),
    (re.compile(r"\bUNAMUSC\b", re.IGNORECASE), "Ounamousk"),
    (re.compile(r"\bCSU\b", re.IGNORECASE), "Sé És U"),
    (re.compile(r"\bCMU\b", re.IGNORECASE), "Sé Em U"),
    (re.compile(r"\bCPN\b", re.IGNORECASE), "seetlu jiggéen juy jur"),
    (re.compile(r"\bPEV\b", re.IGNORECASE), "ñakk liir yi"),
    (re.compile(r"\bQR\s*Code\b", re.IGNORECASE), "kod kiyèr"),
    (re.compile(r"\bOrange\s+Money\b", re.IGNORECASE), "Oraas Moni"),
    (re.compile(r"\bWave\b", re.IGNORECASE), "Weew"),
    (re.compile(r"\bFormule\s+Individuelle\b", re.IGNORECASE), "Bokk bu kenn"),
    (re.compile(r"\bFormule\s+Familiale\b", re.IGNORECASE), "Bokk bu njaboot"),
    (re.compile(r"\bCouverture\s+Santé\s+Universelle\b", re.IGNORECASE), "kàttanu wér-gi-yaram"),
    (re.compile(r"\bLettre\s+de\s+garantie(?:\s+hospitalière)?\b", re.IGNORECASE), "kayitu fajukaay"),
    (re.compile(r"\bBons?\s+de\s+commande(?:\s+pharmacie)?\b", re.IGNORECASE), "kayitu garab"),
    (re.compile(r"\bHôpital\s+Principal\b", re.IGNORECASE), "Opitaal Pirinsipal"),
    (re.compile(r"\bCHU\s+Fann\b", re.IGNORECASE), "Opitaal Faan"),
    (re.compile(r"\b(?:Hôpital\s+Aristide\s+)?Le\s+Dantec\b", re.IGNORECASE), "Opitaal Dantek"),
    (re.compile(r"\b(?:CHU\s+)?Abass\s+Ndao\b", re.IGNORECASE), "Opitaal Abaas Ndaw"),
    (re.compile(r"\bDalal\s+Jamm\b", re.IGNORECASE), "Opitaal Dalal Jàmm"),
    (re.compile(r"\bTélémédecine(?:\s+WebRTC)?\b", re.IGNORECASE), "waxtaan ak doktoor ci wideo"),
    (re.compile(r"\bServices\s+en\s+ligne\b", re.IGNORECASE), "liggéey ci internet bi"),
    (re.compile(r"\bNouvelle\s+adhésion\b", re.IGNORECASE), "bindu gu bees"),
    (re.compile(r"\bZahara\b", re.IGNORECASE), "Saara"),
]

_SEPARATEURS = {
    "/": " ",
    "\\": " ",
    "|": " ",
    "_": " ",
    "*": " ",
    "#": " ",
    "~": " ",
    "<": " ",
    ">": " ",
    "=": " ",
    "+": " ",
    "(": " ",
    ")": " ",
    "[": " ",
    "]": " ",
}


def _entier(brut: str) -> int:
    return int(re.sub(r"[^\d]", "", brut))


def normaliser(texte: str) -> str:
    """Réécrit montants, pourcentages, dates, sigles et chiffres en pur Wolof parlé."""
    if not texte:
        return ""

    sortie = str(texte).replace("\u00a0", " ").replace("\u202f", " ")
    # Supprime emojis
    sortie = re.sub(r"[\U00010000-\U0010ffff]", "", sortie)

    for pat, rep in _LEXIQUE_METIER:
        sortie = pat.sub(rep, sortie)

    sortie = _REFERENCE.sub(lambda m: chiffres_epeles(m.group(1)), sortie)

    def _date(m):
        jour, mois, annee = (int(g) for g in m.groups())
        if not (1 <= jour <= 31 and 1 <= mois <= 12):
            return m.group(0)
        return date_en_mots(jour, mois, annee)

    sortie = _DATE.sub(_date, sortie)
    sortie = _POURCENT.sub(lambda m: f"{nombre_en_mots(int(m.group(1)))} ci téeméer", sortie)
    sortie = _MONTANT.sub(lambda m: f"{nombre_en_mots(_entier(m.group(1)))} {LEXIQUE['franc']}", sortie)
    sortie = _HEURE.sub(
        lambda m: f"{nombre_en_mots(int(m.group(1)))} waxtu" + (f" ak {nombre_en_mots(int(m.group(2)))} simili" if m.group(2) else ""),
        sortie,
    )
    sortie = _NOMBRE.sub(lambda m: nombre_en_mots(_entier(m.group(0))), sortie)

    for brut, remp in _SEPARATEURS.items():
        sortie = sortie.replace(brut, remp)

    return re.sub(r"\s{2,}", " ", sortie).strip()
