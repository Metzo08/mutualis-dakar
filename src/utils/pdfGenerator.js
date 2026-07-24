import { jsPDF } from 'jspdf';
import { SENEGAL_FLAG_BASE64, UNAMUSC_LOGO_BASE64 } from './pdfImages';

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
    doc.addImage(SENEGAL_FLAG_BASE64, 'JPEG', 14, 10, 30, 20);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.rect(14, 10, 30, 20, 'S');
  } catch (e) {
    console.warn("Flag render warning:", e);
  }

  // B. Image Réelle du Logo UNAMUSC Sénégal (Top Right)
  try {
    doc.addImage(UNAMUSC_LOGO_BASE64, 'PNG', pageWidth - 42, 8, 28, 26);
  } catch (e) {
    console.warn("UNAMUSC Logo render warning:", e);
  }

  // C. Texte Officiel Central
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('RÉPUBLIQUE DU SÉNÉGAL', pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Un Peuple — Un But — Une Foi', pageWidth / 2, 18, { align: 'center' });
  doc.text('Ministère de la Santé et de l\'Action Sociale', pageWidth / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text('UNAMUSC SÉNÉGAL (SEN-CSU)', pageWidth / 2, 27, { align: 'center' });

  // ---------------------------------------------------------------------------
  // 2. LIGNE DE SÉPARATION TRICOLORE DU SÉNÉGAL (VERT - JAUNE - ROUGE)
  // ---------------------------------------------------------------------------
  doc.setFillColor(0, 133, 63);
  doc.rect(14, 34, 60, 2.5, 'F');
  doc.setFillColor(253, 239, 66);
  doc.rect(74, 34, 62, 2.5, 'F');
  doc.setFillColor(227, 27, 35);
  doc.rect(136, 34, 60, 2.5, 'F');

  // ---------------------------------------------------------------------------
  // 3. BANNIÈRE PRINCIPALE DU DOCUMENT
  // ---------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Deep Navy
  doc.roundedRect(14, 40, 182, 32, 4, 4, 'F');

  // Badge Statut Émeraude
  doc.setFillColor(5, 150, 105);
  doc.roundedRect(20, 45, 64, 6, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`● ${docType.toUpperCase()}`, 24, 49);

  // Grand Titre du Document
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 20, 59);

  // Référence & Horodatage
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Référence : ${referenceNo}  •  Émis le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 20, 66);

  // ---------------------------------------------------------------------------
  // 4. CARTE D'IDENTIFICATION ASSURÉ & STRUCTURE SÉNÉGAL
  // ---------------------------------------------------------------------------
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 77, 182, 30, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSURÉ(E) BÉNÉFICIAIRE :', 20, 84);

  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(beneficiaryName, 20, 93);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(5, 150, 105);
  doc.text(`N° CARTE CMU : ${cmuNumber}`, 20, 100);

  // Structure d'Accueil (À Droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('STRUCTURE D\'ACCUEIL SÉNÉGAL :', 115, 84);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const splitStructure = doc.splitTextToSize(structureName, 75);
  doc.text(splitStructure, 115, 91);

  // ---------------------------------------------------------------------------
  // 5. TABLEAU DÉTAILS DE LA PRESTATION / PRISE EN CHARGE
  // ---------------------------------------------------------------------------
  let currentY = 114;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('SPÉCIFICATIONS & DÉTAILS DE LA PRISE EN CHARGE :', 14, currentY);

  currentY += 6;

  // En-tête du Tableau
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 9, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('ÉLÉMENT DE PRESTATION', 20, currentY + 6);
  doc.text('VALEUR & MODALITÉS UNAMUSC', 100, currentY + 6);

  currentY += 12;

  // Lignes du tableau
  details.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY - 3, 182, 11, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(14, currentY + 8, 196, currentY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(String(item.label), 20, currentY + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const splitVal = doc.splitTextToSize(String(item.value), 90);
    doc.text(splitVal, 100, currentY + 3);

    currentY += Math.max(12, (splitVal.length * 5) + 6);
  });

  currentY += 4;

  // ---------------------------------------------------------------------------
  // 6. ENCADRÉ AVIS DE CONFORMITÉ & INSTRUCTIONS
  // ---------------------------------------------------------------------------
  doc.setFillColor(236, 253, 245); // Vert Émeraude ultra-clair
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, currentY, 182, 24, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text('✔ VALIDATION OFFICIELLE DU TIERS-PAYANT UNAMUSC SÉNÉGAL', 20, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  const splitNotes = doc.splitTextToSize(notes, 170);
  doc.text(splitNotes, 20, currentY + 13);

  currentY += 30;

  // ---------------------------------------------------------------------------
  // 7. CACHET OFFICIEL & SIGNATURE DIRECTION UNAMUSC
  // ---------------------------------------------------------------------------
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(1);
  doc.roundedRect(14, currentY, 82, 30, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text('AUTHENTIFICATION NUMÉRIQUE SEN-CSU', 18, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Cachet officiel de l\'Union Nationale', 18, 13 + currentY);
  doc.text(`HASH CNOM: 8F-9920-UNAMUSC-SN`, 18, 18 + currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('STATUT : VALIDE & CERTIFIÉ 🇸🇳', 18, 24 + currentY);

  // Bloc Signature Droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Pour le Bureau National UNAMUSC Sénégal', 125, currentY + 7);
  doc.text('& l\'Agence Nationale SEN-CSU', 125, currentY + 12);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Signé électroniquement par la Direction', 125, currentY + 20);

  // ---------------------------------------------------------------------------
  // 8. PIED DE PAGE PERMANENT
  // ---------------------------------------------------------------------------
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 280, 196, 280);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('UNAMUSC Sénégal — Union Nationale des Mutuelles de Santé Communautaires • Siège : Dakar, Sénégal', 14, 285);
  doc.text(`Page 1/1 • Document Officiel n° ${referenceNo} • Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 14, 285, { align: 'right' });

  // Téléchargement du fichier PDF
  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeFilename);
}
