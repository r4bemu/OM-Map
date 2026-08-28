import { jsPDF } from 'jspdf';
import {
  CAMBRIA_REGULAR_BASE64,
  CAMBRIA_BOLD_BASE64,
  CALIBRI_REGULAR_BASE64,
  CALIBRI_BOLD_BASE64,
  TRAJAN_PRO_REGULAR_BASE64
} from './wmrFontsBase64';

/**
 * Loads and registers official Cambria, Calibri, and Trajan Pro fonts into a jsPDF document instance.
 * - Cambria (normal, bold)
 * - Calibri (normal, bold)
 * - Trajan Pro (normal, bold)
 */
export function registerWmrCustomFonts(doc: jsPDF): { hasCambria: boolean; hasCalibri: boolean; hasTrajan: boolean } {
  let hasCambria = false;
  let hasCalibri = false;
  let hasTrajan = false;

  try {
    if (CAMBRIA_REGULAR_BASE64) {
      doc.addFileToVFS('Cambria.ttf', CAMBRIA_REGULAR_BASE64);
      doc.addFont('Cambria.ttf', 'Cambria', 'normal');
      hasCambria = true;
    }
    if (CAMBRIA_BOLD_BASE64) {
      doc.addFileToVFS('Cambria-Bold.ttf', CAMBRIA_BOLD_BASE64);
      doc.addFont('Cambria-Bold.ttf', 'Cambria', 'bold');
    }

    if (CALIBRI_REGULAR_BASE64) {
      doc.addFileToVFS('Calibri.ttf', CALIBRI_REGULAR_BASE64);
      doc.addFont('Calibri.ttf', 'Calibri', 'normal');
      hasCalibri = true;
    }
    if (CALIBRI_BOLD_BASE64) {
      doc.addFileToVFS('Calibri-Bold.ttf', CALIBRI_BOLD_BASE64);
      doc.addFont('Calibri-Bold.ttf', 'Calibri', 'bold');
    }

    if (TRAJAN_PRO_REGULAR_BASE64) {
      doc.addFileToVFS('TrajanPro.ttf', TRAJAN_PRO_REGULAR_BASE64);
      doc.addFont('TrajanPro.ttf', 'TrajanPro', 'normal');
      doc.addFont('TrajanPro.ttf', 'TrajanPro', 'bold');
      hasTrajan = true;
    }
  } catch (err) {
    console.warn('Custom font registration failed in jsPDF:', err);
  }

  return { hasCambria, hasCalibri, hasTrajan };
}
