import { jsPDF } from 'jspdf';

/**
 * Dessine l'Étoile Verte à 5 branches du Drapeau du Sénégal
 */
function drawSenegalStar(doc, cx, cy, outerRadius, innerRadius) {
  doc.setFillColor(0, 133, 63); // Vert Sénégal
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 === 0) ? outerRadius : innerRadius;
    const angle = (i * Math.PI / 5) - (Math.PI / 2);
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
  }
  
  // Remplissage du polygone de l'étoile
  doc.lines(
    points.map((p, idx) => {
      const prev = idx === 0 ? points[points.length - 1] : points[idx - 1];
      return [p.x - prev.x, p.y - prev.y];
    }),
    points[0].x,
    points[0].y,
    [1, 1],
    'F'
  );
}

/**
 * Dessine le Drapeau du Sénégal 🇸🇳 (Bande Verte, Jaune, Rouge avec Étoile Verte)
 */
function drawSenegalFlag(doc, x, y, width, height) {
  const stripeWidth = width / 3;

  // 1. Bande Verte (Gauche)
  doc.setFillColor(0, 133, 63);
  doc.rect(x, y, stripeWidth, height, 'F');

  // 2. Bande Jaune (Milieu)
  doc.setFillColor(253, 239, 66);
  doc.rect(x + stripeWidth, y, stripeWidth, height, 'F');

  // 3. Bande Rouge (Droite)
  doc.setFillColor(227, 27, 35);
  doc.rect(x + (stripeWidth * 2), y, stripeWidth, height, 'F');

  // 4. Étoile Verte au centre de la bande jaune
  const starCx = x + stripeWidth + (stripeWidth / 2);
  const starCy = y + (height / 2);
  const outerR = Math.min(stripeWidth, height) * 0.28;
  const innerR = outerR * 0.4;
  drawSenegalStar(doc, starCx, starCy, outerR, innerR);

  // Contour fin autour du drapeau
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height, 'S');
}

/**
 * Générateur de Documents PDF Officiels de Haute Qualité — UNAMUSC Sénégal
 */
export function generateOfficialPdf({
  filename = 'document_unamusc.pdf',
  docType = 'DOCUMENT OFFICIEL CERTIFIÉ',
  title = 'Lettre de Garantie Hospitalière (80%)',
  referenceNo = 'GAR-2026-8812',
  beneficiaryName = 'Awa Ndiaye',
  cmuNumber = 'CMU-DKR-2026-8812',
  structureName = 'Hôpital Universitaire de Fann (Dakar)',
  details = [],
  notes = 'Ce document officiel fait foi de justificatif auprès des structures de santé et pharmacies agréées de la République du Sénégal.'
}) {
  const doc = new jsPDF();
  const pageWidth = 210;

  // ---------------------------------------------------------------------------
  // 1. DESSIN DU DRAPEAU DU SÉNÉGAL (En-tête Haut Gauche)
  // ---------------------------------------------------------------------------
  drawSenegalFlag(doc, 14, 12, 27, 18);

  // ---------------------------------------------------------------------------
  // 2. EN-TÊTE RÉPUBLIQUE DU SÉNÉGAL & UNAMUSC
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', 46, 17);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Un Peuple — Un But — Une Foi', 46, 22);
  doc.text('Ministère de la Santé et de l\'Action Sociale', 46, 26);

  // Titre UNAMUSC Droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text('UNAMUSC SÉNÉGAL', pageWidth - 14, 17, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Couverture Sanitaire Universelle (SEN-CSU)', pageWidth - 14, 22, { align: 'right' });
  doc.text('Tiers-Payant Électronique National', pageWidth - 14, 26, { align: 'right' });

  // Ligne de Séparation Tricolore (Vert - Jaune - Rouge)
  doc.setFillColor(0, 133, 63);
  doc.rect(14, 33, 60, 2, 'F');
  doc.setFillColor(253, 239, 66);
  doc.rect(74, 33, 62, 2, 'F');
  doc.setFillColor(227, 27, 35);
  doc.rect(136, 33, 60, 2, 'F');

  // ---------------------------------------------------------------------------
  // 3. BANNIÈRE PRINCIPALE DU DOCUMENT
  // ---------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Navy Foncé Premium
  doc.roundedRect(14, 39, 182, 32, 4, 4, 'F');

  // Badge Statut
  doc.setFillColor(5, 150, 105); // Émeraude
  doc.roundedRect(20, 44, 60, 6, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`● ${docType.toUpperCase()}`, 24, 48);

  // Grand Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 20, 58);

  // Référence & Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Référence : ${referenceNo}  •  Émis le : ${new Date().toLocaleDateString('fr-FR')}`, 20, 65);

  // ---------------------------------------------------------------------------
  // 4. CARTE D'IDENTIFICATION DU BÉNÉFICIAIRE
  // ---------------------------------------------------------------------------
  doc.setFillColor(241, 245, 249); // Slate Clair
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 76, 182, 30, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('IDENTIFICATION DE L\'ASSURÉ(E) BENÉFICIAIRE', 20, 83);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(beneficiaryName, 20, 92);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text(`N° CARTE CMU : ${cmuNumber}`, 20, 99);

  // Établissement Recepteur (A Droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('STRUCTURE D\'ACCUEIL SÉNÉGAL :', 115, 83);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const splitStr = doc.splitTextToSize(structureName, 75);
  doc.text(splitStr, 115, 90);

  // ---------------------------------------------------------------------------
  // 5. TABLEAU DÉTAILS DE LA PRESTATION / PRISE EN CHARGE
  // ---------------------------------------------------------------------------
  let currentY = 114;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('SPÉCIFICATIONS & DÉTAILS DE LA PRISE EN CHARGE :', 14, currentY);

  currentY += 6;

  // En-tête Tableau
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 9, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('ÉLÉMENT DE PRATION', 20, currentY + 6);
  doc.text('VALEUR & MODALITÉS UNAMUSC', 100, currentY + 6);

  currentY += 12;

  // Lignes des détails
  details.forEach((item, index) => {
    // Fond alterné
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY - 3, 182, 11, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(14, currentY + 8, 196, currentY + 8);

    // Libellé
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(String(item.label), 20, currentY + 3);

    // Valeur
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const splitVal = doc.splitTextToSize(String(item.value), 90);
    doc.text(splitVal, 100, currentY + 3);

    currentY += Math.max(12, (splitVal.length * 5) + 6);
  });

  currentY += 6;

  // ---------------------------------------------------------------------------
  // 6. ENCADRÉ AVIS DE CONFORMITÉ & INSTRUCTIONS
  // ---------------------------------------------------------------------------
  doc.setFillColor(236, 253, 245); // Vert très clair émeraude
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, currentY, 182, 26, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text('✔ VALIDATION DU TIERS-PAYANT UNAMUSC', 20, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const splitNotes = doc.splitTextToSize(notes, 170);
  doc.text(splitNotes, 20, currentY + 14);

  currentY += 34;

  // ---------------------------------------------------------------------------
  // 7. CACHET OFFICIEL & BLOC DE SIGNATURE UNAMUSC
  // ---------------------------------------------------------------------------
  // Sceau / Stamp Officiel Gauche
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1);
  doc.roundedRect(14, currentY, 80, 32, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text('AUTHENTIFICATION NUMÉRIQUE', 20, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Code QR & Hachage Sécurisé CNOM', 20, 14 + currentY);
  doc.text(`HASH: 8F-9920-UNAMUSC-SN`, 20, 19 + currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('STATUT : VALIDE & CERTIFIÉ', 20, 26 + currentY);

  // Bloc Signature Droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Pour l\'Agence Nationale SEN-CSU', 130, currentY + 8);
  doc.text('& le Bureau UNAMUSC Sénégal', 130, currentY + 13);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Signé électroniquement par la Direction', 130, currentY + 22);

  // ---------------------------------------------------------------------------
  // 8. PIED DE PAGE BAS DE PAGE
  // ---------------------------------------------------------------------------
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 280, 196, 280);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('UNAMUSC Sénégal — Union Nationale des Mutuelles de Santé Communautaires • Siège : Dakar, Sénégal', 14, 285);
  doc.text(`Page 1/1 • Document Officiel n° ${referenceNo} • Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 14, 285, { align: 'right' });

  // Sauvegarde et téléchargement immédiat
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeFilename);
}
