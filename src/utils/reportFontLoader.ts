import { jsPDF } from 'jspdf';

/**
 * Loads and registers official Cambria, Calibri, and Trajan Pro fonts into a jsPDF document instance.
 * Dynamically loaded on-demand so initial application / login bundle does not include 8MB of font data.
 * - Cambria (normal, bold)
 * - Calibri (normal, bold)
 * - Trajan Pro (normal, bold)
 */
export async function registerWmrCustomFonts(doc: jsPDF): Promise<{ hasCambria: boolean; hasCalibri: boolean; hasTrajan: boolean }> {
  let hasCambria = false;
  let hasCalibri = false;
  let hasTrajan = false;

  try {
    const {
      CAMBRIA_REGULAR_BASE64,
      CAMBRIA_BOLD_BASE64,
      CALIBRI_REGULAR_BASE64,
      CALIBRI_BOLD_BASE64,
      TRAJAN_PRO_REGULAR_BASE64
    } = await import('./wmrFontsBase64');

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
