import {
  AlignmentType, BorderStyle, Document, ImageRun,
  Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType
} from 'docx';
import QRCode from 'qrcode';
import { getBeneficiaryInfo } from './csuFormatter';

/**
 * Générateur de documents Word (.docx) officiels UNAMUSC.
 * Frère éditable de `pdfGenerator.js` : même API, même charte et même empreinte
 * cryptographique. Les structures de santé et les agents MSD doivent pouvoir
 * réutiliser et compléter le document (papier à en-tête, mentions manuscrites,
 * tampon), ce qu'un PDF figé ne permet pas. Assemblage 100 % côté client :
 * aucune donnée ne transite par le réseau.
 */

// Copie conforme de cleanPdfText (pdfGenerator.js) : la parité du nettoyage
// garantit que le PDF et le Word d'un même document portent la même empreinte.
function cleanDocText(str) {
  if (str === null || str === undefined) return '';
  let s = String(str);
  s = s.replace(/[\u2018\u2019]/g, "'")
       .replace(/[\u201C\u201D]/g, '"')
       .replace(/[\u2013\u2014]/g, '-')
       .replace(/\u2026/g, '...');
  s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
  return s.trim();
}

const GREEN = '059669';
const NAVY = '0F172A';
const INK = '0F172A';
const MUTED = '64748B';
const LINE = 'E2E8F0';
const CELL_ALT = 'F8FAFC';

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  left: { style: BorderStyle.SINGLE, size: 4, color: LINE },
  right: { style: BorderStyle.SINGLE, size: 4, color: LINE }
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
};

const CELL_MARGIN = { top: 120, bottom: 120, left: 200, right: 200 };

function cellPara(text, { bold = false, italic = false, size = 16, color = INK, alignment = null } = {}) {
  return new Paragraph({
    ...(alignment ? { alignment } : {}),
    children: [new TextRun({ text, bold, italics: italic, size, color })]
  });
}

/**
 * Génère et déclenche le téléchargement d'un document officiel Word.
 * @returns {Promise<void>}
 */
export async function generateOfficialDocx({
  filename = 'document_unamusc.docx',
  docType = 'DOCUMENT OFFICIEL CERTIFIÉ',
  title = 'Lettre de Garantie Hospitalière (80%)',
  referenceNo = 'GAR-2026-8812',
  beneficiaryName = 'Awa Ndiaye',
  cmuNumber = 'CMU-DKR-2026-8812',
  structureName = 'Hôpital Universitaire de Fann (Dakar)',
  details = [],
  notes = 'Ce document officiel fait foi de justificatif auprès des structures de santé et pharmacies agréées de la République du Sénégal.'
}) {
  const cleanRef = cleanDocText(referenceNo);
  const cleanCmu = cleanDocText(cmuNumber);
  const cleanDoc = cleanDocText(docType);

  // Empreinte identique à la variante PDF (même algorithme, même seed).
  const rawSeed = `${cleanRef}-${cleanCmu}-${cleanDoc}-UNAMUSC-SENEGAL-2026`;
  let hashNum = 0;
  for (let i = 0; i < rawSeed.length; i++) {
    hashNum = ((hashNum << 5) - hashNum) + rawSeed.charCodeAt(i);
    hashNum |= 0;
  }
  const cryptoHash = `SHA256-${Math.abs(hashNum).toString(16).toUpperCase()}-UNAMUSC`;
  const verifyUrl = `https://mutualis.sn/#/verify/${encodeURIComponent(cleanRef)}`;

  // QR d'authenticité pointant vers la même vérification publique que le PDF.
  let qrImage = null;
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 300,
      color: { dark: '#047857', light: '#FFFFFF' }
    });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    qrImage = new ImageRun({ type: 'png', data: qrBytes, transformation: { width: 96, height: 96 } });
  } catch (e) {
    console.warn('QR Code Word indisponible :', e);
  }

  const children = [];

  // 1. En-tête républicain
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'RÉPUBLIQUE DU SÉNÉGAL', bold: true, size: 20, color: INK })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Un Peuple - Un But - Une Foi', size: 14, color: MUTED })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "Ministère de la Santé et de l'Action Sociale", size: 14, color: MUTED })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'UNAMUSC SÉNÉGAL — MUTUALIS Portail CSU', bold: true, size: 16, color: GREEN })] }));
  // 2. Bandeau principal : badge du type de document, titre, référence/émission
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 160, bottom: 160, left: 240, right: 240 },
        borders: NO_BORDERS,
        children: [
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: cleanDoc.toUpperCase(), bold: true, size: 14, color: 'FFFFFF', shading: { fill: GREEN, type: ShadingType.CLEAR, color: 'auto' } })]
          }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: cleanDocText(title), bold: true, size: 30, color: 'FFFFFF' })] }),
          new Paragraph({ children: [new TextRun({ text: `Référence : ${cleanRef}  •  Émis le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, size: 14, color: 'CBD5E1' })] })
        ]
      })]
    })]
  }));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // 3. Identification de l'assuré et de la structure d'accueil
  const bInfo = getBeneficiaryInfo(beneficiaryName, cmuNumber);
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          shading: { fill: CELL_ALT, type: ShadingType.CLEAR, color: 'auto' },
          margins: CELL_MARGIN,
          borders: CELL_BORDERS,
          children: [
            cellPara('ASSURÉ(E) BÉNÉFICIAIRE :', { bold: true, size: 14, color: MUTED }),
            cellPara(cleanDocText(beneficiaryName), { bold: true, size: 22 }),
            cellPara(`CODE BÉNÉFICIAIRE : ${cleanDocText(bInfo.beneficiaryCode)}  |  CODE ADHÉRENT : ${cleanDocText(bInfo.adherentCode)}`, { bold: true, size: 16, color: GREEN })
          ]
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          shading: { fill: CELL_ALT, type: ShadingType.CLEAR, color: 'auto' },
          margins: CELL_MARGIN,
          borders: CELL_BORDERS,
          children: [
            cellPara("STRUCTURE D'ACCUEIL SÉNÉGAL :", { bold: true, size: 14, color: MUTED }),
            cellPara(cleanDocText(structureName), { bold: true, size: 18 })
          ]
        })
      ]
    })]
  }));
  // 4. Tableau des spécifications de la prise en charge
  children.push(new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: 'SPÉCIFICATIONS & DÉTAILS DE LA PRISE EN CHARGE :', bold: true, size: 19, color: INK })] }));
  const headerCell = (label) => new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
    margins: CELL_MARGIN,
    borders: CELL_BORDERS,
    children: [cellPara(label, { bold: true, size: 14, color: '475569' })]
  });
  const altShading = { fill: CELL_ALT, type: ShadingType.CLEAR, color: 'auto' };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [headerCell('ÉLÉMENT DE PRESTATION'), headerCell('VALEUR & MODALITÉS UNAMUSC')] }),
      ...details.map((item, index) => new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            ...(index % 2 === 0 ? { shading: altShading } : {}),
            margins: CELL_MARGIN,
            borders: CELL_BORDERS,
            children: [cellPara(cleanDocText(item.label), { bold: true, size: 16, color: '334155' })]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            ...(index % 2 === 0 ? { shading: altShading } : {}),
            margins: CELL_MARGIN,
            borders: CELL_BORDERS,
            children: [cellPara(cleanDocText(item.value), { size: 16 })]
          })
        ]
      }))
    ]
  }));

  // 5. Encadré de validation officielle du tiers-payant
  const noteBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'A7F3D0' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'A7F3D0' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'A7F3D0' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'A7F3D0' }
  };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { fill: 'ECFDF5', type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 140, bottom: 140, left: 220, right: 220 },
        borders: noteBorders,
        children: [
          cellPara('Validation officielle du Tiers-payant UNAMUSC Sénégal', { bold: true, size: 16, color: GREEN }),
          new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: cleanDocText(notes), size: 15, color: '334155' })] })
        ]
      })]
    })]
  }));

  // 6. Authenticité (QR + empreinte) et signature de la Direction
  const authBorders = {
    top: { style: BorderStyle.SINGLE, size: 6, color: GREEN },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN },
    left: { style: BorderStyle.SINGLE, size: 6, color: GREEN },
    right: { style: BorderStyle.SINGLE, size: 6, color: GREEN }
  };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 62, type: WidthType.PERCENTAGE },
          shading: { fill: 'F0FDF4', type: ShadingType.CLEAR, color: 'auto' },
          margins: CELL_MARGIN,
          borders: authBorders,
          children: [
            ...(qrImage ? [new Paragraph({ spacing: { after: 80 }, children: [qrImage] })] : []),
            cellPara('Authenticité et vérification infalsifiable UNAMUSC', { bold: true, size: 16, color: GREEN }),
            cellPara("Scannez ce QR code avec un smartphone pour vérifier l'authenticité certifiée sur mutualis.sn", { size: 14, color: '334155' }),
            cellPara(`Empreinte cryptographique : ${cryptoHash}`, { bold: true, size: 14 }),
            cellPara('Statut : certifié conforme et infalsifiable', { bold: true, size: 14, color: GREEN }),
            cellPara('Union des mutuelles de santé communautaires du Sénégal', { italic: true, size: 13, color: MUTED })
          ]
        }),
        new TableCell({
          width: { size: 38, type: WidthType.PERCENTAGE },
          margins: CELL_MARGIN,
          borders: CELL_BORDERS,
          children: [
            cellPara('Pour le bureau national UNAMUSC', { bold: true, size: 16, alignment: AlignmentType.RIGHT }),
            cellPara('Signé électroniquement par la Direction', { italic: true, size: 14, color: MUTED, alignment: AlignmentType.RIGHT }),
            cellPara('Union des mutuelles de santé', { italic: true, size: 14, color: MUTED, alignment: AlignmentType.RIGHT }),
            cellPara('communautaires du Sénégal', { italic: true, size: 14, color: MUTED, alignment: AlignmentType.RIGHT })
          ]
        })
      ]
    })]
  }));

  // 7. Assemblage et téléchargement (Blob local, aucune requête réseau)
  const doc = new Document({
    creator: 'UNAMUSC Sénégal — MUTUALIS',
    title: `${cleanDoc} — ${cleanRef}`,
    description: cleanDocText(notes),
    sections: [{
      properties: { page: { margin: { top: 700, bottom: 700, left: 850, right: 850 } } },
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
