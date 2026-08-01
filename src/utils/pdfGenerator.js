import { jsPDF } from 'jspdf';
import { SENEGAL_FLAG_BASE64, UNAMUSC_LOGO_BASE64 } from './pdfImages';
import { getBeneficiaryInfo } from './csuFormatter';

/**
 * Nettoie le texte des caractères émojis et symboles Unicode non gérés par la police Helvetica standard de jsPDF.
 */
function cleanPdfText(str) {
  if (str === null || str === undefined) return '';
  let s = String(str);
  
  // Remplacement des apostrophes et tirets typographiques par leurs équivalents ASCII
  s = s.replace(/[\u2018\u2019]/g, "'")
       .replace(/[\u201C\u201D]/g, '"')
       .replace(/[\u2013\u2014]/g, '-')
       .replace(/\u2026/g, '...');

  // Remplacement des émojis connus par du texte lisible
  s = s.replace(/💡/g, '[Conseil] ')
       .replace(/⚠️/g, '[Avis] ')
       .replace(/✅/g, '[Validé] ')
       .replace(/🏥/g, '')
       .replace(/🇸🇳/g, '')
       .replace(/👶/g, '')
       .replace(/💉/g, '')
       .replace(/🥗/g, '')
       .replace(/🍼/g, '')
       .replace(/🌡️/g, '')
       .replace(/📜/g, '')
       .replace(/⏱️/g, '')
       .replace(/💳/g, '')
       .replace(/👨‍⚕️/g, '')
       .replace(/👩‍⚕️/g, '');

  // Suppression uniquement des paires de surrogats Unicode (émojis 4 octets) sans toucher aux lettres accentuées françaises
  s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');

  return s.trim();
}

/**
 * Générateur de Documents PDF Officiels avec l'image du Drapeau du Sénégal 🇸🇳
 * et le Logo Officiel d'UNAMUSC Sénégal (Baobab & Personnes).
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
  // 1. EN-TÊTE OFFICIEL : DRAPEAU DU SÉNÉGAL (GAUCHE) & LOGO UNAMUSC (DROITE)
  // ---------------------------------------------------------------------------
  
  // A. Image Réelle du Drapeau du Sénégal (Top Left)
  try {
    doc.addImage(SENEGAL_FLAG_BASE64, 'JPEG', 14, 8, 28, 18);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(14, 8, 28, 18, 'S');
  } catch (e) {
    console.warn("Flag render warning:", e);
  }

  // B. Image Réelle du Logo UNAMUSC Sénégal (Top Right)
  try {
    doc.addImage(UNAMUSC_LOGO_BASE64, 'PNG', pageWidth - 40, 7, 26, 24);
  } catch (e) {
    console.warn("UNAMUSC Logo render warning:", e);
  }

  // C. Texte Officiel Central
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', pageWidth / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Un Peuple — Un But — Une Foi', pageWidth / 2, 16, { align: 'center' });
  doc.text('Ministère de la Santé et de l\'Action Sociale', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text('UNAMUSC SÉNÉGAL', pageWidth / 2, 25, { align: 'center' });

  // ---------------------------------------------------------------------------
  // 2. LIGNE DE SÉPARATION TRICOLORE DU SÉNÉGAL (VERT - JAUNE - ROUGE)
  // ---------------------------------------------------------------------------
  doc.setFillColor(0, 133, 63);
  doc.rect(14, 30, 60, 2, 'F');
  doc.setFillColor(253, 239, 66);
  doc.rect(74, 30, 62, 2, 'F');
  doc.setFillColor(227, 27, 35);
  doc.rect(136, 30, 60, 2, 'F');

  // ---------------------------------------------------------------------------
  // 3. BANNIÈRE PRINCIPALE DU DOCUMENT
  // ---------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Deep Navy
  doc.roundedRect(14, 36, 182, 28, 4, 4, 'F');

  // Badge Statut Émeraude dynamique
  const cleanBadgeText = cleanPdfText(docType).toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const textWidth = doc.getTextWidth(cleanBadgeText);
  const badgeWidth = Math.max(45, textWidth + 8);

  doc.setFillColor(5, 150, 105);
  doc.roundedRect(18, 40, badgeWidth, 5.5, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(cleanBadgeText, 22, 44);

  // Grand Titre du Document
  const cleanTitle = cleanPdfText(title);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  const splitTitle = doc.splitTextToSize(cleanTitle, 172);
  doc.text(splitTitle[0] || cleanTitle, 18, 52);

  // Référence & Horodatage
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Référence : ${cleanPdfText(referenceNo)}  •  Émis le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 18, 59);

  // ---------------------------------------------------------------------------
  // 4. CARTE D'IDENTIFICATION ASSURÉ & STRUCTURE SÉNÉGAL
  // ---------------------------------------------------------------------------
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, 68, 182, 26, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSURÉ(E) BÉNÉFICIAIRE :', 18, 74);

  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(cleanPdfText(beneficiaryName), 18, 81);

  const bInfo = getBeneficiaryInfo(beneficiaryName, cmuNumber);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text(`N° CSU BÉNÉFICIAIRE : ${cleanPdfText(bInfo.beneficiaryCode)}  |  CODE ADHÉRENT : ${cleanPdfText(bInfo.adherentCode)}`, 18, 88);

  // Structure d'Accueil (À Droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('STRUCTURE D\'ACCUEIL SÉNÉGAL :', 112, 74);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const splitStructure = doc.splitTextToSize(cleanPdfText(structureName), 78);
  doc.text(splitStructure, 112, 81);

  // ---------------------------------------------------------------------------
  // 5. TABLEAU DÉTAILS DE LA PRESTATION / PRISE EN CHARGE
  // ---------------------------------------------------------------------------
  let currentY = 100;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('SPÉCIFICATIONS & DÉTAILS DE LA PRISE EN CHARGE :', 14, currentY);

  currentY += 5;

  // En-tête du Tableau
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 8, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('ÉLÉMENT DE PRESTATION', 18, currentY + 5.5);
  doc.text('VALEUR & MODALITÉS UNAMUSC', 96, currentY + 5.5);

  currentY += 10;

  // Lignes du tableau avec calcul dynamique de la hauteur
  details.forEach((item, index) => {
    const cleanLabel = cleanPdfText(item.label);
    const cleanVal = cleanPdfText(item.value);
    const splitLabel = doc.splitTextToSize(cleanLabel, 72);
    const splitVal = doc.splitTextToSize(cleanVal, 96);
    const maxLines = Math.max(splitLabel.length, splitVal.length);
    const rowHeight = Math.max(8, (maxLines * 4) + 4);

    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY - 2, 182, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(splitLabel, 18, currentY + 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(splitVal, 96, currentY + 2.5);

    doc.setDrawColor(241, 245, 249);
    doc.line(14, currentY + rowHeight - 2, 196, currentY + rowHeight - 2);

    currentY += rowHeight;
  });

  currentY += 3;

  // ---------------------------------------------------------------------------
  // 6. ENCADRÉ AVIS DE CONFORMITÉ & INSTRUCTIONS
  // ---------------------------------------------------------------------------
  const cleanNotes = cleanPdfText(notes);
  const splitNotes = doc.splitTextToSize(cleanNotes, 172);
  const notesBoxHeight = Math.max(18, (splitNotes.length * 3.8) + 9);

  doc.setFillColor(236, 253, 245); // Vert Émeraude ultra-clair
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, currentY, 182, notesBoxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text('VALIDATION OFFICIELLE DU TIERS-PAYANT UNAMUSC SÉNÉGAL', 18, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(splitNotes, 18, currentY + 11);

  currentY += notesBoxHeight + 6;

  // ---------------------------------------------------------------------------
  // 7. CACHET OFFICIEL & SIGNATURE DIRECTION UNAMUSC (SANS CHEVAUCHEMENT)
  // ---------------------------------------------------------------------------
  // S'assurer que le bloc signature ne dépasse pas le bas de page
  if (currentY > 230) {
    currentY = 230;
  }

  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, currentY, 85, 26, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text('AUTHENTIFICATION NUMÉRIQUE UNAMUSC', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Cachet officiel de l\'Union Nationale', 18, currentY + 12);
  doc.text(`HASH CNOM: 8F-9920-UNAMUSC-SN`, 18, currentY + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('STATUT : VALIDE & CERTIFIÉ', 18, currentY + 22);

  // Bloc Signature Droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Pour le Bureau National UNAMUSC Sénégal', 115, currentY + 6);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Signé électroniquement par la Direction', 115, currentY + 14);

  // ---------------------------------------------------------------------------
  // 8. PIED DE PAGE PERMANENT NET & CLAIR (A4 Y = 280mm)
  // ---------------------------------------------------------------------------
  const footerY = 276;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, footerY, 196, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('UNAMUSC Sénégal — Union Nationale des Mutuelles de Santé Communautaires', 14, footerY + 5);
  doc.text('Page 1/1', pageWidth - 14, footerY + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Siège : Dakar, Sénégal  •  Document n° ${cleanPdfText(referenceNo)}  •  Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, 14, footerY + 10);

  // Téléchargement du fichier PDF
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeFilename);
}
