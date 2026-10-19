# -*- coding: utf-8 -*-
"""Génère la Bible de la plateforme MUTUALIS / Portail CSU au format Word (.docx).
Contenu strictement conforme aux fonctionnalités réelles documentées
(docs/business-rules/BUSINESS_RULES.md, docs/database/DATA_MODEL.md,
docs/security/SECURITY_RULES.md, docs/architecture/DECISIONS.md).
"""
import os
import docx
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BLEU = RGBColor(0x1F, 0x4E, 0x79)
GRIS = RGBColor(0x40, 0x40, 0x40)

doc = Document()

# ---- Styles de base ----
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)
style.paragraph_format.space_after = Pt(6)

for name, size in [('Heading 1', 18), ('Heading 2', 14), ('Heading 3', 12)]:
    h = doc.styles[name]
    h.font.name = 'Calibri'
    h.font.size = Pt(size)
    h.font.bold = True
    h.font.color.rgb = BLEU

# ---- Marges ----
for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)

def para(text, bold=False, italic=False, size=11, color=None, align=None):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    if align:
        p.alignment = align
    return p

def bullet(text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    if bold_prefix:
        r = p.add_run(bold_prefix)
        r.bold = True
        p.add_run(text)
    else:
        p.add_run(text)
    return p

def numbered(text, bold_prefix=None):
    p = doc.add_paragraph(style='List Number')
    if bold_prefix:
        r = p.add_run(bold_prefix)
        r.bold = True
        p.add_run(text)
    else:
        p.add_run(text)
    return p

def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:fill'), hexcolor)
    tcPr.append(shd)

def table(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ''
        p = hdr[i].paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        shade(hdr[i], '1F4E79')
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ''
            r = cells[i].paragraphs[0].add_run(str(val))
            r.font.size = Pt(10)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Cm(w)
    doc.add_paragraph()
    return t

# ================= PAGE DE GARDE =================
# Logo de Sen-E-Carte, start-up conceptrice de la plateforme MUTUALIS.
# Logo officiel Sen-E-Carte (téléphone + stéthoscope), avec repli sur le logo
# de l'Agence SEN-CSU si le fichier n'est pas présent.
LOGO = os.path.join('public', 'logo_sen_ecarte.png')
if not os.path.exists(LOGO):
    LOGO = os.path.join('public', 'logo_csu_official.png')
if os.path.exists(LOGO):
    _p = doc.add_paragraph()
    _p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _p.add_run().add_picture(LOGO, width=Cm(5))
else:
    for _ in range(3):
        doc.add_paragraph()
for _ in range(3):
    doc.add_paragraph()
para('MUTUALIS', bold=True, size=36, color=BLEU, align=WD_ALIGN_PARAGRAPH.CENTER)
para('Portail CSU Sénégal', bold=True, size=22, color=GRIS, align=WD_ALIGN_PARAGRAPH.CENTER)
para('Plateforme conçue par Sen-E-Carte', bold=True, size=12, color=GRIS,
     align=WD_ALIGN_PARAGRAPH.CENTER)
doc.add_paragraph()
para('BIBLE DE LA PLATEFORME', bold=True, size=20, align=WD_ALIGN_PARAGRAPH.CENTER)
para('Guide officiel des Mutuelles de Santé Communautaires (MSD)', size=13,
     italic=True, align=WD_ALIGN_PARAGRAPH.CENTER)
for _ in range(5):
    doc.add_paragraph()
para('Adhésion MSD : 150 000 FCFA — accès complet à la plateforme', bold=True, size=13,
     align=WD_ALIGN_PARAGRAPH.CENTER)
para('Carte CMU (Sen-E-Carte) : 350 FCFA par carte réellement imprimée', bold=True, size=13,
     align=WD_ALIGN_PARAGRAPH.CENTER)
doc.add_page_break()

# ================= SOMMAIRE =================
doc.add_heading('Sommaire', level=1)
toc = [
    '1. Pourquoi adhérer à la plateforme MUTUALIS ?',
    '2. Conditions d\'adhésion et tarification',
    '3. Ce que chaque MSD obtient — toutes les fonctionnalités, page par page',
    '4. Studio Cartes : le cœur de la production de cartes',
    '5. Importation contrôlée : Excel + Photos',
    '6. Cycle de vie d\'une carte CMU',
    '7. Cycle de vie d\'un bénéficiaire (assuré)',
    '8. Prises en charge, lettres de garantie et tiers-payant',
    '9. Cotisations et rappels automatiques',
    '10. Réclamations, télémedecine et services annexes',
    '11. Sécurité : ce qui protège chaque MSD',
    '12. Rapports Excel et traçabilité',
    '13. Formation des agents',
    '14. Règles d\'or de la plateforme',
    '15. Questions fréquentes (FAQ)',
]
for t in toc:
    para(t, size=12)

doc.add_page_break()

# ================= 1. POURQUOI ADHERER =================
doc.add_heading('1. Pourquoi adhérer à la plateforme MUTUALIS ?', level=1)
para('La plateforme MUTUALIS (Portail CSU) est le système officiel de gestion de la '
     'Couverture Sanitaire Universelle destiné aux Mutuelles de Santé Communautaires '
     'du Sénégal. Elle a été construite autour de besoins concrets des MSD : '
     'produire des cartes CMU en série, gérer des dizaines de milliers d\'assurés, '
     'suivre les prises en charge, et prouver chaque opération par une traçabilité '
     'incontestable.')
para('Sans la plateforme, une MSD gère ses adhérents dans des cahiers, des fichiers '
     'Excel dispersés et des papiers de campagne — sans historique fiable, sans '
     'vérification de carte par les structures sanitaires, sans protection contre '
     'les doublons et les pertes de données.')
para('Avec la plateforme, chaque MSD dispose d\'un compte sécurisé, d\'un espace de '
     'travail où elle ne voit QUE ses propres assurés, et d\'outils professionnels '
     'validés côté serveur.')

doc.add_heading('Les problèmes concrets que la plateforme résout', level=2)
bullet('Les fiches papier se perdent ou se dupliquent : ici, chaque assuré est '
       'identifié par un matricule unique et son NIN ; la réimportation est '
       'idempotente (elle ne crée jamais de doublon).',
       bold_prefix='Doublons et pertes : ')
bullet('Une carte imprimée avec un ancien code reste toujours résoluble : le système '
       'de « code alias » rattache chaque ancien matricule au porteur réel, même '
       'après consolidation de fiches.',
       bold_prefix='Cartes orphelines : ')
bullet('Le jour de la campagne, aucune donnée de démonstration ne peut apparaître : '
       'une liste vide reste vide et honnête. Les profils fictifs ont été supprimés '
       'définitivement.',
       bold_prefix='Données fictives : ')
bullet('Un agent de la MSD A ne peut jamais voir les assurés de la MSD B. Le '
       'cloisonnement est vérifié sur chaque route, sur trois niveaux (citoyen, '
       'agent MSD, Super Admin).',
       bold_prefix='Confidentialité : ')
bullet('Un catalogue de profils fictifs (ex. « Fatou Diallo, Modou Diop ») '
       's\'affichait quand l\'API ne répondait pas : supprimé définitivement.',
       bold_prefix='Assurance qualité : ')

# ================= 2. CONDITIONS =================
doc.add_heading('2. Conditions d\'adhésion et tarification', level=1)
doc.add_heading('Adhésion MSD : 150 000 FCFA', level=2)
para('Chaque Mutuelle de Santé Communautaire verse une adhésion unique de '
     '150 000 FCFA pour bénéficier de l\'ensemble des fonctionnalités de la '
     'plateforme. Cette adhésion couvre :')
bullet('La création du compte MSD sécurisé (agent MSD, cloisonné sur son périmètre).')
bullet('L\'accès au Studio Cartes complet (production, suivi, historique).')
bullet('L\'accès au parcours d\'importation contrôlée (Excel + Photos).')
bullet('La gestion complète des prises en charge et lettres de garantie.')
bullet('Le Centre de Sécurité : journal d\'audit, alertes, suivi des cartes.')
bullet('Les rapports Excel professionnels (XLSX) sur tous les modules.')
bullet('L\'appui à la formation des agents à l\'impression de cartes.')

doc.add_heading('Carte CMU : 350 FCFA par carte', level=2)
para('Chaque carte imprimée coûte 350 FCFA à la MSD concernée. Ce tarif couvre :')
bullet('La production et l\'impression de la carte (Studio Cartes).')
bullet('La formation des agents à l\'impression de la carte.')
bullet('La sécurité de la carte (matricule séquentiel, code officiel '
       'REGION-MSD-ANNEE-SEQUENCE).')
bullet('Le bon fonctionnement des fonctionnalités de la carte (vérification par '
       'les structures partenaires, tiers-payant, suivi de cotisation).')
bullet('Les opérations de gestion : changement de mot de passe, blocage, '
       'déblocage, révocation, remplacement de la carte.')

doc.add_heading('Pourquoi 350 FCFA par carte : chaque franc est justifié', level=2)
para('Le tarif de 350 FCFA n\'est pas un frais abstrait : il couvre un ensemble de '
     'services concrets qui font fonctionner la carte du début à la fin. La MSD ne paie '
     'que les cartes RÉELLEMENT imprimées — une simple importation, une validation ou '
     'une tentative d\'impression ne génère jamais de facture.')
table(
    ['Ce que couvre la carte à 350 FCFA', 'Valeur concrète pour la MSD'],
    [
        ['Production de la carte virtuelle par le Super Admin : matricule officiel '
         'REGION-MSD-ANNEE-SEQUENCE, photo rattachée, QR code',
         'Zéro erreur de codage ni de doublon : la série est générée et vérifiée '
         'automatiquement, la MSD n\'a aucune manipulation technique à faire.'],
        ['Formation des agents à l\'impression de la carte et à sa gestion',
         'Les agents deviennent autonomes : ils impriment eux-mêmes leurs cartes et '
         'savent gérer blocage, remplacement et réinitialisation.'],
        ['Sécurité de la carte : vérification serveur du statut à chaque scan, '
         'blocage et révocation contrôlés côté serveur',
         'Une carte perdue ou volée est neutralisée en quelques clics, immédiatement '
         'dans tout le réseau — la fraude est stoppée pour de bon.'],
        ['Interconnexion avec les structures partenaires : vérification du QR code, '
         'tiers-payant, suivi de cotisation',
         'Les assurés de la MSD sont acceptés dans tout le réseau conventionné '
         '(pharmacies, hôpitaux) — l\'argument d\'adhésion n° 1 pour les assurés.'],
        ['Cycle de vie complet : historique, déblocage, révocation, remplacement, '
         'réinitialisation de mot de passe',
         'Chaque opération est datée, motivée et tracée : la MSD dispose d\'une '
         'preuve en cas de litige avec un assuré ou une structure.'],
        ['Rapports Excel professionnels, journal d\'audit et Centre de Sécurité inclus',
         'Le pilotage et les preuves sont compris dans le tarif : aucun module '
         'indispensable facturé en supplément.'],
    ],
    widths=[8, 9],
)
para('Facturation transparente et vérifiable : le nombre de cartes imprimées, le tarif '
     'applicable et le montant sont calculés automatiquement côté serveur, avec un '
     'historique des événements de production unique par matricule et par type '
     '(initial, réimpression, remplacement) qui rend tout double comptage impossible.')

# ================= 3. CE QUE LE MSD OBTIENT =================
doc.add_heading('3. Ce que chaque MSD obtient — toutes les fonctionnalités, '
                'page par page', level=1)
para('Chaque fonctionnalité est présentée avec sa valeur concrète : c\'est elle qui '
     'justifie l\'adhésion de la MSD et le tarif de 350 FCFA par carte imprimée.', italic=True)
table(
    ['Module', 'Ce que le MSD peut faire', 'Pourquoi cela vaut l\'adhésion'],
    [
        ['Studio Cartes (Super Admin)',
         'Module réservé au Super Admin : il crée les cartes virtuelles à partir '
         'des fichiers Excel et photos transmis par chaque MSD, puis les met à '
         'disposition de la MSD pour impression.',
         'Les matricules officiels sont produits sans erreur ni doublon : la MSD '
         'reçoit des cartes directement prêtes à imprimer.'],
        ['Logiciel de collecte MSD',
         'Application mobile de terrain (photo + informations de l\'assuré) et base '
         'de données qui génèrent automatiquement le fichier Excel et rangent les '
         'photos, prêts à envoyer au Super Admin.',
         'Des centaines d\'adhérents collectés en peu de temps, sans feuille papier '
         'ni ressaisie : la campagne part au Super Admin en quelques heures.'],
        ['Importation contrôlée (MSD → Super Admin)',
         'La MSD prépare son fichier Excel avec photos et le transmet ; après '
         'prévisualisation, correction et validation, le Super Admin intègre les '
         'dossiers conformes ; la MSD reçoit un rapport détaillé.',
         'Des milliers d\'adhérents intégrés en une seule fois et vérifiés : des '
         'semaines de saisie et de correction économisées.'],
        ['Gestion des assurés',
         'Rechercher un assuré, vérifier son identité, consulter sa fiche complète, '
         'suivre ses cotisations et ses demandes.',
         'Un registre unique et fiable remplace les cahiers et fichiers Excel '
         'dispersés, souvent perdus ou dupliqués.'],
        ['Gestion des cartes',
         'Bloquer / débloquer / révoquer / remplacer une carte, consulter son '
         'historique, réinitialiser le mot de passe d\'un assuré.',
         'Perte, vol ou remplacement traités en quelques clics, avec preuve datée : '
         'la MSD est protégée en cas de litige.'],
        ['Prises en charge',
         'Déposer et traiter les demandes de prise en charge des assurés de la MSD.',
         'Les assurés sont pris en charge rapidement et suivent leur dossier : la '
         'MSD répond présente au moment où on a besoin d\'elle.'],
        ['Lettres de garantie',
         'Suivre les lettres de garantie et le tiers-payant avec les structures '
         'partenaires conventionnées.',
         'Le tiers-payant fonctionne réellement avec les hôpitaux et pharmacies : '
         'c\'est le bénéfice visible qui attire les adhérents.'],
        ['Cotisations',
         'Enregistrer les cotisations, déclencher les rappels automatiques.',
         'Rappels automatiques et suivi rigoureux : moins d\'impayés, un '
         'recouvrement régulier et prévisible.'],
        ['Réclamations',
         'Consulter et résoudre les réclamations déposées (notes obligatoires).',
         'Chaque réclamation est traitée et tracée : la MSD prouve sa réactivité '
         'devant ses adhérents.'],
        ['Centre de Sécurité',
         'Consulter le journal d\'audit, les alertes de sécurité, les KPI des cartes.',
         'Journal d\'audit daté servant de preuve en cas de conflit, alertes en '
         'temps réel sur les activités suspectes.'],
        ['Rapports Excel',
         'Exporter des rapports XLSX professionnels sur tous les modules.',
         'Des rapports prêts à présenter au bureau régional ou en conseil '
         'd\'administration, sans reconstruire de tableaux.'],
    ],
    widths=[3.8, 6.6, 6.6],
)

doc.add_heading('Inventaire complet : toutes les pages de la plateforme et leur '
                'intérêt pour la MSD', level=2)
para('La plateforme compte plus de quarante pages, organisées en cinq espaces. '
     'Ci-dessous, chaque page est décrite par ce qu\'elle permet de faire et par '
     'l\'intérêt concret qu\'elle représente pour la MSD.', italic=True)

doc.add_heading('Espace assuré / citoyen (portail citoyen, après connexion)', level=3)
table(
    ['Page', 'Ce que permet la page', 'Intérêt pour la MSD'],
    [
        ['Accueil du portail citoyen',
         'Tableau personnel de l\'assuré : statut de la carte, cotisation à jour, '
         'notifications, accès rapide à tous les services.',
         'L\'assuré se sert lui-même à toute heure : moins de files d\'attente et '
         'de sollicitations au guichet.'],
        ['Mon adhésion & cotisation en ligne (Services en ligne)',
         'Choix du package (individuel, familial, scolaire, gratuité BSF), '
         'adhésion 100 % en ligne, paiement par Wave et Orange Money, quittance '
         'immédiate.',
         'La MSD recrute et encaisse sans guichet : chaque paiement est confirmé '
         'côté serveur et rattaché automatiquement à la bonne fiche.'],
        ['Faire un don',
         'Dons solidaires versés à la campagne active, avec statistiques de la '
         'campagne en temps réel.',
         'Des financements solidaires appuient les actions de la MSD sans effort '
         'de collecte supplémentaire.'],
        ['Mon compte',
         'Profil de l\'assuré, historique des cotisations, statut du package, '
         'pièces jointes.',
         'L\'assuré vérifie lui-même sa situation : moins d\'erreurs et de '
         'réclamations au bureau.'],
        ['Mes cotisations',
         'Historique des cotisations annuelles et échéances, visibles à tout '
         'moment.',
         'La MSD peut prouver chaque encaissement ; les impayés sont visibles '
         'immédiatement.'],
        ['Mes remboursements (prises en charge)',
         'Dépôt et suivi de ses demandes de prise en charge, avec reçu PDF '
         'officiel téléchargeable.',
         'L\'assuré suit son dossier en ligne : la MSD démontre sa réactivité et '
         'réduit les réclamations.'],
        ['Bons de commande & lettres de garantie',
         'Attestation de prise en charge hospitalière, lettre de garantie avec '
         'validation humaine et tiers-payant.',
         'Le tiers-payant fonctionne concrètement avec les structures : '
         'l\'argument d\'adhésion n° 1 pour les assurés.'],
        ['Bons de commande pharmacie',
         'Ordonnance photographiée, bon de prise en charge (couverture CMU et '
         'reste à charge), rachat en pharmacie avec code à usage unique.',
         'Les pharmacies partenaires délivrent aux assurés de la MSD : la '
         'mutuelle est visible sur le terrain.'],
        ['Télémédecine',
         'File d\'attente, visioconférence HD avec le médecin, rendez-vous, '
         'annonces vocales automatiques quand c\'est au tour du patient.',
         'Les assurés consultent à distance : la MSD couvre aussi les horaires '
         'et les zones difficiles d\'accès.'],
        ['Dossier médical & radios',
         'Antécédents, groupe sanguin, radiographies et résultats certifiés '
         '(CNOM & UNAMUSC), carnet de santé numérique téléchargeable.',
         'Un dossier complet et fiable remplace les papiers perdus : les soins '
         'sont suivis de bout en bout.'],
        ['Spécialités, pathologies & maternité',
         'Suivi maternité (CPN/PEV), surveillance ALD, protocole '
         'post-opératoire, prescriptions, recommandations nutritionnelles pour '
         'maman & bébé.',
         'Le suivi des femmes enceintes et des malades chroniques est organisé '
         'et traçable : moins de complications évitables.'],
        ['Parrainage solidaire',
         'Reçu de cotisation et de parrainage ; le sponsor est identifié par son '
         'numéro et son logo est apposé sur les cartes parrainées.',
         'Les assurés deviennent recruteurs : la MSD grossit par un parrainage '
         'organisé et mesurable.'],
        ['Fidélité',
         'Points cumulés, badges, récompenses et classement des 20 meilleurs '
         'membres.',
         'La fidélisation réduit le renoncement au renouvellement de cotisation.'],
        ['Paiement',
         'Initiation de paiement, vérification par référence, quittance et '
         'attestation de paiement officielle.',
         'Chaque paiement a une preuve opposable, consultable à tout moment par '
         'l\'assuré et par la MSD.'],
        ['Réclamations',
         'Dépôt d\'une réclamation en ligne, suivi du traitement, réponse des '
         'agents régionaux sous 48 h.',
         'La MSD traite et trace chaque plainte : elle prouve son sérieux '
         'devant ses adhérents.'],
        ['Vérification de carte (VerifyCard)',
         'Consultation du statut d\'une carte scannée (QR), résolution des '
         'anciens codes (alias), données scolaires CMU-Élèves / Daara portées '
         'par le QR, actions directes (garantie, ordonnance, télémédecine, '
         'radios, antécédents).',
         'L\'assuré et la structure vérifient en une seconde la validité de la '
         'carte : moins de contestations au point de soin.'],
        ['Programmes CSU',
         'Consultation et inscription aux campagnes CSU (vaccination, '
         'dépistage, prévention).',
         'La MSD s\'associe aux campagnes nationales et multiplie ses points de '
         'contact avec les habitants.'],
    ],
    widths=[4.5, 7, 5.5],
)
doc.add_heading('Espace agent MSD (les agents de la mutuelle, après connexion)', level=3)
table(
    ['Page', 'Ce que permet la page', 'Intérêt pour la MSD'],
    [
        ['Tableau de bord CSU',
         'Indicateurs opérationnels de la couverture : assurés totaux, '
         'cotisations, cartes, couverture régionale.',
         'La MSD se pilote avec des chiffres à jour, pas avec des cahiers.'],
        ['Bénéficiaires (base des assurés)',
         'Recherche, fiche complète, ayants droit, activation / désactivation '
         'tracée, photo servie de façon sécurisée, reçu de parrainage.',
         'Registre unique et cloisonné : aucun assuré d\'une autre MSD '
         'n\'apparaît jamais dans les listes.'],
        ['Cotisations',
         'Enregistrement par l\'agent ou automatiquement via un paiement confirmé, '
         'historique, rappels automatiques (cotisations expirant sous 60 jours ou '
         'déjà expirées, au plus un rappel par période de 7 jours).',
         'Moins d\'impayés : un recouvrement régulier et prévisible, sans relance '
         'manuelle oubliée.'],
        ['Prises en charge',
         'Traitement des demandes (en attente → approuvée / rejetée avec motif '
         'obligatoire → payée), notification automatique à chaque changement de '
         'statut.',
         'Des décisions rapides, motivées et prouvées en cas de litige avec une '
         'structure ou un assuré.'],
        ['Bons de commande & lettres de garantie',
         'Validation humaine des lettres de garantie, suivi du tiers-payant avec '
         'les structures conventionnées.',
         'Le tiers-payant reste sous le contrôle de la MSD : aucun déblocage '
         'automatique, jamais.'],
        ['Réclamations',
         'Consultation cloisonnée, résolution avec notes obligatoires à la '
         'clôture, suppression réservée aux administrateurs.',
         'Chaque réclamation laisse une trace : la MSD répond de son action '
         'devant ses membres.'],
        ['Unions & statistiques (départements)',
         'Découpage administratif du Sénégal (régions, départements, communes) '
         'et couverture de la mutualité de santé par zone.',
         'La MSD se situe dans le découpage national et mesure sa couverture '
         'locale.'],
        ['Notifications SMS / WhatsApp',
         'Envoi de messages aux assurés (rappels, confirmations), journalisation '
         'par canal, destinataire et statut.',
         'Les assurés sont prévenus là où ils sont : les relances aboutissent '
         'réellement.'],
        ['Rapports Excel',
         'Export XLSX généré côté serveur (bénéficiaires, cartes, production, '
         'audit), cloisonné par MSD, avec calculs financiers vérifiés côté serveur.',
         'Des rapports prêts à présenter au conseil d\'administration ou au '
         'bureau régional, sans reconstruire de tableaux.'],
        ['Centre de Sécurité',
         'Tableau de bord des cartes bloquées / révoquées / actives, réinitialisations '
         'de mot de passe sur 7 jours, journal d\'audit filtré, alertes par seuils '
         'configurables.',
         'Le journal sert de preuve en cas de conflit ; les alertes détectent les '
         'activités suspectes avant qu\'il ne soit trop tard.'],
        ['Mon profil (agent)',
         'Compte de l\'agent, historique personnel, bascule entre profils, '
         'déconnexion qui révoque le jeton de session.',
         'Chaque agent travaille sous sa propre identité : la responsabilité est '
         'individuelle et tracée.'],
    ],
    widths=[4.5, 7, 5.5],
)

doc.add_heading('Supervision Super Admin (gouvernance nationale)', level=3)
table(
    ['Page', 'Ce que permet la page', 'Intérêt pour la MSD'],
    [
        ['Studio Cartes',
         'Hiérarchie navigable Région → Département → MSD → adhésion de masse → '
         'membres → cartes ; création et impression des cartes, QR codes, logos '
         'des parrainages, filigrane des cartes scolaires, verrouillage des lots, '
         'historique de production, revenus à 350 FCFA.',
         'La MSD reçoit des cartes directement prêtes à imprimer, et les revenus '
         'de Sen-E-Carte sont calculés sans double comptage possible.'],
        ['Importation contrôlée',
         'Parcours en étapes Excel + photos : prévisualisation, correction, '
         'validation explicite, rapport à 6 feuilles (détail en section 5).',
         'Des milliers d\'assurés intégrés en une seule fois, vérifiés, sans '
         'doublon ni import partiel silencieux.'],
        ['Journal d\'audit',
         'Historique temps réel, exhaustif et immuable : connexions, transactions '
         'de cotisations, actes de télémédecine, opérations sur les cartes.',
         'Preuve incontestable en cas de contrôle ou de litige — la MSD est '
         'protégée par ce registre.'],
        ['Gouvernance Super Admin',
         'Comptes utilisateurs, KPI financiers, habilitations médicales, panneau '
         'de maintenance global (activation avec double confirmation, '
         'désactivation immédiate).',
         'La plateforme reste disponible et maîtrisée : aucun arrêt surprise, '
         'aucun compte fantôme, reprise du service toujours prioritaire.'],
        ['Statistiques inter-régions',
         'Tableau de bord dynamique et comparatif des indicateurs CSU de toutes '
         'les régions du Sénégal.',
         'La MSD est comparée à ses voisines : un argument concret pour convaincre '
         'les décideurs et les partenaires.'],
        ['Gestion des MSD',
         'Création et suivi des mutuelles avec leur effectif réel, réservé au '
         'Super Admin (garde explicite sur la route).',
         'Chaque MSD reçoit son périmètre propre : jamais les données d\'une autre '
         'MSD, jamais les siennes mélangées.'],
    ],
    widths=[4.5, 7, 5.5],
)
doc.add_heading('Professionnels de santé, partenaires et institutions', level=3)
table(
    ['Page', 'Ce que permet la page', 'Intérêt pour la MSD'],
    [
        ['Espace prestataire (UDMS)',
         'Gestion des praticiens de santé : création des médecins, pharmacies et '
         'centres, statistiques de la structure, connexion dédiée au partenaire.',
         'Le réseau conventionné s\'agrandit : davantage de structures acceptent '
         'les assurés de la MSD.'],
        ['Vérification de carte & tiers-payant partenaire',
         'API partenaire : vérification instantanée d\'une carte scannée avec '
         'couverture, déclaration de tiers-payant au taux de la structure, '
         'statistiques du partenaire.',
         'Les structures vérifient en une seconde la validité d\'une carte MSD : '
         'accès aux soins fluide pour l\'assuré.'],
        ['Portail institutionnel COUD',
         'Réservé au Super Admin DSI UNAMUSC : synthèse du COUD, importation en '
         'masse des étudiants avec génération de cartes numériques.',
         'La gouvernance nationale des prestataires et des étudiants vit dans la '
         'même plateforme que la MSD : un seul système de référence.'],
        ['Espace partenariat',
         'Dépôt, suivi et validation des propositions de partenariat (ONG, '
         'entreprises, bailleurs).',
         'Les partenaires rejoignent la MSD via un parcours officiel et tracé, '
         'pas par des accords de couloir.'],
        ['Espace RSE',
         'Campagnes de plaidoyer ciblées (daaras, écoles, pêcheurs…), engagement '
         'des entreprises (pledges), création de campagne pour les administrateurs.',
         'Des entreprises financent l\'adhésion de groupes entiers : de nouveaux '
         'adhérents sans effort commercial de la MSD.'],
        ['Médecin, sage-femme, pharmacien, laboratoire',
         'Profils d\'accès dédiés (registre des 13 profils de connexion) : '
         'téléconsultation, suivi maternité, bons de commande, dossiers et radios '
         '— chacun dans son propre portail.',
         'Les professionnels opèrent avec leurs droits exacts : la MSD encadre '
         'tout le circuit de soins, de l\'ordonnance au rachat.'],
        ['Cartographie sanitaire',
         'Localisation des mutuelles de santé et des structures sanitaires '
         'conventionnées du Sénégal.',
         'Orienter un assuré vers la structure la plus proche en quelques '
         'secondes, même hors de sa région.'],
        ['Annuaire national des mutuelles',
         'Répertoire national des mutuelles (MSD), organisé région par région, '
         'avec rattachement aux unions départementales.',
         'La MSD est trouvable et identifiable dans le réseau national : de la '
         'visibilité gratuite.'],
    ],
    widths=[4.5, 7, 5.5],
)
doc.add_heading('Pages publiques et éditoriales (accessibles sans connexion)', level=3)
table(
    ['Page', 'Ce que permet la page', 'Intérêt pour la MSD'],
    [
        ['Accueil',
         'Vitrine de la plateforme : « Santé pour tous, partout au Sénégal », '
         'adhésion, paiement de cotisation (Wave / Orange Money), carte numérique, '
         'accès aux services.',
         'La vitrine de la MSD sur internet, accessible à tout visiteur, 24 h/24.'],
        ['Programmes CSU',
         'Présentation des programmes de la Couverture Sanitaire Universelle et '
         'inscription aux campagnes.',
         'Les habitants découvrent les avantages de la mutuelle avant même '
         'd\'adhérer.'],
        ['Médicaments & actes couverts',
         'Liste officielle des médicaments et actes remboursés par la CMU, taux '
         'de remboursement, simulateur de reste à charge.',
         'L\'assuré sait ce qui est couvert avant d\'aller à la pharmacie : '
         'confiance et transparence.'],
        ['Galerie CSU',
         'Images des actions menées sur le terrain et des centres de santé '
         'conventionnés, paginées côté serveur.',
         'Preuve visible des actions de la MSD : un outil de communication '
         'gratuit et permanent.'],
        ['Infos Sénégal',
         'Actualités et initiatives de la CSU au Sénégal.',
         'La MSD s\'associe à l\'information nationale et monte en crédibilité.'],
        ['Blog & paroles d\'experts',
         'Articles de professionnels de santé, commentaires, likes — contenus '
         'gérés et paginés côté serveur.',
         'Éduquer les assurés : moins d\'abus, une meilleure utilisation des '
         'services de la MSD.'],
        ['L\'union régionale (institutionnel)',
         'Histoire, mission, vision, bureau, organigramme et statuts de '
         'l\'URMSCD.',
         'La MSD s\'inscrit dans une organisation officielle et rassure ses '
         'membres et ses partenaires.'],
        ['Connexion',
         'Accès sécurisé par e-mail et mot de passe pour les 13 profils '
         '(citoyens, agents, Super Admin, professionnels de santé), avec comptes '
         'uniques.',
         'Chacun entre par sa propre porte : le cloisonnement commence dès la '
         'connexion.'],
    ],
    widths=[4.5, 7, 5.5],
)
doc.add_heading('Ce qui traverse toutes les pages', level=3)
bullet('Interface complète en deux langues : français et wolof, sur chaque page.',
       bold_prefix='Bilinguisme : ')
bullet('Collecte et consultation possibles sans réseau, avec file de '
       'synchronisation automatique et suivi d\'état : la collecte en zone '
       'blanche ne perd aucune donnée.',
       bold_prefix='Mode hors-ligne : ')
bullet('Rappels et confirmations envoyés par SMS et WhatsApp, avec journalisation '
       'par canal, destinataire et statut.',
       bold_prefix='Notifications : ')
bullet('Assistant conversationnel bilingue (français / wolof) avec réponse '
       'vocale, disponible pour guider les assurés à toute heure.',
       bold_prefix='Chatbot vocal : ')
bullet('Paiement par Wave et Orange Money, confirmé côté serveur via webhook, '
       'avant qu\'une cotisation soit créditée.',
       bold_prefix='Paiement mobile money : ')
bullet('Les indicateurs et alertes se mettent à jour sans recharger la page '
       '(bus temps réel).',
       bold_prefix='Temps réel : ')
bullet('La plateforme s\'installe comme une application sur le téléphone de '
       'l\'agent ou de l\'assuré.',
       bold_prefix='Application installable : ')
bullet('Toutes les listes sont paginées côté serveur et cloisonnées par MSD ou '
       'par citoyen, sans exception.',
       bold_prefix='Pagination et cloisonnement : ')

# ================= 4. STUDIO CARTES =================
doc.add_heading('4. Studio Cartes : le cœur de la production de cartes', level=1)
para('Le Studio Cartes est l\'atelier de production des cartes CMU. Il est '
     'réservé au Super Admin : c\'est lui qui crée les cartes virtuelles à '
     'partir des fichiers Excel et photos transmis par les MSD, puis les met à '
     'disposition de chaque MSD pour impression. Chaque MSD imprime elle-même '
     'ses propres cartes pour ses assurés.')
para('Flux de production :')
numbered('La MSD réalise une adhésion de masse et transmet le fichier Excel '
         'accompagné des photos des assurés au Super Admin.')
numbered('Le Super Admin vérifie, valide et crée les cartes virtuelles dans le '
         'Studio Cartes.')
numbered('Les cartes créées sont envoyées (mises à disposition) à la MSD '
         'concernée.')
numbered('La MSD imprime elle-même ses cartes pour ses assurés ; chaque '
         'impression confirmée est enregistrée et sert de base au calcul des '
         'revenus de Sen-E-Carte.')
para('Hiérarchie navigable dans le Studio Cartes :', bold=True)
para('Région → Département → MSD → Adhésion (lot de campagne) → Membres → Cartes',
     bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
doc.add_heading('Fonctionnalités du Studio Cartes', level=2)
bullet('Vue d\'ensemble consolidée : nombre de régions, de départements, de MSD, '
       'd\'adhésions de masse, d\'adhérents, de cartes validées et imprimées, '
       'de dossiers à corriger et revenus consolidés de Sen-E-Carte.')
bullet('Production par lot de campagne : chaque lot porte un code unique au format '
       'LOT-AAAA-NNN et trace la provenance de chaque carte.')
bullet('Métriques de revenus : calcul automatique à 350 FCFA par carte éligible '
       'imprimée par la MSD, sans double comptage possible. Une simple '
       'importation, une validation ou une tentative d\'impression ne compte '
       'jamais comme une impression confirmée.')
bullet('Historique de production : chaque événement (impression initiale, '
       'réimpression, remplacement, destruction) est enregistré une seule fois, '
       'de façon idempotente, avec le tarif historique appliqué. Une '
       'réimpression ou un remplacement ne génère pas de revenu supplémentaire '
       'sans respecter la règle de facturation applicable.')
bullet('Verrouillage des lots : un lot marqué « imprimé » ne peut plus être recodé '
       '— protection contre les erreurs de campagne.')
bullet('Matricules séquentiels : le format officiel REGION-MSD-ANNEE-SEQUENCE est '
       'généré séquentiellement, jamais de façon aléatoire (les collisions '
       'historiques de codes aléatoires sont exclues).')

# ================= 5. IMPORTATION CONTROLEE =================
doc.add_heading('5. Importation contrôlée : Excel + Photos', level=1)
para('Pour inscrire des centaines ou des milliers d\'assurés en une seule '
     'campagne, la MSD prépare un fichier Excel accompagné des photos des '
     'assurés et le transmet au Super Admin. Le parcours est structuré en '
     'étapes, où rien n\'est enregistré sans prévisualisation et validation '
     'explicite.')
doc.add_heading('Le parcours en étapes', level=2)
numbered('Préparation par la MSD du fichier Excel (modèle fourni) et des photos '
         'des assurés.')
numbered('Transmission du fichier au Super Admin : le système vérifie chaque '
         'ligne (champs obligatoires, cohérence, rattachement à la bonne MSD, '
         'doublons).')
numbered('Prévisualisation : les dossiers sont affichés ligne par ligne, avec '
         'les anomalies signalées.')
numbered('Correction : les lignes en anomalie sont corrigées ou exclues.')
numbered('Validation explicite : seules les lignes conformes sont intégrées.')
numbered('Intégration : le Super Admin crée les assurés validés et les cartes '
         'virtuelles correspondantes, puis les met à disposition de la MSD pour '
         'impression ; un rapport final est généré.')
doc.add_heading('Contrôles automatiques pendant l\'import', level=2)
bullet('Limite stricte de 5 000 lignes par import.')
bullet('Idempotence par matricule + NIN : réimporter le même fichier ne crée '
       'jamais de doublon.')
bullet('Détection des champs manquants (rejet avec message clair, jamais '
       'd\'enregistrement à moitié vide).')
bullet('Détection des doublons (même matricule ou même NIN déjà présent).')
bullet('Détection des photos orphelines (photos sans ligne Excel correspondante).')
bullet('Détection des erreurs de rattachement MSD.')
bullet('Transaction unique : si une erreur grave survient, tout est annulé '
       '(rollback) — jamais d\'import partiel sans le savoir.')

doc.add_heading('Le rapport d\'importation (XLSX à 6 feuilles)', level=2)
para('À la fin de chaque import, un rapport Excel professionnel est généré avec '
     'six feuilles :')
table(
    ['Feuille', 'Contenu'],
    [
        ['Synthèse', 'Vue globale : lignes traitées, conformes, anomalies, doublons.'],
        ['Conformes', 'Les lignes validées et intégrées en base.'],
        ['Anomalies', 'Les lignes rejetées, avec la raison exacte de chaque rejet.'],
        ['Doublons', 'Les lignes en conflit avec des fiches existantes.'],
        ['Photos orphelines', 'Les photos sans correspondance dans le fichier Excel.'],
        ['Résultat', 'Le bilan final de l\'intégration.'],
    ],
    widths=[5, 12],
)

doc.add_heading('Le logiciel de collecte MSD : de l\'assuré de terrain au fichier '
                'prêt à envoyer', level=2)
para('Chaque MSD dispose d\'un logiciel de collecte conçu pour enrôler un grand nombre '
     'd\'assurés en peu de temps. Il se compose de deux éléments complémentaires :')
bullet('l\'agent se déplace chez le nouvel assuré, photographie celui-ci et saisit '
       'toutes ses informations directement sur place — plus aucune feuille papier à '
       'ressaisir au bureau.', bold_prefix='Une application mobile de terrain : ')
bullet('elle génère AUTOMATIQUEMENT le fichier Excel attendu par la plateforme et range '
       'chaque photo dans un dossier ordonné, prêt à être transmis.',
       bold_prefix='Une base de données qui : ')
para('Circuit complet, de la collecte jusqu\'à l\'impression par la MSD :')
numbered('L\'agent collecte les nouveaux assurés sur le terrain avec l\'application '
         'mobile (photo + informations).')
numbered('Le logiciel génère le fichier Excel et le dossier de photos, correctement '
         'rangés et prêts à partir.')
numbered('Le lot est transmis au Super Admin, qui contrôle les données et crée les '
         'cartes virtuelles dans le Studio Cartes.')
numbered('Chaque carte virtuelle est immédiatement reliée à son QR code : vérification '
         'en ligne, tiers-payant et contrôle du statut sont opérationnels AVANT que la '
         'MSD ne reçoive les cartes.')
numbered('La MSD reçoit les cartes virtuelles de ses assurés et les imprime elle-même, '
         'quand elle veut, sur son propre matériel.')
para('Le fichier produit respecte exactement le format du parcours d\'importation '
     'contrôlé décrit ci-dessus : mêmes colonnes, mêmes contrôles automatiques, même '
     'rapport à six feuilles. Aucune ressaisie, aucun format parallèle, aucune donnée '
     'intégrée avant validation explicite.')

# ================= 6. CYCLE DE VIE CARTE =================
doc.add_heading('6. Cycle de vie d\'une carte CMU', level=1)
para('Chaque carte traverse des statuts contrôlés. Aucun changement de statut n\'est '
     'possible sans motif, sans trace d\'audit, et sans vérification des droits de '
     'l\'agent qui effectue l\'opération.')
table(
    ['Action', 'Ce qui se passe', 'Qui peut le faire'],
    [
        ['Émission (impression initiale)',
         'La carte est produite avec son matricule officiel et sa photo.',
         'Agent MSD (sa MSD) / Admin'],
        ['Blocage',
         'La carte est bloquée (perte, vol, suspicion de fraude…). Motif '
         'obligatoire. La carte ne peut plus être utilisée.',
         'Agent MSD (sa MSD) / Admin'],
        ['Déblocage',
         'La carte bloquée redevient active. Motif et audit enregistrés.',
         'Agent MSD (sa MSD) / Admin'],
        ['Révocation',
         'La carte est définitivement retirée (fraude confirmée, doublon…). '
         'Motif obligatoire. Une carte révoquée ne peut plus être bloquée.',
         'Agent MSD (sa MSD) / Admin'],
        ['Remplacement',
         'Une nouvelle carte est émise en remplacement ; l\'ancienne est '
         'enregistrée comme remplacée. L\'historique complet est conservé.',
         'Agent MSD (sa MSD) / Admin'],
        ['Historique',
         'Consultation de toutes les opérations effectuées sur la carte, avec '
         'dates, acteurs et motifs.',
         'Agent MSD (sa MSD) / Admin'],
    ],
    widths=[4.5, 8, 4.5],
)
doc.add_heading('Changer le mot de passe de la carte', level=2)
para('Si un assuré veut changer le mot de passe de sa carte :')
numbered('L\'assuré se présente à sa MSD avec sa carte et une pièce d\'identité.')
numbered('L\'agent MSD vérifie son identité (procédure de vérification '
         'multi-étapes : comparaison de la photo enregistrée, vérification des '
         'informations personnelles).')
numbered('L\'agent lance la réinitialisation du mot de passe depuis la fiche de '
         'l\'assuré (route sécurisée, réservée aux agents de la MSD concernée).')
numbered('L\'opération est enregistrée dans le journal d\'audit (qui, quoi, quand).')
para('Ainsi, l\'assuré ne peut jamais changer son mot de passe sans passer par une '
     'vérification d\'identité — protection contre le vol de carte.')

# ================= 7. CYCLE DE VIE BENEFICIAIRE =================
doc.add_heading('7. Cycle de vie d\'un bénéficiaire (assuré)', level=1)
table(
    ['Statut', 'Signification', 'Conséquences'],
    [
        ['pending', 'Fiche créée mais pas encore validée.',
         'L\'assuré ne peut pas encore bénéficier des prises en charge.'],
        ['active', 'Fiche validée et cotisation à jour.',
         'L\'assuré a accès aux services (prises en charge, lettres de garantie).'],
        ['Désactivé', 'Fiche désactivée par l\'agent (toggle).',
         'L\'assuré est hors service ; l\'action est tracée.'],
        ['Fusionné', 'Fiche absorbée par une consolidation.',
         'Sort des listes mais reste en base pour la traçabilité ; une carte '
         'déjà imprimée retrouve toujours son porteur via le système d\'alias.'],
    ],
    widths=[3, 6, 8],
)
para('Règle d\'éligibilité : une cotisation payée dont la période n\'est pas '
     'expirée rend l\'assuré éligible aux prises en charge. Une cotisation '
     'expirée refuse le tiers-payant (refus explicite, jamais de dérogation '
     'silencieuse).')

# ================= 8. PRISES EN CHARGE =================
doc.add_heading('8. Prises en charge, lettres de garantie et tiers-payant', level=1)
doc.add_heading('Prises en charge (claims)', level=2)
bullet('Dépôt : un citoyen dépose ses propres demandes ; un agent MSD dépose pour '
       'sa MSD.')
bullet('Traitement : agents et admins uniquement. Statuts : en attente → '
       'approuvée / rejetée (avec motif obligatoire) → payée.')
bullet('Chaque changement de statut déclenche une notification au bénéficiaire '
       'et une ligne dans le journal d\'audit.')

doc.add_heading('Lettres de garantie et tiers-payant', level=2)
bullet('Création : par le bénéficiaire, avec un acte médical obligatoire ; le '
       'code de validation est généré côté serveur.')
bullet('Validation : TOUJOURS humaine, par un agent CMU. Aucun déblocage '
       'automatique n\'est possible — règle non négociable.')
bullet('Tiers-payant partenaire : la carte doit être active ET la cotisation '
       'non expirée ; sinon, refus explicite (403). Le taux de couverture vient '
       'du jeton du partenaire conventionné.')

# ================= 9. COTISATIONS =================
doc.add_heading('9. Cotisations et rappels automatiques', level=1)
bullet('Enregistrement : par l\'agent ou l\'admin, ou automatiquement via un '
       'paiement confirmé.')
bullet('Rappels automatiques : uniquement si aucun rappel n\'a été envoyé depuis '
       'moins de 7 jours ; ils ciblent les cotisations expirant sous 60 jours ou '
       'déjà expirées.')
bullet('Les notifications sont journalisées (canal, destinataire, statut).')

# ================= 10. SERVICES ANNEXES =================
doc.add_heading('10. Réclamations, télémedecine et services annexes', level=1)
doc.add_heading('Réclamations', level=2)
bullet('Dépôt public avec validation stricte des champs.')
bullet('Lecture réservée aux agents/admins, cloisonnée par MSD.')
bullet('Résolution : notes obligatoires à la clôture ; suppression réservée aux '
       'admins.')
doc.add_heading('Télémedecine et rendez-vous', level=2)
bullet('Sessions de téléconsultation et rendez-vous liés au bénéficiaire, '
       'cloisonnés : un citoyen ne voit jamais les sessions d\'un autre.')
doc.add_heading('Parrainage et fidélité', level=2)
bullet('Package parrainage : le sponsor est identifié par son numéro de '
       'téléphone ; son logo est apposé sur les cartes parrainées.')
bullet('Points de fidélité cumulés par bénéficiaire ; classement limité aux 20 '
       'premiers.')
doc.add_heading('Autres services', level=2)
bullet('Bons de commande pharmacie (rachat possible).')
bullet('Contenus éditoriaux : blog, galerie, actualités — tous paginés côté '
       'serveur.')
bullet('CMU-Élèves / Daara : champs dédiés (école, classe, année académique, '
       'INE, IA/IEF, tuteur).')

# ================= 11. SECURITE =================
doc.add_heading('11. Sécurité : ce qui protège chaque MSD', level=1)
doc.add_heading('Cloisonnement à trois niveaux', level=2)
table(
    ['Rôle', 'Périmètre d\'accès'],
    [
        ['Citoyen (assuré)', 'Uniquement SES ressources personnelles.'],
        ['Agent MSD', 'Les assurés de SA MSD uniquement (par code MSD).'],
        ['Super Admin', 'Toutes les MSD — c\'est son rôle de supervision.'],
        ['Structure partenaire', 'Ses déclarations et la vérification de cartes.'],
    ],
    widths=[6, 11],
)
para('Cette règle est vérifiée sur chaque route : « être connecté » ne suffit '
     'jamais — le rôle ET la propriété de la ressource sont contrôlés. Une fuite '
     'de données entre citoyens (IDOR) a été détectée et corrigée ; le '
     'cloisonnement est désormais systématique.')
doc.add_heading('Gestion des comptes et des mots de passe', level=2)
bullet('Mots de passe stockés hachés (bcrypt) — jamais en clair.')
bullet('Jetons de session (access token) : citoyen 24 h, agent/admin 8 h.')
bullet('Jetons de rafraîchissement : 30 jours, stockés HACHÉS en base (SHA-256) '
       '— jamais en clair.')
bullet('Expiration de session : TTL glissant 12 h côté application ; session '
       'périmée purgée au démarrage.')
bullet('Changement de mot de passe d\'un assuré : uniquement après vérification '
       'd\'identité par l\'agent de sa MSD.')
bullet('Blocage / suppression d\'un compte : opérations tracées, avec motif et '
       'confirmation.')
doc.add_heading('Centre de Sécurité', level=2)
bullet('Tableau de bord : cartes bloquées / révoquées / actives, réinitialisations '
       'de mot de passe sur 7 jours, événements de sécurité récents.')
bullet('Journal d\'audit filtré et paginé : action, acteur, détails, date.')
bullet('Alertes de sécurité par seuils configurables : blocage massif, échecs de '
       'connexion répétés, accès inhabituels.')
bullet('Protection contre les échecs de connexion : limitation du nombre de '
       'tentatives.')
doc.add_heading('Protection des données sensibles', level=2)
bullet('Aucune donnée médicale ou personnelle dans les logs, les messages '
       'd\'erreur, ou le journal frontend.')
bullet('Photos des assurés : jamais dans les listes paginées — servies '
       'individuellement à la demande.')
bullet('Aucun secret dans le code : tout passe par le fichier de configuration '
       '.env (jamais commité).')
bullet('Injection SQL : toutes les requêtes sont paramétrées — aucune '
       'concaténation de chaîne utilisateur.')
bullet('XSS : contenu utilisateur rendu sans insertion HTML brute.')
bullet('Limitation de débit (rate limiting) sur les routes de mutation.')

# ================= 12. RAPPORTS =================
doc.add_heading('12. Rapports Excel et traçabilité', level=1)
para('Tous les rapports sont générés côté serveur au format XLSX, avec des titres '
     'clairs, des filtres et des calculs financiers vérifiés côté serveur. Ils '
     'couvrent :')
bullet('Le Studio Cartes (production, revenus, lots).')
bullet('Les statistiques par MSD.')
bullet('Les imports de masse (rapport à 6 feuilles, cf. section 5).')
bullet('La gestion des cartes (blocages, révocations, remplacements).')
bullet('La sécurité (audit, alertes, événements).')
para('Chaque opération sensible (connexion, réinitialisation de mot de passe, '
     'accès aux données, opération sur une carte) est enregistrée dans le journal '
     'd\'audit : qui, quoi, quand, avec quel motif. Ce journal est réservé aux '
     'admins et fournit une preuve en cas de litige.')

# ================= 13. FORMATION =================
doc.add_heading('13. Formation des agents', level=1)
para('L\'adhésion inclut la formation des agents de la MSD aux opérations '
     'essentielles :')
table(
    ['Thème', 'Contenu'],
    [
        ['Impression de cartes', 'Utilisation du Studio Cartes : création de lot, '
         'génération des matricules, impression, verrouillage du lot.'],
        ['Importation contrôlée', 'Préparation du fichier Excel, parcours de '
         'validation, lecture du rapport d\'import à 6 feuilles.'],
        ['Vérification d\'identité', 'Procédure multi-étapes avant toute action '
         'sensible (réinitialisation de mot de passe, changement de statut).'],
        ['Gestion des cartes', 'Blocage, déblocage, révocation, remplacement — '
         'motifs obligatoires et conséquences.'],
        ['Sécurité', 'Bonnes pratiques de mot de passe, reconnaissance des '
         'alertes, usage du Centre de Sécurité.'],
    ],
    widths=[5, 12],
)

# ================= 14. REGLES D'OR =================
doc.add_heading('14. Règles d\'or de la plateforme', level=1)
para('Ces règles ne sont JAMAIS négociables — elles protègent la MSD autant que '
     'les assurés :')
numbered('Aucune donnée de démonstration n\'est affichée comme si elle était réelle.')
numbered('Aucune lettre de garantie n\'est « validée » sans validation humaine.')
numbered('Aucun citoyen ne voit les données d\'un autre citoyen.')
numbered('Aucune MSD ne voit les données d\'une autre MSD.')
numbered('Le backend est l\'autorité : le frontend reflète, il ne décide pas.')
numbered('Champs obligatoires : rejet clair si vide — jamais d\'enregistrement à '
         'moitié vide.')
numbered('Champs optionnels : vide explicite en base, jamais de chaîne ambiguë.')
numbered('Toute opération sensible passe par le journal d\'audit.')

# ================= 15. FAQ =================
doc.add_heading('15. Questions fréquentes (FAQ)', level=1)

faqs = [
    ('L\'adhésion de 150 000 FCFA est-elle annuelle ?',
     'L\'adhésion ouvre l\'accès aux fonctionnalités de la plateforme pour la MSD. '
     'Le détail de la périodicité est défini dans la convention d\'adhésion.'),
    ('Que comprend le prix de la carte (350 FCFA) ?',
     'La production et l\'impression, la formation des agents à l\'impression, la '
     'sécurité de la carte, le bon fonctionnement de ses fonctionnalités '
     '(vérification par les structures, tiers-payant, suivi de cotisation), et '
     'toutes les opérations de gestion : changement de mot de passe, blocage, '
     'déblocage, révocation, remplacement.'),
    ('Un agent peut-il voir les assurés d\'une autre MSD ?',
     'Non. C\'est impossible : le cloisonnement par code MSD est appliqué sur '
     'chaque route. Seul le Super Admin, par son rôle de supervision, accède à '
     'l\'ensemble.'),
    ('Un assuré peut-il changer son mot de passe seul ?',
     'Non. Le changement de mot de passe passe obligatoirement par la vérification '
     'd\'identité réalisée par l\'agent de sa MSD — protection contre le vol de '
     'carte.'),
    ('Que se passe-t-il si une carte est perdue ?',
     'L\'agent bloque la carte (motif obligatoire), puis émet une carte de '
     'remplacement. L\'historique complet est conservé.'),
    ('Une carte révoquée peut-elle être réactivée ?',
     'Non. La révocation est définitive ; le système interdit même de bloquer une '
     'carte déjà révoquée. Un remplacement peut être émis si nécessaire.'),
    ('Un import peut-il créer des doublons ?',
     'Non. L\'import est idempotent par matricule + NIN : réimporter le même '
     'fichier ne crée jamais de doublon. Les doublons détectés figurent dans la '
     'feuille dédiée du rapport.'),
    ('Les photos des assurés sont-elles visibles par tout le monde ?',
     'Non. Les photos ne figurent jamais dans les listes paginées ; elles sont '
     'servies individuellement, uniquement aux utilisateurs autorisés du '
     'cloisonnement (l\'agent de la MSD concernée, l\'assuré lui-même, l\'admin).'),
    ('Que se passe-t-il si une erreur survient pendant un import ?',
     'L\'import est exécuté dans une transaction unique : en cas d\'erreur grave, '
     'tout est annulé (rollback). Aucun import partiel ne peut se produire sans '
     'que la MSD en soit informée.'),
    ('Comment les revenus sont-ils calculés ?',
     'Automatiquement et uniquement côté serveur : 350 FCFA × nombre de cartes '
     'éligibles imprimées. Le système garantit qu\'un même événement de '
     'production n\'est comptabilisé qu\'une seule fois.'),
]
for q, a in faqs:
    para(q, bold=True, size=11, color=BLEU)
    para(a)

# ================= SUGGESTIONS =================
doc.add_heading('Suggestions pour renforcer l\'adhésion des MSD', level=1)
numbered('Organiser une démonstration en direct devant chaque MSD, sur SON périmètre '
         '(sa région, ses assurés fictifs de test), pour que la valeur soit '
         'immédiatement tangible.')
numbered('Présenter le rapport d\'import à 6 feuilles : c\'est l\'argument le plus '
         'concret pour convaincre une MSD qui gère aujourd\'hui ses campagnes sur '
         'papier.')
numbered('Mettre en avant la traçabilité infalsifiable : face à un litige avec un '
         'assuré ou une structure partenaire, le journal d\'audit protège la MSD.')
numbered('Chiffrer le coût de la NON-adhésion : temps perdu, doublons, cartes '
         'orphelines, erreurs de campagne — comparer au budget d\'adhésion.')
numbered('Valoriser le tiers-payant : l\'interconnexion avec les structures '
         'partenaires conventionnées est un service que le papier ne peut pas '
         'offrir.')
numbered('Prévoir un parcours « MSD pilote » : adhésion à tarif préférentiel pour '
         'les premières MSD d\'une région, avec accompagnement renforcé.')

doc.add_page_break()
para('— Fin de la Bible de la plateforme MUTUALIS / Portail CSU —',
     italic=True, align=WD_ALIGN_PARAGRAPH.CENTER)

out = 'Bible_Plateforme_MUTUALIS_MSD.docx'
try:
    doc.save(out)
except PermissionError:
    # Fichier ouvert dans Word : on génère sur un nom de secours pour ne pas
    # perdre la production. Relancer le script une fois Word fermé.
    out = 'Bible_Plateforme_MUTUALIS_MSD_v2.docx'
    doc.save(out)
print('Document généré :', out)
