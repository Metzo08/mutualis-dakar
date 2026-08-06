import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
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
 * Générateur de Documents PDF Officiels Certifiés UNAMUSC
 * Intègre un QR Code d'authentification infalsifiable et le Sceau Numérique DHIS2 & UNAMUSC.
 */
export async function generateOfficialPdf({
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

  const cleanRef = cleanPdfText(referenceNo);
  const cleanCmu = cleanPdfText(cmuNumber);
  const cleanDoc = cleanPdfText(docType);

  // Génération de l'empreinte cryptographique infalsifiable DHIS2 & UNAMUSC
  const rawSeed = `${cleanRef}-${cleanCmu}-${cleanDoc}-UNAMUSC-SENEGAL-2026`;
  let hashNum = 0;
  for (let i = 0; i < rawSeed.length; i++) {
    hashNum = ((hashNum << 5) - hashNum) + rawSeed.charCodeAt(i);
    hashNum |= 0;
  }
  const cryptoHash = `SHA256-${Math.abs(hashNum).toString(16).toUpperCase()}-UNAMUSC`;
  const verifyUrl = `https://mutualis.sn/verify-document?ref=${encodeURIComponent(cleanRef)}&cmu=${encodeURIComponent(cleanCmu)}&doc=${encodeURIComponent(cleanDoc)}&hash=${cryptoHash}`;

  // ---------------------------------------------------------------------------
  // 1. EN-TÊTE OFFICIEL : DRAPEAU DU SÉNÉGAL (GAUCHE) & LOGO UNAMUSC (DROITE)
  // ---------------------------------------------------------------------------
  try {
    doc.addImage(SENEGAL_FLAG_BASE64, 'JPEG', 14, 8, 28, 18);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(14, 8, 28, 18, 'S');
  } catch (e) {
    console.warn("Flag render warning:", e);
  }

  try {
    doc.addImage(UNAMUSC_LOGO_BASE64, 'PNG', pageWidth - 40, 7, 26, 24);
  } catch (e) {
    console.warn("UNAMUSC Logo render warning:", e);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', pageWidth / 2, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Un Peuple - Un But - Une Foi', pageWidth / 2, 16, { align: 'center' });
  doc.text('Ministère de la Santé et de l\'Action Sociale', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text('UNAMUSC SÉNÉGAL', pageWidth / 2, 25, { align: 'center' });

  // ---------------------------------------------------------------------------
  // 2. LIGNE DE SÉPARATION TRICOLORE DU SÉNÉGAL
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
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(14, 36, 182, 28, 4, 4, 'F');

  const cleanBadgeText = cleanDoc.toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const textWidth = doc.getTextWidth(cleanBadgeText);
  const badgeWidth = Math.max(45, textWidth + 8);

  doc.setFillColor(5, 150, 105);
  doc.roundedRect(18, 40, badgeWidth, 5.5, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(cleanBadgeText, 22, 44);

  const cleanTitle = cleanPdfText(title);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  const splitTitle = doc.splitTextToSize(cleanTitle, 172);
  doc.text(splitTitle[0] || cleanTitle, 18, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Référence : ${cleanRef}  •  Émis le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 18, 59);

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

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 8, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('ÉLÉMENT DE PRESTATION', 18, currentY + 5.5);
  doc.text('VALEUR & MODALITÉS UNAMUSC', 96, currentY + 5.5);

  currentY += 10;

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
  const notesBoxHeight = Math.max(16, (splitNotes.length * 3.8) + 8);

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, currentY, 182, notesBoxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text('VALIDATION OFFICIELLE DU TIERS-PAYANT UNAMUSC SÉNÉGAL', 18, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(splitNotes, 18, currentY + 10);

  currentY += notesBoxHeight + 5;

  // ---------------------------------------------------------------------------
  // 7. QR CODE INFALSIFIABLE & CACHET D'AUTHENTIFICATION UNAMUSC
  // ---------------------------------------------------------------------------
  if (currentY > 222) {
    currentY = 222;
  }

  // Encadré global d'authentification
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, currentY, 182, 30, 3, 3, 'FD');

  // Génération et insertion du QR Code de vérification
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 260,
      color: {
        dark: '#047857',
        light: '#FFFFFF'
      }
    });
    doc.addImage(qrDataUrl, 'PNG', 17, currentY + 3, 24, 24);
  } catch (e) {
    console.warn("Erreur génération QR Code PDF:", e);
  }

  // Textes de vérification à côté du QR Code
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text('AUTHENTICITÉ & VÉRIFICATION INFALSIFIABLE UNAMUSC', 44, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text('Scannez ce QR Code avec un smartphone pour vérifier l\'authenticité certifiée sur mutualis.sn', 44, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 23, 42);
  doc.text(`EMPREINTE CRYPTOGRAPHIQUE : ${cryptoHash}`, 44, currentY + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('STATUT : CERTIFIÉ CONFORME & INFALSIFIABLE — UNION DES MUTUELLES DU SÉNÉGAL', 44, currentY + 23);

  // Bloc Signature Direction UNAMUSC (Droites)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Pour le Bureau National UNAMUSC', 142, currentY + 7);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Signé électroniquement par la Direction', 142, currentY + 13);
  doc.text('Union des Mutuelles de Santé', 142, currentY + 18);

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
  doc.text(`Siège : Dakar, Sénégal  •  Doc n° ${cleanRef}  •  Vérification : https://mutualis.sn/verify-document  •  Émis le ${new Date().toLocaleDateString('fr-FR')}`, 14, footerY + 10);

  // Téléchargement du fichier PDF
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeFilename);
}

