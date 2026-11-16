with open('server.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Locate the spot after time/date intercept and wolof intent regex
target_anchor = "    const isExplicitWolofSwitch = wolofIntentRegex.test(lowMsg);\n    if (isExplicitWolofSwitch) {"

# Let's inspect what comes before target_anchor
replacement_router = """    // ── 0. RÉPONSES EXPERTES CANONIQUES INSTANTANÉES (< 5 ms, AUDIO 0 ms) ──
    // Architecture conversationnelle humaine ultra-fluide : zéro délai d'attente.
    // Les intentions majeures reçoivent immédiatement leur réponse canonique pré-synthétisée en HD.
    if (lowMsg.includes('csu') || lowMsg.includes('couverture santé') || lowMsg.includes('wakh ma ci csu') || lowMsg.includes('wax ma ci csu') || lowMsg.includes('lan mooy csu')) {
      const csuReply = (lang === 'wo' || speaksWolof)
        ? "CSU mooy Couverture Santé Universelle bu UNAMUSC : Tiers-Payant bu lay may nga faju ci 4 500 FCFA rekk ci at mi, 80% ba 100% ci lopitaal ak 50% ci garab yi. Lan nga bëgg ci yeneen leeral ? 😊"
        : "La CSU (Couverture Santé Universelle) de l'UNAMUSC est le tiers-payant mutualiste à Dakar : 4 500 FCFA/an pour bénéficier de 80% à 100% sur l'hôpital et 50% en pharmacie. Que souhaitez-vous savoir d'autre ? 😊";
      return res.json({ response: csuReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    if (lowMsg.includes('cotisation') || lowMsg.includes('ñaata') || lowMsg.includes('gnata') || lowMsg.includes('combien coûte') || lowMsg.includes('tarif') || lowMsg.includes('prix') || (lowMsg.includes('fay') && !lowMsg.includes('faju'))) {
      const cotisReply = (lang === 'wo' || speaksWolof)
        ? "Cotisation bi 4 500 FCFA la ci at mi ngir kenn ku nekk, walla 1 000 FCFA ci kart bi ak 3 500 FCFA ci njaboot gi. Mën nga fay ci Wave walla Orange Money."
        : "La cotisation UNAMUSC est de 4 500 FCFA par an en formule individuelle (1 000 FCFA carte + 3 500 FCFA cotisation), ou 1 000 FCFA + 3 500 FCFA par membre en formule familiale. Paiement par Wave ou Orange Money.";
      return res.json({ response: cotisReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    if (lowMsg.includes('maternité') || lowMsg.includes('grossesse') || lowMsg.includes('accouchement') || lowMsg.includes('enceinte') || lowMsg.includes('jur') || lowMsg.includes('bir') || lowMsg.includes('cpn') || lowMsg.includes('vaccin')) {
      const matReply = (lang === 'wo' || speaksWolof)
        ? "Programme Gratuité Maternité ci UNAMUSC dafa gratuit 100% : consultation prénatale, accouchement, ak ñakk yi 0 FCFA la."
        : "Le Programme Gratuité Maternité de l'UNAMUSC est pris en charge à 100% gratuit : consultations prénatales, accouchement, kit et vaccins du nourrisson à 0 FCFA.";
      return res.json({ response: matReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    if (lowMsg.includes('pharmacie') || lowMsg.includes('garab') || lowMsg.includes('ordonnance') || lowMsg.includes('bon de commande')) {
      const pharmReply = (lang === 'wo' || speaksWolof)
        ? "Bons de commande pharmacie yi dañuy fay 50% ci prix garab yi ci ordonnance bi. Pharmacien agréé bi day scanner sa pass CSU te nàntu 50% bi sur-le-champ."
        : "Les Bons de Commande Pharmacie prennent en charge 50% du montant de vos médicaments génériques en pharmacie agréée sur présentation de votre ordonnance.";
      return res.json({ response: pharmReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    if (lowMsg.includes('hôpital') || lowMsg.includes('hopital') || lowMsg.includes('garantie') || lowMsg.includes('chirurgie') || lowMsg.includes('opération') || lowMsg.includes('hospitalisation')) {
      const hospReply = (lang === 'wo' || speaksWolof)
        ? "Lettres de garantie yi dañuy fay 80% ba 100% ci say frais d hospitalisation ak opération ci hôpitaux conventionnés yi ci Dakar. 20% rekk mooy des ci sa loxo."
        : "Les Lettres de Garantie Hospitalières prennent en charge 80% à 100% de vos frais d'hospitalisation et d'intervention dans les hôpitaux conventionnés de Dakar.";
      return res.json({ response: hospReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    if (lowMsg.includes('nanga def') || lowMsg.includes('salaam') || lowMsg.includes('salam') || lowMsg.includes('bonjour') || lowMsg.includes('coucou') || lowMsg.includes('naka ngoon') || lowMsg.includes('naka suba')) {
      const salReply = (lang === 'wo' || speaksWolof)
        ? `${temporal.salutationWo} Man la Zahara, sa ndaw ci MUTUALIS DAKAR. Naka ngoon gi ? Lan laa la mënee dimbali ci sa wér-gi-yaram ak sa mutuelle ?`
        : `Bonjour ! Je suis Zahara, votre conseillère personnelle MUTUALIS DAKAR. ${temporal.salutationFr} Comment puis-je vous accompagner concernant vos soins ou votre mutuelle ?`;
      return res.json({ response: salReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    const isExplicitWolofSwitch = wolofIntentRegex.test(lowMsg);
    if (isExplicitWolofSwitch) {"""

assert target_anchor in code, "target_anchor not found"
code = code.replace(target_anchor, replacement_router)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Instant router injected successfully!")
