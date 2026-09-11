import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FieldReport, PhotoAttachment } from '../types';
import { isReportInWeek } from './weekUtils';
import { NIA_LOGO_BASE64 } from './niaLogoBase64';
import { HEADER_LEFT_LOGO_BASE64, HEADER_RIGHT_LOGO_BASE64 } from './headerLogosBase64';
import { FOOTER_BACKGROUND_BASE64, FOOTER_ISO_LOGO_BASE64 } from './footerAssetsBase64';
import { registerWmrCustomFonts } from './reportFontLoader';
import { getUserSignatories, getDefaultFieldReportSignatories, getDefaultWmrSignatories } from './signatoriesConfig';
import { formatReportId } from './reportIdGenerator';
import { resolvePhotoAttachmentUrl } from './photoUtils';

// Helper to safely load an image URL into a base64 Data URL with natural dimension detection and fallback support
async function getBase64ImageFromUrl(url: string, fallbackUrl?: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url && !fallbackUrl) return null;
  const targetUrl = url || fallbackUrl || '';

  // Direct Data URL handling
  if (targetUrl.startsWith('data:image')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl: targetUrl,
          width: img.naturalWidth || 600,
          height: img.naturalHeight || 450
        });
      };
      img.onerror = () => {
        resolve({
          dataUrl: targetUrl,
          width: 600,
          height: 450
        });
      };
      img.src = targetUrl;
    });
  }

  // Helper to attempt fetch conversion
  const attemptFetch = async (u: string) => {
    try {
      const res = await fetch(u, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (dataUrl && dataUrl.startsWith('data:image')) {
          return new Promise<{ dataUrl: string; width: number; height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => {
              resolve({
                dataUrl,
                width: img.naturalWidth || 600,
                height: img.naturalHeight || 450
              });
            };
            img.onerror = () => resolve({ dataUrl, width: 600, height: 450 });
            img.src = dataUrl;
          });
        }
      }
    } catch (_) {}
    return null;
  };

  // 1. Try primary URL via fetch
  const primaryResult = await attemptFetch(targetUrl);
  if (primaryResult) return primaryResult;

  // 2. Try fallback URL via fetch if different
  if (fallbackUrl && fallbackUrl !== targetUrl) {
    const fallbackResult = await attemptFetch(fallbackUrl);
    if (fallbackResult) return fallbackResult;
  }

  // 3. Fallback: HTML Canvas Image Loader
  const attemptCanvas = (u: string) => new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 600;
        canvas.height = img.naturalHeight || img.height || 450;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataURL = canvas.toDataURL('image/jpeg', 0.90);
          resolve({
            dataUrl: dataURL,
            width: canvas.width,
            height: canvas.height
          });
        } else {
          resolve(null);
        }
      } catch (err) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = u;
  });

  const canvasResult = await attemptCanvas(targetUrl);
  if (canvasResult) return canvasResult;

  if (fallbackUrl && fallbackUrl !== targetUrl) {
    return await attemptCanvas(fallbackUrl);
  }

  return null;
}

/**
 * Builds a complete, pixel-perfect official NIA Field Report PDF document
 */
export function getUnabbreviatedImoName(rawImo?: string): string {
  if (!rawImo) return 'MINDORO ORIENTAL-MARINDUQUE-ROMBLON IRRIGATION MANAGEMENT OFFICE';
  const lower = rawImo.toLowerCase();
  if (lower.includes('palawan')) {
    return 'PALAWAN IRRIGATION MANAGEMENT OFFICE';
  }
  if (lower.includes('occidental')) {
    return 'OCCIDENTAL MINDORO IRRIGATION MANAGEMENT OFFICE';
  }
  if (lower.includes('oriental') || lower.includes('momaro') || lower.includes('romblon') || lower.includes('marinduque')) {
    return 'MINDORO ORIENTAL-MARINDUQUE-ROMBLON IRRIGATION MANAGEMENT OFFICE';
  }
  return 'REGIONAL OFFICE NO. IV-B (MIMAROPA)';
}

export function cleanNisDisplayName(rawNis?: string, fallback = 'Baco-Bucayao RIS'): string {
  if (!rawNis || /^\d+$/.test(String(rawNis).trim())) return fallback;
  const s = String(rawNis).trim();
  if (s.toLowerCase() === 'all nis' || s.toLowerCase() === 'all') return fallback;
  return s;
}

export async function generateReportPdf(report: FieldReport): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const { hasCambria, hasCalibri, hasTrajan } = registerWmrCustomFonts(doc);
  const cambriaFont = hasCambria ? 'Cambria' : 'times';
  const calibriFont = hasCalibri ? 'Calibri' : 'helvetica';
  const trajanFont = hasTrajan ? 'TrajanPro' : 'times';

  const fullImoName = getUnabbreviatedImoName(report.imoOffice);
  const cleanNis = cleanNisDisplayName(report.nisBinding, fullImoName.includes('OCCIDENTAL') ? 'Pagbahan RIS' : (fullImoName.includes('PALAWAN') ? 'Batang-Batang RIS' : 'Baco-Bucayao RIS'));
  const revStr = `Rev. ${(report.revisionNumber ?? 0).toString().padStart(2, '0')}`;

  // 1. Official Header (matching Photo Docs Report styling)
  // Left Double Logo (Malacañang + NIA) - Scaled to 90% (26.1mm x 13.95mm)
  try {
    doc.addImage(HEADER_LEFT_LOGO_BASE64, 'PNG', margin, 6.2, 26.1, 13.95);
  } catch (err) {
    console.warn('Could not add left header logo to PDF:', err);
  }

  // Header Text Lines next to the left logo
  // Line 1: Republic of the Philippines (Cambria, Bold)
  doc.setFont(cambriaFont, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text('Republic of the Philippines', 41, 9.5);

  // Line 2: OFFICE OF THE PRESIDENT (Cambria, Normal)
  doc.setFont(cambriaFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text('OFFICE OF THE PRESIDENT', 41, 13);

  // Line 3: NATIONAL IRRIGATION ADMINISTRATION (Authentic Trajan Pro / Bold)
  doc.setFont(trajanFont, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('NATIONAL IRRIGATION ADMINISTRATION', 41, 17.5);

  // Line 4: Full Un-abbreviated Office Name (Authentic Trajan Pro / Bold, reduced 1 level down, matching Line 3 font color)
  doc.setFont(trajanFont, 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(fullImoName, 41, 21.2);

  // Right Header Logo (Bagong Pilipinas / ISO) - Scaled to 90% (15.3mm x 14.85mm)
  try {
    doc.addImage(HEADER_RIGHT_LOGO_BASE64, 'PNG', pageWidth - margin - 15.3, 5.8, 15.3, 14.85);
  } catch (err) {
    console.warn('Could not add right header logo to PDF:', err);
  }

  // Document Title Badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, 26.5, contentWidth, 8.5, 1.5, 1.5, 'F');

  doc.setFont(cambriaFont, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const titleText = report.reportType === 'operational'
    ? 'FIELD OPERATIONAL STATUS REPORT'
    : 'FIELD MAINTENANCE & PHYSICAL ACCOMPLISHMENT REPORT';
  doc.text(titleText, pageWidth / 2, 32, { align: 'center' });

  // 2. Metadata Grid Table (Cleaned: Report ID relocated to footer; clean 3-row layout)
  const reportDate = report.createdAt ? new Date(report.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : 'N/A';

  const formattedReportId = formatReportId(report.id, report.revisionNumber);

  const metadataRows = [
    [
      { content: 'Reporter Name:', styles: { font: cambriaFont, fontStyle: 'bold' as const, textColor: [71, 85, 105] as [number, number, number] } },
      { content: report.reporterName || 'Field Personnel', styles: { font: cambriaFont, fontStyle: 'bold' as const, textColor: [15, 23, 42] as [number, number, number] } },
      { content: 'Report Date / Time:', styles: { font: cambriaFont, fontStyle: 'bold' as const, textColor: [71, 85, 105] as [number, number, number] } },
      { content: reportDate, styles: { font: cambriaFont, textColor: [15, 23, 42] as [number, number, number] } }
    ],
    [
      { content: 'IMO Office:', styles: { font: cambriaFont, fontStyle: 'bold' as const, textColor: [71, 85, 105] as [number, number, number] } },
      { content: fullImoName, styles: { font: cambriaFont, textColor: [15, 23, 42] as [number, number, number] } },
      { content: 'NIS:', styles: { font: cambriaFont, fontStyle: 'bold' as const, textColor: [71, 85, 105] as [number, number, number] } },
      { content: cleanNis, styles: { font: cambriaFont, textColor: [15, 23, 42] as [number, number, number] } }
    ],
    [
      { content: 'Work Status:', styles: { font: cambriaFont, fontStyle: 'bold' as const, textColor: [71, 85, 105] as [number, number, number] } },
      { 
        content: report.status === 'Suspended' && report.suspensionReason 
          ? `Suspended (${report.suspensionReason})` 
          : (report.status || 'Completed'), 
        styles: { 
          font: cambriaFont, 
          fontStyle: 'bold' as const, 
          textColor: (report.status === 'Suspended' 
            ? [225, 29, 72] 
            : report.status === 'In Progress' 
            ? [217, 119, 6] 
            : [16, 185, 129]) as [number, number, number] 
        } 
      },
      { content: 'Activity Mode:', styles: { font: cambriaFont, fontStyle: 'bold' as const, textColor: [71, 85, 105] as [number, number, number] } },
      { content: report.reportType === 'operational' ? 'Operational Status' : 'Maintenance Accomplishment', styles: { font: cambriaFont, textColor: [15, 23, 42] as [number, number, number] } }
    ]
  ];

  autoTable(doc, {
    startY: 37,
    margin: { left: margin, right: margin },
    body: metadataRows,
    theme: 'plain',
    styles: {
      font: cambriaFont,
      fontSize: 8.5,
      cellPadding: 1.6,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 63 },
      2: { cellWidth: 32 },
      3: { cellWidth: 61 }
    }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 3;

  // 3. Technical Accomplishment Table
  const performedByDisplay = Array.isArray(report.performedByList) && report.performedByList.length > 0
    ? report.performedByList.map(p => {
      if (p === 'IMO') return `by ${fullImoName}`;
      if (p === 'IA') return `by IA${report.performedByIA ? `: ${report.performedByIA}` : ''}`;
      return `by Others${report.performedByDetails ? `: ${report.performedByDetails}` : ''}`;
    }).join(' • ')
    : (typeof report.performedBy === 'string' ? report.performedBy : 'by IMO');

  const locCoords = report.secondLat !== undefined && report.secondLng !== undefined
    ? `Point 1: [${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}]\nPoint 2: [${report.secondLat.toFixed(5)}, ${report.secondLng.toFixed(5)}]`
    : `Coordinates: [${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}]`;

  const distVal = report.segmentDistanceFormatted || (report.segmentDistanceMeters ? `${(report.segmentDistanceMeters / 1000).toFixed(2)} km (${report.segmentDistanceMeters} m)` : 'N/A');

  const dimensionsVal = report.dimensionDetailsFormatted
    || (report.depthMeters && report.widthMeters
      ? `Depth: ${report.depthMeters}m | Width: ${report.widthMeters}m\nVolume: ${(report.calculatedVolumeM3 || report.desiltingVolumeM3 || 0).toLocaleString()} m³`
      : (report.calculatedVolumeM3 || report.desiltingVolumeM3
        ? `${(report.calculatedVolumeM3 || report.desiltingVolumeM3)?.toLocaleString()} m³`
        : (report.paintedAreaSqm ? `Painted: ${report.paintedAreaSqm.toLocaleString()} m²` : 'N/A')));

  // Deduplicate and resolve Canal Reach / Structure display string cleanly
  const canalSeg = (report.canalSegment || '').trim();
  const locName = (report.locationName || '').trim();
  let canalReachDisplay = '';
  if (canalSeg && locName) {
    const cLow = canalSeg.toLowerCase();
    const lLow = locName.toLowerCase();
    if (cLow === lLow) {
      canalReachDisplay = canalSeg;
    } else if (lLow.includes(cLow)) {
      canalReachDisplay = locName;
    } else if (cLow.includes(lLow)) {
      canalReachDisplay = canalSeg;
    } else {
      canalReachDisplay = `${canalSeg} (${locName})`;
    }
  } else {
    canalReachDisplay = canalSeg || locName || 'Main Canal Alignment';
  }

  const techRows = [
    ['Activity / Particulars', report.title || report.maintenanceActivity || 'Canal Maintenance'],
    ['Activity Category', String(report.maintenanceActivity || report.reportType)],
    ['Canal Reach / Structure', canalReachDisplay],
    ['Stationing & GPS Coordinates', locCoords],
    ['Accomplished Canal Distance', distVal],
    ['Performed / Executed By', performedByDisplay],
    ['Measurements & Volume', dimensionsVal],
    ['Remarks / Work Details', report.remarks || 'No additional remarks recorded.']
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Field Parameter', 'Technical Specifications & Verified Accomplishment']],
    body: techRows,
    theme: 'grid',
    headStyles: {
      font: cambriaFont,
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 2.2
    },
    styles: {
      font: cambriaFont,
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240]
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 132 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // 4. Photo Documentation Section (Symmetrical 2-Column Grid with Fixed 4:3 Aspect Ratio Frames & Top-Left Badges)
  const rawPhotos: PhotoAttachment[] = Array.isArray(report.photos) && report.photos.length > 0
    ? report.photos
    : (report.photoUrl ? [{ id: 'p1', url: report.photoUrl, stage: 'During' }] : []);

  if (rawPhotos.length > 0) {
    if (currentY > pageHeight - 75) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('PHOTO DOCUMENTATION LOG (BEFORE / DURING / AFTER)', margin, currentY);
    currentY += 4;

    const colGap = 6;
    const photoCardWidth = (contentWidth - colGap) / 2; // ~90mm each (symmetrical 2 columns)
    const photoCardHeight = photoCardWidth * 0.75; // 67.5mm fixed 4:3 aspect ratio

    for (let i = 0; i < rawPhotos.length; i += 2) {
      const pLeft = rawPhotos[i];
      const pRight = (i + 1 < rawPhotos.length) ? rawPhotos[i + 1] : null;

      // Extract clean captions (ignoring legacy photo name placeholders)
      const capLeftText = (pLeft.caption && !pLeft.caption.startsWith('Before #') && !pLeft.caption.startsWith('During #') && !pLeft.caption.startsWith('After #'))
        ? pLeft.caption.trim()
        : '';
      const capRightText = (pRight && pRight.caption && !pRight.caption.startsWith('Before #') && !pRight.caption.startsWith('During #') && !pRight.caption.startsWith('After #'))
        ? pRight.caption.trim()
        : '';

      doc.setFont(calibriFont, 'normal');
      doc.setFontSize(6.2);

      const capLeftLines = capLeftText ? doc.splitTextToSize(capLeftText, photoCardWidth - 4) : [];
      const capRightLines = capRightText ? doc.splitTextToSize(capRightText, photoCardWidth - 4) : [];

      const capLeftH = capLeftLines.length > 0 ? (capLeftLines.length * 2.8 + 2.5) : 0;
      const capRightH = capRightLines.length > 0 ? (capRightLines.length * 2.8 + 2.5) : 0;
      const rowCaptionH = Math.max(capLeftH, capRightH);

      const totalRowHeight = photoCardHeight + (rowCaptionH > 0 ? (rowCaptionH + 2) : 0);

      // Page break check before starting a new row
      if (currentY + totalRowHeight > pageHeight - 34) {
        doc.addPage();
        currentY = 16;
      }

      const rowPhotos = [
        { photo: pLeft, col: 0, capLines: capLeftLines },
        ...(pRight ? [{ photo: pRight, col: 1, capLines: capRightLines }] : [])
      ];

      for (const item of rowPhotos) {
        const p = item.photo;
        const x = margin + item.col * (photoCardWidth + colGap);
        const y = currentY;

        // Outer container frame (clean 0.4mm crisp border)
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.rect(x, y, photoCardWidth, photoCardHeight);

        // Background fill
        doc.setFillColor(248, 250, 252);
        doc.rect(x + 0.3, y + 0.3, photoCardWidth - 0.6, photoCardHeight - 0.6, 'F');

        // Embed Image fitted into 4:3 frame without stretching or compression
        const resolvedPhotoUrl = resolvePhotoAttachmentUrl(p);
        const fallbackPhotoUrl = p.thumbnailUrl || (p.driveFileId ? `/api/drive/photo/${p.driveFileId}` : (p.id ? `/api/drive/photo/${p.id}` : undefined));
        const imgObj = await getBase64ImageFromUrl(resolvedPhotoUrl, fallbackPhotoUrl);
        const isValidImage = Boolean(imgObj && imgObj.dataUrl && (imgObj.width || 0) > 20 && (imgObj.height || 0) > 20);
        
        if (isValidImage && imgObj) {
          try {
            const containerW = photoCardWidth - 0.6;
            const containerH = photoCardHeight - 0.6;
            const natW = imgObj.width || 4;
            const natH = imgObj.height || 3;
            const scale = Math.min(containerW / natW, containerH / natH);
            const drawW = natW * scale;
            const drawH = natH * scale;
            const drawX = x + 0.3 + (containerW - drawW) / 2;
            const drawY = y + 0.3 + (containerH - drawH) / 2;
            try {
              doc.addImage(imgObj.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
            } catch (e) {
              doc.addImage(imgObj.dataUrl, 'PNG', drawX, drawY, drawW, drawH);
            }
          } catch (e) {
            console.warn('Failed to embed photo image in PDF:', e);
          }
        } else {
          doc.setFont(cambriaFont, 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          const fallbackText = (!resolvedPhotoUrl || resolvedPhotoUrl === '') 
            ? '[Inspection Photo Pending Sync / Offline]'
            : (imgObj && (imgObj.width <= 20 || imgObj.height <= 20))
            ? '[Photo Placeholder - No Binary Uploaded]'
            : '[Image File Preview Not Accessible]';
          doc.text(fallbackText, x + photoCardWidth / 2, y + photoCardHeight / 2, { align: 'center' });
        }

        // Stage Badge on Top Left of Photo ("BEFORE" / "DURING" / "AFTER")
        const stage = (p.stage || 'Photo').toUpperCase();
        let badgeBg = [217, 119, 6]; // Amber During
        if (stage === 'BEFORE') badgeBg = [37, 99, 235]; // Royal Blue
        if (stage === 'AFTER') badgeBg = [5, 150, 105]; // Emerald Green

        doc.setFont(calibriFont, 'bold');
        doc.setFontSize(6.8);
        const badgeTextW = doc.getTextWidth(stage);
        const badgeW = Math.max(18, badgeTextW + 5);
        const badgeH = 5.2;
        const badgeX = x + 2;
        const badgeY = y + 2;

        doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(stage, badgeX + badgeW / 2, badgeY + 3.7, { align: 'center' });

        // Date, Coordinates & Canal Name Stamp on Bottom Right (Auto-Sized Width & Height)
        const photoTime = p.capturedAt
          ? new Date(p.capturedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : reportDate;

        const latStr = p.lat !== undefined ? p.lat.toFixed(6) : (report.lat ? report.lat.toFixed(6) : '');
        const lngStr = p.lng !== undefined ? p.lng.toFixed(6) : (report.lng ? report.lng.toFixed(6) : '');
        
        const canalName = (p.canalSegment || report.canalSegment || '').trim();
        const locName = (p.locationName || report.locationName || report.nisBinding || '').trim();
        let canalLocationLine = '';
        if (canalName && locName && !canalName.toLowerCase().includes(locName.toLowerCase())) {
          canalLocationLine = `${canalName} (${locName})`;
        } else {
          canalLocationLine = canalName || locName || 'Irrigation System';
        }

        doc.setFont(calibriFont, 'bold');
        doc.setFontSize(5.6);
        const dateW = doc.getTextWidth(photoTime);

        doc.setFont(calibriFont, 'normal');
        doc.setFontSize(5.0);
        const coordsW = (latStr && lngStr) ? doc.getTextWidth(`${latStr}°N, ${lngStr}°E`) : 0;

        doc.setFont(calibriFont, 'normal');
        doc.setFontSize(4.8);
        const canalW = canalLocationLine ? doc.getTextWidth(canalLocationLine) : 0;

        // Snugly auto-size width to the widest content line + 3.6mm padding
        const maxTextW = Math.max(dateW, coordsW, canalW);
        const ovW = Math.min(photoCardWidth - 3, Math.max(26, maxTextW + 3.6));

        let lineCount = 1;
        if (latStr && lngStr) lineCount++;
        if (canalLocationLine) lineCount++;

        const ovH = 1.8 + lineCount * 3.0;
        const ovX = x + photoCardWidth - ovW - 1.5;
        const ovY = y + photoCardHeight - ovH - 1.5;

        doc.saveGraphicsState();
        if ((doc as any).GState) {
          doc.setGState(new (doc as any).GState({ opacity: 0.35 }));
        }
        doc.setFillColor(0, 0, 0);
        doc.roundedRect(ovX, ovY, ovW, ovH, 0.8, 0.8, 'F');
        doc.restoreGraphicsState();

        let textY = ovY + 2.8;
        doc.setFont(calibriFont, 'bold');
        doc.setFontSize(5.6);
        doc.setTextColor(253, 224, 71); // Amber
        doc.text(photoTime, ovX + 1.8, textY);

        if (latStr && lngStr) {
          textY += 3.0;
          doc.setFont(calibriFont, 'normal');
          doc.setFontSize(5.0);
          doc.setTextColor(241, 245, 249);
          doc.text(`${latStr}°N, ${lngStr}°E`, ovX + 1.8, textY);
        }

        if (canalLocationLine) {
          textY += 3.0;
          doc.setFont(calibriFont, 'normal');
          doc.setFontSize(4.8);
          doc.setTextColor(226, 232, 240);
          doc.text(canalLocationLine, ovX + 1.8, textY, { maxWidth: ovW - 3.6 });
        }

        // Photo Caption BELOW the Photo (Structured, high-clarity boxed plate)
        if (item.capLines.length > 0) {
          const capBoxY = y + photoCardHeight + 1.2;
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(203, 213, 225); // Slate 300
          doc.setLineWidth(0.25);
          doc.roundedRect(x, capBoxY, photoCardWidth, rowCaptionH, 0.6, 0.6, 'FD');

          doc.setFont(calibriFont, 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(30, 41, 59); // Slate 800
          doc.text(item.capLines, x + 2, capBoxY + 2.8, { maxWidth: photoCardWidth - 4, lineHeightFactor: 1.15 });
        }
      }

      currentY += totalRowHeight + 5;
    }
  }

  // 5. Signatory Block
  if (currentY > pageHeight - 38) {
    doc.addPage();
    currentY = 18;
  }

  currentY = Math.max(currentY, pageHeight - 34);

  const defaultFieldSigs = getDefaultFieldReportSignatories(
    report.imoOffice,
    report.nisBinding,
    report.reporterName,
    report.reporterDesignation || report.reporterRole
  );

  const userSig = getUserSignatories(report.submittedByUserId).inspectionReport;
  const resolvedReporterName = report.reporterName || userSig.preparedByName || defaultFieldSigs.preparedByName || 'Field Personnel';
  const resolvedReporterDesig = report.reporterDesignation || report.reporterRole || userSig.preparedByTitle || defaultFieldSigs.preparedByTitle || 'Water Resource Officer';

  let rawVerifier = (report.verifierName || '').trim();
  let rawVerifierDesig = (report.verifierDesignation || '').trim();
  const isVerifierPlaceholder = !rawVerifier || 
    rawVerifier.toLowerCase() === 'immediate supervisor' || 
    rawVerifier.toLowerCase() === 'n/a' ||
    rawVerifier.toLowerCase() === 'none';

  if (isVerifierPlaceholder) {
    rawVerifier = defaultFieldSigs.reviewedByName;
    rawVerifierDesig = defaultFieldSigs.reviewedByTitle;
  }

  let rawApprover = (report.approvedBy || '').trim();
  let rawApproverDesig = (userSig.approvedByTitle || defaultFieldSigs.approvedByTitle || 'Division Manager A').trim();
  const isApproverPlaceholder = !rawApprover ||
    rawApprover.toLowerCase() === 'n/a' ||
    rawApprover.toLowerCase() === 'none';

  if (isApproverPlaceholder) {
    rawApprover = defaultFieldSigs.approvedByName;
    rawApproverDesig = defaultFieldSigs.approvedByTitle;
  }

  const hasVerifier = Boolean(rawVerifier && rawVerifier.trim().length > 0);
  const hasApprover = Boolean(rawApprover && rawApprover.trim().length > 0);

  doc.setFont(cambriaFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  if (hasVerifier && hasApprover) {
    // 3-Column Signatures: Prepared By | Reviewed By | Approved By
    const sigColWidth = contentWidth / 3;

    // Prepared By
    doc.text('Prepared by:', margin, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(resolvedReporterName, margin, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(resolvedReporterDesig, margin, currentY + 15);

    // Reviewed / Verified By
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Reviewed by:', margin + sigColWidth, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(rawVerifier, margin + sigColWidth, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(rawVerifierDesig, margin + sigColWidth, currentY + 15);

    // Approved By
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Approved by:', margin + sigColWidth * 2, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(rawApprover, margin + sigColWidth * 2, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(rawApproverDesig, margin + sigColWidth * 2, currentY + 15);
  } else if (hasVerifier && !hasApprover) {
    // 2-Column Signatures: Prepared By | Reviewed By (Approved By omitted e.g. Pula, Bansud, Bongabong)
    const reviewerX = margin + contentWidth * 0.60;

    // Prepared By
    doc.text('Prepared by:', margin, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(resolvedReporterName, margin, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(resolvedReporterDesig, margin, currentY + 15);

    // Reviewed By
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Reviewed by:', reviewerX, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(rawVerifier, reviewerX, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(rawVerifierDesig, reviewerX, currentY + 15);
  } else if (!hasVerifier && hasApprover) {
    // 2-Column Signatures: Prepared By | Approved By
    const approverX = margin + contentWidth * 0.60;

    // Prepared By
    doc.text('Prepared by:', margin, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(resolvedReporterName, margin, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(resolvedReporterDesig, margin, currentY + 15);

    // Approved By
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Approved by:', approverX, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(rawApprover, approverX, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(rawApproverDesig, approverX, currentY + 15);
  } else {
    // 1-Column Signature: Prepared By only
    doc.text('Prepared by:', margin, currentY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(resolvedReporterName, margin, currentY + 11);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(resolvedReporterDesig, margin, currentY + 15);
  }

  // 6. Footer: Relocated Report ID (bottom left, no label), Document No. (Calibri, italic, not bold), Editable Footnote, and Page # of ##
  const docNoStr = userSig.documentNo || 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01';
  const customFootnoteStr = userSig.customFootnote || '';
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Line 1: Report ID itself (Bottom Left, no "Report ID:" label)
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(formattedReportId, margin, pageHeight - 8.5);

    // Line 2: Document No. below Report ID in Calibri Font, not bold, Italic format
    doc.setFont(calibriFont, 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(docNoStr, margin, pageHeight - 5);

    // Optional Editable Footnote (Center)
    if (customFootnoteStr) {
      doc.setFont(cambriaFont, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(customFootnoteStr, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    // Bottom Right: Page # of ##
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }

  return doc;
}

/**
 * Builds a Blob and Object URL from a FieldReport for in-app PDF previewing
 */
export async function buildReportPdfBlob(report: FieldReport): Promise<{ blob: Blob; url: string; doc: jsPDF }> {
  const doc = await generateReportPdf(report);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url, doc };
}

/**
 * Downloads a FieldReport as an uncorrupted .pdf file
 */
export async function downloadReportPdf(report: FieldReport): Promise<void> {
  const doc = await generateReportPdf(report);
  const formattedId = formatReportId(report.id, report.revisionNumber).replace(/[^a-zA-Z0-9._-]/g, '_');
  doc.save(`Report_${formattedId}.pdf`);
}

// =========================================================================
// OFFICIAL WMR (FORM 691) & PHOTO DOCUMENTATION REAL PDF GENERATORS
// =========================================================================

export interface WmrSignatories {
  preparedByName: string;
  preparedByTitle: string;
  reviewedByName: string;
  reviewedByTitle: string;
  notedByName: string;
  notedByTitle: string;
  initialsNote?: string;
}

export interface WmrWeekInfo {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

const MIMAROPA_SYSTEMS_TAXONOMY = [
  {
    name: 'MOMARO IMO',
    shortName: 'MOMARO',
    systems: [
      { name: 'BACO-BUCAYAO RIS' },
      { name: 'MAG-ASAWANG TUBIG RIS' },
      { name: 'CANTINGAS RIS' },
      { name: 'PULA RIS' },
      { name: 'BANSUD RIS' }
    ]
  },
  {
    name: 'OCCIDENTAL MINDORO IMO',
    shortName: 'Occidental Mindoro',
    systems: [
      { name: 'MONGPONG RIS' },
      { name: 'AMNAY RIS' },
      { name: 'CAGURAY RIS' },
      { name: 'LUMINTAO RIS' },
      { name: 'PAGBAHAN RIS' }
    ]
  },
  {
    name: 'PALAWAN IMO',
    shortName: 'Palawan',
    systems: [
      { name: 'BATANG-BATANG RIS' },
      { name: 'MALATGAO RIS', division: 'DIVISION 1' },
      { name: 'MALATGAO RIS', division: 'DIVISION 2' }
    ]
  }
];

function parseStationingForPdf(locationName?: string, report?: FieldReport) {
  const loc = locationName || report?.locationName || '';
  const act = report?.maintenanceActivity || '';

  let fromStation = '';
  let toStation = '';
  let canalName = report?.canalSegment || '';
  let structureType = '';
  let structureStation = '';
  let structureUnits = '';
  let condition = 'In good condition / Maintained';

  const isStructure = act.includes('Dam') || act.includes('Intake') || act.includes('Gate') || act.includes('Diversion') || act.includes('Staff gauge') || act.includes('dredging');

  if (isStructure) {
    if (act.includes('Dam') || act.includes('dredging')) structureType = 'Dam';
    else if (act.includes('Intake')) structureType = 'Intake';
    else if (act.includes('Gate') || act.includes('Lubrication')) structureType = 'Steel gates';
    else if (act.includes('Staff gauge')) structureType = 'Staff gauge';
    else if (act.includes('Diversion')) structureType = 'Diversion works';
    else structureType = 'Structure';

    structureStation = '0+000.00';
    structureUnits = '1';

    if (act.includes('dredging') || act.includes('Brass dam')) condition = 'Washed-out brush dam';
    else if (act.includes('Gate') || act.includes('Rusty')) condition = 'Rusty';
    else if (act.includes('Staff gauge')) condition = 'Installation of staff gauge';
    else condition = 'Silted';
  } else {
    if (!canalName) {
      if (loc.includes('Lateral')) {
        const match = loc.match(/Lateral\s+[A-Z0-9-]+/i);
        canalName = match ? match[0] : 'Lateral Canal';
      } else {
        canalName = 'Main Canal';
      }
    }

    const actLower = act.toLowerCase();
    if (actLower.includes('desilting')) condition = 'Silted';
    else if (actLower.includes('brush dam') || actLower.includes('dredging') || actLower.includes('source')) condition = 'Silted intake basin';
    else if (actLower.includes('gate') || actLower.includes('lube') || actLower.includes('lubrication')) condition = 'Ungreased mechanism';
    else if (actLower.includes('temp') || actLower.includes('fix') || actLower.includes('emergency')) condition = 'Damaged embankment';
    else if (actLower.includes('repair') || actLower.includes('construction') || actLower.includes('lining')) condition = 'Dilapidated canal';
    else if (actLower.includes('road') || actLower.includes('service') || actLower.includes('surfacing')) condition = 'Uneven service road';
    else if (actLower.includes('paint') || actLower.includes('repainting')) condition = 'Corroded / faded paint';
    else if (actLower.includes('gauge') || actLower.includes('staff')) condition = 'Missing / faded gauge';
    else if (actLower.includes('herbicide') || actLower.includes('chemical') || actLower.includes('weed') || actLower.includes('vegetation') || actLower.includes('clearing')) condition = 'Heavy weed growth';
    else if (actLower.includes('farm ditch') || actLower.includes('lateral restoration')) condition = 'Silted farm ditch';
    else if (actLower.includes('other')) condition = 'Inspection required';
  }

  const stationMatches = loc.match(/(\d+\+\d+(\.\d+)?)/g);
  if (stationMatches && stationMatches.length >= 2) {
    fromStation = stationMatches[0];
    toStation = stationMatches[1];
  } else if (stationMatches && stationMatches.length === 1) {
    fromStation = stationMatches[0];
    if (structureType) structureStation = stationMatches[0];
  }

  return {
    fromStation,
    toStation,
    canalName,
    structureType,
    structureStation,
    structureUnits,
    condition
  };
}

/**
 * Generates official Form 691 (Weekly Maintenance Report) as a true vector PDF in Landscape orientation
 */
export async function generateWmrPdf(
  reports: FieldReport[],
  weekInfo: WmrWeekInfo,
  signatories: WmrSignatories,
  scopedImo?: string,
  scopedNis?: string
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 277mm

  // Register and initialize Cambria, Calibri & Trajan Pro fonts synchronously
  const { hasCambria, hasCalibri, hasTrajan } = registerWmrCustomFonts(doc);
  const cambriaFont = hasCambria ? 'Cambria' : 'times';
  const calibriFont = hasCalibri ? 'Calibri' : 'helvetica';
  const trajanFont = hasTrajan ? 'TrajanPro' : 'times';

  // 1. Official Header on Page 1
  // Left Double Logo (Malacañang + NIA)
  try {
    doc.addImage(HEADER_LEFT_LOGO_BASE64, 'PNG', margin, 5.5, 29, 15.5);
  } catch (err) {
    console.warn('Could not add left header logo to PDF:', err);
  }

  // Header Text Lines next to the left logo
  // Line 1: Republic of the Philippines (Cambria, Bold)
  doc.setFont(cambriaFont, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text('Republic of the Philippines', 41, 9.5);

  // Line 2: OFFICE OF THE PRESIDENT (Cambria, Normal / Unbold)
  doc.setFont(cambriaFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text('OFFICE OF THE PRESIDENT', 41, 13);

  // Line 3: NATIONAL IRRIGATION ADMINISTRATION (Authentic Trajan Pro, Bold)
  doc.setFont(trajanFont, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('NATIONAL IRRIGATION ADMINISTRATION', 41, 17.5);

  // Line 4: REGIONAL OFFICE NO. IV-B (MIMAROPA) (Authentic Trajan Pro, Bold)
  doc.setFont(trajanFont, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('REGIONAL OFFICE NO. IV-B (MIMAROPA)', 41, 21.5);

  // Right Header Logo
  try {
    doc.addImage(HEADER_RIGHT_LOGO_BASE64, 'PNG', pageWidth - margin - 17, 5, 17, 16.5);
  } catch (err) {
    console.warn('Could not add right header logo to PDF:', err);
  }

  // Subheader on the left (Cambria typography)
  doc.setFont(cambriaFont, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('WEEKLY MAINTENANCE REPORT', margin, 27);

  doc.setFont(cambriaFont, 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(0, 0, 0);
  doc.text(weekInfo.label, margin, 30.2);

  // Dynamic scope label and table banner based on user's access scope
  let scopeLabel = 'Region IV-B MIMAROPA';
  let tableBanner = 'MIMAROPA REGION';

  if (scopedNis && scopedNis !== 'All NIS' && scopedNis !== 'All') {
    scopeLabel = scopedNis;
    tableBanner = scopedNis.toUpperCase();
  } else if (scopedImo && scopedImo !== 'All IMOs' && scopedImo !== 'All') {
    scopeLabel = scopedImo;
    tableBanner = scopedImo.toUpperCase();
  }

  doc.setFont(cambriaFont, 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(50, 50, 50);
  doc.text(scopeLabel, margin, 33.2);

  // Filter reports matching selected Friday-ending week
  const weekReports = reports.filter(r => isReportInWeek(r, weekInfo.key));

  // Table Body Rows
  const tableBody: any[] = [];

  // Helper matching functions for IMO taxonomy
  const isMOMARO = (str: string) => str.includes('momaro') || str.includes('oriental') || str.includes('marinduque') || str.includes('romblon');
  const isOccidental = (str: string) => str.includes('occidental') || str.includes('omimo');
  const isPalawan = (str: string) => str.includes('palawan') || str.includes('pimo');

  // Filter IMO taxonomy based on scoped IMO
  let targetImos = [...MIMAROPA_SYSTEMS_TAXONOMY];
  if (scopedImo && scopedImo !== 'All IMOs' && scopedImo !== 'All') {
    const sLower = scopedImo.toLowerCase();
    targetImos = targetImos.filter(imo => {
      const imoLower = imo.name.toLowerCase();
      if (isMOMARO(sLower) && isMOMARO(imoLower)) return true;
      if (isOccidental(sLower) && isOccidental(imoLower)) return true;
      if (isPalawan(sLower) && isPalawan(imoLower)) return true;
      return imoLower.includes(sLower) || imo.shortName.toLowerCase().includes(sLower) || sLower.includes(imo.shortName.toLowerCase());
    });
  }

  const processedReportIds = new Set<string>();

  targetImos.forEach(imo => {
    const isOcc = isOccidental(imo.name.toLowerCase());
    const imoFillColor = isOcc ? [219, 234, 254] : [220, 252, 231];
    const nisFillColor = isOcc ? [239, 246, 255] : [240, 253, 244];

    // Filter systems if scopedNis is provided
    let targetSystems = [...imo.systems];
    if (scopedNis && scopedNis !== 'All NIS' && scopedNis !== 'All') {
      const nisTargetLower = scopedNis.toLowerCase();
      targetSystems = targetSystems.filter(nis => nis.name.toLowerCase().includes(nisTargetLower) || nisTargetLower.includes(nis.name.toLowerCase()));
    }
    if (targetSystems.length === 0) return;

    // IMO Banner Row
    tableBody.push([
      {
        content: imo.name,
        colSpan: 15,
        styles: {
          fillColor: imoFillColor,
          textColor: [0, 0, 0],
          font: cambriaFont,
          fontStyle: 'bold',
          fontSize: 6.5,
          cellPadding: 0.8
        }
      }
    ]);

    targetSystems.forEach(nis => {
      // Robust matching of reports for this NIS and IMO
      const nisLower = nis.name.toLowerCase();
      const imoLower = imo.name.toLowerCase();

      const matched = weekReports.filter(r => {
        if (!r || processedReportIds.has(r.id)) return false;
        const repImo = (r.imoOffice || '').toLowerCase();
        const repNis = (r.nisBinding || '').toLowerCase();
        const repLoc = (r.locationName || '').toLowerCase();
        const repCanal = (r.canalSegment || '').toLowerCase();

        let matchesImo = false;
        if (!repImo) {
          matchesImo = true;
        } else if (isMOMARO(imoLower) && isMOMARO(repImo)) {
          matchesImo = true;
        } else if (isOccidental(imoLower) && isOccidental(repImo)) {
          matchesImo = true;
        } else if (isPalawan(imoLower) && isPalawan(repImo)) {
          matchesImo = true;
        } else {
          matchesImo = repImo.includes(imo.shortName.toLowerCase()) || repImo.includes(imoLower) || imoLower.includes(repImo);
        }

        const matchesNis = repNis.includes(nisLower) || repLoc.includes(nisLower) || repCanal.includes(nisLower) || nisLower.includes(repNis);
        return matchesImo && (matchesNis || (repNis === '' && repLoc.includes(nisLower)));
      });

      matched.forEach(r => processedReportIds.add(r.id));

      const sysTitle = (nis as any).division ? `${nis.name} (${(nis as any).division})` : nis.name;
      tableBody.push([
        {
          content: sysTitle,
          colSpan: 15,
          styles: {
            fillColor: nisFillColor,
            textColor: [0, 0, 0],
            font: cambriaFont,
            fontStyle: 'bold',
            fontSize: 6,
            cellPadding: 0.7
          }
        }
      ]);

      // Date Sub-row under NIS
      tableBody.push([
        {
          content: weekInfo.label,
          colSpan: 15,
          styles: {
            fillColor: [255, 255, 255],
            textColor: [70, 70, 70],
            font: cambriaFont,
            fontStyle: 'italic',
            fontSize: 5.5,
            cellPadding: 0.6
          }
        }
      ]);

      if (matched.length === 0) {
        tableBody.push([
          '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          { content: 'No maintenance activities for this week.', styles: { font: cambriaFont, fontStyle: 'normal', textColor: [0, 0, 0], halign: 'center' } }
        ]);
      } else {
        matched.forEach((rep, rIdx) => {
          const parsed = parseStationingForPdf(rep.locationName, rep);
          const distKm = rep.segmentDistanceMeters ? (rep.segmentDistanceMeters / 1000).toFixed(3) : '';
          let remarks = rep.remarks || '';
          if (!remarks || remarks.startsWith('Maintenance activity performed')) {
            remarks = `${rep.maintenanceActivity || 'Maintenance activity'} along ${rep.locationName || nis.name} by ${rep.reporterName || 'NIA Field Team'}.`;
          }

          const isIA = rep.performedBy === 'IA' || (rep.reporterRole as string) === 'IA' || (rep.reporterRole === 'Field Personnel');

          tableBody.push([
            rIdx === 0 && (nis as any).division ? (nis as any).division : '',
            parsed.canalName || rep.canalSegment || 'Main Canal',
            distKm,
            parsed.structureUnits || (parsed.structureType ? '1' : ''),
            isIA ? '✓' : '',
            !isIA ? '✓' : '',
            parsed.fromStation || (rep.segmentDistanceMeters ? '0+000' : ''),
            parsed.toStation || (rep.segmentDistanceMeters ? `${rep.segmentDistanceMeters.toFixed(0)}m` : ''),
            distKm,
            !parsed.structureType ? parsed.condition : '',
            parsed.structureType,
            parsed.structureStation,
            parsed.structureUnits,
            parsed.structureType ? parsed.condition : '',
            remarks
          ]);
        });
      }
    });

    // Dynamic NIS Catch-All for any remaining reports belonging to this IMO
    const imoLower = imo.name.toLowerCase();
    const remainingImoReports = weekReports.filter(r => {
      if (!r || processedReportIds.has(r.id)) return false;
      const repImo = (r.imoOffice || '').toLowerCase();
      if (!repImo) return false;
      if (isMOMARO(imoLower) && isMOMARO(repImo)) return true;
      if (isOccidental(imoLower) && isOccidental(repImo)) return true;
      if (isPalawan(imoLower) && isPalawan(repImo)) return true;
      return repImo.includes(imo.shortName.toLowerCase()) || repImo.includes(imoLower);
    });

    if (remainingImoReports.length > 0) {
      // Group remaining reports by nisBinding or locationName
      const groups = new Map<string, FieldReport[]>();
      remainingImoReports.forEach(r => {
        const groupKey = (r.nisBinding || r.locationName || r.canalSegment || 'OTHER CANAL SYSTEMS').toUpperCase();
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push(r);
        processedReportIds.add(r.id);
      });

      groups.forEach((reps, groupTitle) => {
        tableBody.push([
          {
            content: groupTitle,
            colSpan: 15,
            styles: {
              fillColor: nisFillColor,
              textColor: [0, 0, 0],
              font: cambriaFont,
              fontStyle: 'bold',
              fontSize: 6,
              cellPadding: 0.7
            }
          }
        ]);
        tableBody.push([
          {
            content: weekInfo.label,
            colSpan: 15,
            styles: {
              fillColor: [255, 255, 255],
              textColor: [70, 70, 70],
              font: cambriaFont,
              fontStyle: 'italic',
              fontSize: 5.5,
              cellPadding: 0.6
            }
          }
        ]);
        reps.forEach(rep => {
          const parsed = parseStationingForPdf(rep.locationName, rep);
          const distKm = rep.segmentDistanceMeters ? (rep.segmentDistanceMeters / 1000).toFixed(3) : '';
          let remarks = rep.remarks || '';
          if (!remarks || remarks.startsWith('Maintenance activity performed')) {
            remarks = `${rep.maintenanceActivity || 'Maintenance activity'} along ${rep.locationName || groupTitle} by ${rep.reporterName || 'NIA Field Team'}.`;
          }
          const isIA = rep.performedBy === 'IA' || (rep.reporterRole as string) === 'IA' || (rep.reporterRole === 'Field Personnel');
          tableBody.push([
            '',
            parsed.canalName || rep.canalSegment || 'Main Canal',
            distKm,
            parsed.structureUnits || (parsed.structureType ? '1' : ''),
            isIA ? '✓' : '',
            !isIA ? '✓' : '',
            parsed.fromStation || (rep.segmentDistanceMeters ? '0+000' : ''),
            parsed.toStation || (rep.segmentDistanceMeters ? `${rep.segmentDistanceMeters.toFixed(0)}m` : ''),
            distKm,
            !parsed.structureType ? parsed.condition : '',
            parsed.structureType,
            parsed.structureStation,
            parsed.structureUnits,
            parsed.structureType ? parsed.condition : '',
            remarks
          ]);
        });
      });
    }
  });

  // Global Unmatched Reports Catch-All (Guarantees 100% inclusion of all reports in the week)
  const remainingGlobalReports = weekReports.filter(r => r && !processedReportIds.has(r.id));
  if (remainingGlobalReports.length > 0) {
    tableBody.push([
      {
        content: 'REGIONAL OFFICE / GENERAL ALIGNMENTS',
        colSpan: 15,
        styles: {
          fillColor: [241, 245, 249],
          textColor: [0, 0, 0],
          font: cambriaFont,
          fontStyle: 'bold',
          fontSize: 6.5,
          cellPadding: 0.8
        }
      }
    ]);
    remainingGlobalReports.forEach(rep => {
      processedReportIds.add(rep.id);
      const parsed = parseStationingForPdf(rep.locationName, rep);
      const distKm = rep.segmentDistanceMeters ? (rep.segmentDistanceMeters / 1000).toFixed(3) : '';
      let remarks = rep.remarks || `${rep.maintenanceActivity || 'Maintenance activity'} by ${rep.reporterName || 'NIA Team'}.`;
      const isIA = rep.performedBy === 'IA' || (rep.reporterRole === 'Field Personnel');
      tableBody.push([
        '',
        parsed.canalName || rep.canalSegment || 'Main Canal',
        distKm,
        parsed.structureUnits || (parsed.structureType ? '1' : ''),
        isIA ? '✓' : '',
        !isIA ? '✓' : '',
        parsed.fromStation || (rep.segmentDistanceMeters ? '0+000' : ''),
        parsed.toStation || (rep.segmentDistanceMeters ? `${rep.segmentDistanceMeters.toFixed(0)}m` : ''),
        distKm,
        !parsed.structureType ? parsed.condition : '',
        parsed.structureType,
        parsed.structureStation,
        parsed.structureUnits,
        parsed.structureType ? parsed.condition : '',
        remarks
      ]);
    });
  }

  // Render Table with Cambria font
  autoTable(doc, {
    startY: 34.5,
    margin: { left: 8, right: 8, bottom: 20 },
    tableWidth: pageWidth - 16,
    head: [
      [
        { content: tableBanner, colSpan: 15, styles: { halign: 'center', font: cambriaFont, fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [0, 0, 0], fontSize: 6.5, cellPadding: 0.8 } }
      ],
      [
        { content: 'NAME OF\nIMO/SYSTEM', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: 'NAME OF CANAL', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: 'TOTAL', colSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'MAINTAINED BY IA\nUNDER IMT', colSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'PROGRAM FOR MAINTENANCE', colSpan: 8, styles: { halign: 'center', valign: 'middle' } },
        { content: 'REMARKS', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'LENGTH OF\nCANAL (KM)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'NO. OF\nSTRUCTURES', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'YES', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'NO', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'CANAL', colSpan: 4, styles: { halign: 'center', valign: 'middle' } },
        { content: 'STRUCTURE', colSpan: 4, styles: { halign: 'center', valign: 'middle' } }
      ],
      [
        { content: 'STATION\nFROM', styles: { halign: 'center', valign: 'middle' } },
        { content: 'STATION\nTO', styles: { halign: 'center', valign: 'middle' } },
        { content: 'LENGTH (km)', styles: { halign: 'center', valign: 'middle' } },
        { content: 'CONDITION', styles: { halign: 'center', valign: 'middle' } },
        { content: 'TYPE', styles: { halign: 'center', valign: 'middle' } },
        { content: 'STATION', styles: { halign: 'center', valign: 'middle' } },
        { content: 'NO. OF\nUNITS', styles: { halign: 'center', valign: 'middle' } },
        { content: 'CONDITION', styles: { halign: 'center', valign: 'middle' } }
      ]
    ],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      font: cambriaFont,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 5.5,
      fontStyle: 'bold',
      cellPadding: 0.7,
      lineColor: [0, 0, 0],
      lineWidth: 0.15
    },
    styles: {
      font: cambriaFont,
      fontSize: 5.5,
      cellPadding: 0.6,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 25, fontStyle: 'bold' },
      2: { cellWidth: 11, halign: 'center' },
      3: { cellWidth: 11, halign: 'center' },
      4: { cellWidth: 6, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 6, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 13, halign: 'center' },
      8: { cellWidth: 11, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 18 },
      10: { cellWidth: 15 },
      11: { cellWidth: 13, halign: 'center' },
      12: { cellWidth: 8, halign: 'center' },
      13: { cellWidth: 18 },
      14: { cellWidth: 'auto' }
    }
  });

  // Signatories Block on final page (Cambria typography)
  let finalY = (doc as any).lastAutoTable.finalY + 6;
  if (finalY > pageHeight - 34) {
    doc.addPage();
    finalY = 16;
  }

  const hasReviewer = Boolean(signatories.reviewedByName && signatories.reviewedByName.trim().length > 0);

  if (hasReviewer) {
    const sigColWidth = contentWidth / 3;

    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);

    // Column 1: Prepared by
    doc.text('Prepared by:', margin, finalY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(7.5);
    doc.text(signatories.preparedByName || '', margin, finalY + 8);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(6.5);
    doc.text(signatories.preparedByTitle || '', margin, finalY + 11.5);
    if (signatories.initialsNote) {
      const initLines = signatories.initialsNote.split('\n');
      initLines.forEach((line, idx) => {
        doc.text(line, margin, finalY + 15 + idx * 3.5);
      });
    }

    // Column 2: Reviewed by
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7);
    doc.text('Reviewed by:', margin + sigColWidth, finalY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(7.5);
    doc.text(signatories.reviewedByName || '', margin + sigColWidth, finalY + 8);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(6.5);
    doc.text(signatories.reviewedByTitle || '', margin + sigColWidth, finalY + 11.5);

    // Column 3: Noted by
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7);
    doc.text('Noted by:', margin + sigColWidth * 2, finalY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(7.5);
    doc.text(signatories.notedByName || '', margin + sigColWidth * 2, finalY + 8);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(6.5);
    doc.text(signatories.notedByTitle || '', margin + sigColWidth * 2, finalY + 11.5);
  } else {
    // 2-Column layout: Prepared by (left) and Noted by (right) e.g. for Pula RIS, Bansud RIS, Bongabong
    const approverX = margin + contentWidth * 0.60;

    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);

    // Column 1: Prepared by
    doc.text('Prepared by:', margin, finalY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(7.5);
    doc.text(signatories.preparedByName || '', margin, finalY + 8);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(6.5);
    doc.text(signatories.preparedByTitle || '', margin, finalY + 11.5);
    if (signatories.initialsNote) {
      const initLines = signatories.initialsNote.split('\n');
      initLines.forEach((line, idx) => {
        doc.text(line, margin, finalY + 15 + idx * 3.5);
      });
    }

    // Column 2: Noted by
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7);
    doc.text('Noted by:', approverX, finalY);
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(7.5);
    doc.text(signatories.notedByName || '', approverX, finalY + 8);
    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(6.5);
    doc.text(signatories.notedByTitle || '', approverX, finalY + 11.5);
  }

  // Footer Drawing: Adds ISO Logo.png on bottom right (75% scale), and Calibri text on all pages (no background, no dividing border)
  const totalPages = doc.getNumberOfPages();
  const logoWidth = 31.5; // Scaled to 75% of original width
  const logoHeight = 10.1; // Scaled to 75% of original height

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // 1. Footer ISO Logo (QR Code + Certification International ISO 9001:2015 + PAB Accredited) on bottom right (75% scaled)
    try {
      doc.addImage(FOOTER_ISO_LOGO_BASE64, 'PNG', pageWidth - 8 - logoWidth, pageHeight - 4 - logoHeight, logoWidth, logoHeight);
    } catch (err) {
      console.warn('Could not add footer ISO logo:', err);
    }

    // 2. Footer Contact Information & Document Code in Calibri font
    doc.setFont(calibriFont, 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(30, 41, 59);
    doc.text('Brgy. Bayanan II, Calapan City, Oriental Mindoro, Philippines • Telefax No. : (043) 288-7267', 8, pageHeight - 10.5);
    doc.text('Email: r4b@nia.gov.ph • Website: www.region4b.nia.gov.ph • TIN: 000-916-415-166', 8, pageHeight - 7.5);

    doc.setFont(calibriFont, 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text('NIA-RO4B-EOD-OPS-INT-Form691 Rev.01', 8, pageHeight - 3.8);

    doc.setFont(calibriFont, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 3.8, { align: 'center' });
  }

  return doc;
}

export async function buildWmrPdfBlob(
  reports: FieldReport[],
  weekInfo: WmrWeekInfo,
  signatories: WmrSignatories,
  scopedImo?: string,
  scopedNis?: string
): Promise<{ blob: Blob; url: string; doc: jsPDF }> {
  const doc = await generateWmrPdf(reports, weekInfo, signatories, scopedImo, scopedNis);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url, doc };
}

export async function downloadWmrPdf(
  reports: FieldReport[],
  weekInfo: WmrWeekInfo,
  signatories: WmrSignatories,
  scopedImo?: string,
  scopedNis?: string
): Promise<void> {
  const doc = await generateWmrPdf(reports, weekInfo, signatories, scopedImo, scopedNis);
  const cleanKey = weekInfo.key.replace(/[^a-zA-Z0-9_-]/g, '_');
  const imoPrefix = scopedImo && scopedImo !== 'All IMOs' && scopedImo !== 'All'
    ? `${scopedImo.replace(/[^a-zA-Z0-9]/g, '_')}_`
    : '';
  doc.save(`NIA_Form691_WMR_${imoPrefix}${cleanKey}.pdf`);
}

/**
 * Generates true vector + embedded high-res photo PDF for Photo Documentation
 */
/**
 * Generates true vector + embedded high-res photo PDF for Photo Documentation
 * in official Portrait A4 matching the on-screen preview template.
 */
export async function generatePhotoDocsPdf(
  reports: FieldReport[],
  weekInfo: WmrWeekInfo,
  selectedImo: string = 'All',
  selectedNis: string = 'All'
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm

  // Register and initialize Cambria, Calibri & Trajan Pro fonts synchronously
  const { hasCambria, hasCalibri, hasTrajan } = registerWmrCustomFonts(doc);
  const cambriaFont = hasCambria ? 'Cambria' : 'times';
  const calibriFont = hasCalibri ? 'Calibri' : 'helvetica';
  const trajanFont = hasTrajan ? 'TrajanPro' : 'times';

  // Filter reports matching week and IMO/NIS with photos
  const photoReports = reports.filter(r => {
    if (!r) return false;
    const hasPhotos = (Array.isArray(r.photos) && r.photos.length > 0) || r.photoUrl;
    if (!hasPhotos) return false;

    const matchesWeek = isReportInWeek(r, weekInfo.key);

    // IMO match
    let matchesImo = true;
    if (selectedImo && selectedImo !== 'All IMOs' && selectedImo !== 'All') {
      const repImo = (r.imoOffice || '').toLowerCase();
      const sLower = selectedImo.toLowerCase();
      const isMOMARO = (str: string) => str.includes('momaro') || str.includes('oriental');
      const isOccidental = (str: string) => str.includes('occidental');
      const isPalawan = (str: string) => str.includes('palawan');
      if (isMOMARO(sLower) && isMOMARO(repImo)) matchesImo = true;
      else if (isOccidental(sLower) && isOccidental(repImo)) matchesImo = true;
      else if (isPalawan(sLower) && isPalawan(repImo)) matchesImo = true;
      else matchesImo = repImo.includes(sLower) || sLower.includes(repImo);
    }

    // NIS match
    let matchesNis = true;
    if (selectedNis && selectedNis !== 'All NIS' && selectedNis !== 'All') {
      const repNis = (r.nisBinding || '').toLowerCase();
      const repLoc = (r.locationName || '').toLowerCase();
      const repCanal = (r.canalSegment || '').toLowerCase();
      const nLower = selectedNis.toLowerCase();
      matchesNis = repNis.includes(nLower) || repLoc.includes(nLower) || repCanal.includes(nLower);
    }

    return matchesWeek && matchesImo && matchesNis;
  });

  // Build list of photo pages per report for pagination (up to 6 photos per page)
  interface PhotoPageItem {
    report: FieldReport;
    photos: PhotoAttachment[];
    pageIdxInReport: number;
    totalPagesInReport: number;
  }

  const pageItems: PhotoPageItem[] = [];

  photoReports.forEach(report => {
    const rawPhotos: PhotoAttachment[] = Array.isArray(report.photos) && report.photos.length > 0
      ? report.photos
      : (report.photoUrl ? [{ id: 'p1', url: report.photoUrl, stage: 'During' }] : []);

    const pages: PhotoAttachment[][] = [];
    for (let i = 0; i < rawPhotos.length; i += 6) {
      pages.push(rawPhotos.slice(i, i + 6));
    }
    if (pages.length === 0) {
      pages.push([]);
    }

    pages.forEach((pagePhotos, pageIdxInReport) => {
      pageItems.push({
        report,
        photos: pagePhotos,
        pageIdxInReport,
        totalPagesInReport: pages.length
      });
    });
  });

  if (pageItems.length === 0) {
    // Empty state portrait page
    // Left Double Logo
    try {
      doc.addImage(HEADER_LEFT_LOGO_BASE64, 'PNG', margin, 7.5, 26, 14);
    } catch (err) {
      console.warn('Could not add left header logo:', err);
    }

    // Header Text Lines
    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text('Republic of the Philippines', 41, 11);

    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text('OFFICE OF THE PRESIDENT', 41, 14.5);

    doc.setFont(trajanFont, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('NATIONAL IRRIGATION ADMINISTRATION', 41, 18.5);

    doc.setFont(trajanFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('REGIONAL OFFICE NO. IV-B (MIMAROPA)', 41, 22.5);

    // Right Logo
    try {
      doc.addImage(HEADER_RIGHT_LOGO_BASE64, 'PNG', pageWidth - margin - 15, 7.5, 15, 14.5);
    } catch (err) {
      console.warn('Could not add right header logo:', err);
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(margin, 25, pageWidth - margin, 25);

    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text('No Photo Documentation Recorded For This Week', pageWidth / 2, 120, { align: 'center' });

    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Attach Before, During, or After photos when submitting Field Maintenance Reports.', pageWidth / 2, 128, { align: 'center' });

    return doc;
  }

  for (let pageIdx = 0; pageIdx < pageItems.length; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage();
    }

    const { report, photos, pageIdxInReport } = pageItems[pageIdx];

    // 1. Official Header
    try {
      doc.addImage(HEADER_LEFT_LOGO_BASE64, 'PNG', margin, 7.5, 26, 14);
    } catch (err) {
      console.warn('Could not add left header logo:', err);
    }

    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text('Republic of the Philippines', 41, 11);

    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text('OFFICE OF THE PRESIDENT', 41, 14.5);

    doc.setFont(trajanFont, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('NATIONAL IRRIGATION ADMINISTRATION', 41, 18.5);

    doc.setFont(trajanFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('REGIONAL OFFICE NO. IV-B (MIMAROPA)', 41, 22.5);

    try {
      doc.addImage(HEADER_RIGHT_LOGO_BASE64, 'PNG', pageWidth - margin - 15, 7.5, 15, 14.5);
    } catch (err) {
      console.warn('Could not add right header logo:', err);
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(margin, 25, pageWidth - margin, 25);

    // 2. IMO & NIS Identification Banner Box (Top of First Page of Entry)
    let photosStartY = 28;
    if (pageIdxInReport === 0) {
      const bannerH = 14;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(margin, 27.5, contentWidth, bannerH);

      doc.setFont(cambriaFont, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const imoText = report.imoOffice || 'MINDORO ORIENTAL-MARINDUQUE-ROMBLON IMO';
      doc.text(imoText.toUpperCase(), pageWidth / 2, 31.8, { align: 'center' });

      doc.setFont(cambriaFont, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      const nisText = report.nisBinding || 'BACO-BUCAYAO RIS';
      doc.text(nisText.toUpperCase(), pageWidth / 2, 35.8, { align: 'center' });

      doc.setFont(cambriaFont, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(weekInfo.label, pageWidth / 2, 39.5, { align: 'center' });

      photosStartY = 44;
    }

    // 3. Photos Side-by-Side 4:3 Gallery Layout (Up to 6 photos per page)
    const numPhotos = photos.length;
    const colGap = 6;
    let rowGap = 4;
    let photoW = 90;
    let photoH = photoW * 0.75; // 67.5mm Standard 4:3

    if (numPhotos >= 5) {
      photoW = 86;
      photoH = 64.5;
      rowGap = 3;
    }

    const numRows = numPhotos === 1 ? 1 : Math.ceil(numPhotos / 2);
    const totalGridH = numRows * photoH + Math.max(0, numRows - 1) * rowGap;

    const bottomBoxH = 14;
    const bottomBoxY = photosStartY + totalGridH + 6;

    for (let pIdx = 0; pIdx < numPhotos; pIdx++) {
      const photo = photos[pIdx];
      const col = numPhotos === 1 ? 0 : (pIdx % 2);
      const row = numPhotos === 1 ? 0 : Math.floor(pIdx / 2);

      const photoX = numPhotos === 1
        ? margin + (contentWidth - photoW) / 2
        : margin + (contentWidth - (photoW * 2 + colGap)) / 2 + col * (photoW + colGap);
      const photoY = photosStartY + 1 + row * (photoH + rowGap);

      // Outer container border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.rect(photoX, photoY, photoW, photoH);

      // Fill background with clean white
      doc.setFillColor(248, 250, 252);
      doc.rect(photoX + 0.3, photoY + 0.3, photoW - 0.6, photoH - 0.6, 'F');

      // Image embed — 4:3 aspect ratio fit
      const resolvedWeeklyPhotoUrl = resolvePhotoAttachmentUrl(photo);
      const fallbackWeeklyPhotoUrl = (photo as any).thumbnailUrl || ((photo as any).driveFileId ? `/api/drive/photo/${(photo as any).driveFileId}` : (photo.id ? `/api/drive/photo/${photo.id}` : undefined));
      if (resolvedWeeklyPhotoUrl || fallbackWeeklyPhotoUrl) {
        try {
          const containerW = photoW - 0.6;
          const containerH = photoH - 0.6;
          const imgObj = await getBase64ImageFromUrl(resolvedWeeklyPhotoUrl, fallbackWeeklyPhotoUrl);
          if (imgObj && imgObj.dataUrl) {
            const natW = imgObj.width || 4;
            const natH = imgObj.height || 3;
            const scale = Math.min(containerW / natW, containerH / natH);
            const drawW = natW * scale;
            const drawH = natH * scale;
            const drawX = photoX + 0.3 + (containerW - drawW) / 2;
            const drawY = photoY + 0.3 + (containerH - drawH) / 2;
            try {
              doc.addImage(imgObj.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
            } catch (e) {
              doc.addImage(imgObj.dataUrl, 'PNG', drawX, drawY, drawW, drawH);
            }
          } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text('[Inspection Photo Preview]', photoX + photoW / 2, photoY + photoH / 2, { align: 'center' });
          }
        } catch (pngErr) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text('[Inspection Photo Preview]', photoX + photoW / 2, photoY + photoH / 2, { align: 'center' });
        }
      }

      // Stage Badge on Top Left of Photo ("BEFORE" / "DURING" / "AFTER")
      const stage = (photo.stage || 'Photo').toUpperCase();
      let badgeBg = [217, 119, 6]; // Amber During
      if (stage === 'BEFORE') badgeBg = [37, 99, 235]; // Royal Blue
      if (stage === 'AFTER') badgeBg = [5, 150, 105]; // Emerald Green

      doc.setFont(calibriFont, 'bold');
      doc.setFontSize(6.8);
      const badgeTextW = doc.getTextWidth(stage);
      const badgeW = Math.max(18, badgeTextW + 5);
      const badgeH = 5.2;
      const badgeX = photoX + 2;
      const badgeY = photoY + 2;

      doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(stage, badgeX + badgeW / 2, badgeY + 3.7, { align: 'center' });

      // Date, Coordinates & Canal Name Stamp (Bottom Right, Auto-Sized Width & Height)
      const capturedDateStr = photo.capturedAt
        ? new Date(photo.capturedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleDateString('en-US');

      const latStr = photo.lat !== undefined ? photo.lat.toFixed(6) : (report.lat ? report.lat.toFixed(6) : '');
      const lngStr = photo.lng !== undefined ? photo.lng.toFixed(6) : (report.lng ? report.lng.toFixed(6) : '');
      
      const canalName = (photo.canalSegment || report.canalSegment || '').trim();
      const locName = (photo.locationName || report.locationName || report.nisBinding || '').trim();
      let canalLocationLine = '';
      if (canalName && locName && !canalName.toLowerCase().includes(locName.toLowerCase())) {
        canalLocationLine = `${canalName} (${locName})`;
      } else {
        canalLocationLine = canalName || locName || 'Irrigation System';
      }

      doc.setFont(calibriFont, 'bold');
      doc.setFontSize(5.6);
      const dateW = doc.getTextWidth(capturedDateStr);

      doc.setFont(calibriFont, 'normal');
      doc.setFontSize(5.0);
      const coordsW = (latStr && lngStr) ? doc.getTextWidth(`${latStr}°N, ${lngStr}°E`) : 0;

      doc.setFont(calibriFont, 'normal');
      doc.setFontSize(4.8);
      const canalW = canalLocationLine ? doc.getTextWidth(canalLocationLine) : 0;

      const maxTextW = Math.max(dateW, coordsW, canalW);
      const ovW = Math.min(photoW - 3, Math.max(26, maxTextW + 3.6));

      let lineCount = 1;
      if (latStr && lngStr) lineCount++;
      if (canalLocationLine) lineCount++;

      const ovH = 1.8 + lineCount * 3.0;
      const ovX = photoX + photoW - ovW - 1.5;
      const ovY = photoY + photoH - ovH - 1.5;

      // 35% Opacity Background Fill
      doc.saveGraphicsState();
      if ((doc as any).GState) {
        doc.setGState(new (doc as any).GState({ opacity: 0.35 }));
      }
      doc.setFillColor(0, 0, 0);
      doc.roundedRect(ovX, ovY, ovW, ovH, 0.8, 0.8, 'F');
      doc.restoreGraphicsState();

      // Text inside auto-sized label box
      let textY = ovY + 2.8;
      doc.setFont(calibriFont, 'bold');
      doc.setFontSize(5.6);
      doc.setTextColor(253, 224, 71); // Amber
      doc.text(capturedDateStr, ovX + 1.8, textY);

      if (latStr && lngStr) {
        textY += 3.0;
        doc.setFont(calibriFont, 'normal');
        doc.setFontSize(5.0);
        doc.setTextColor(241, 245, 249);
        doc.text(`${latStr}°N, ${lngStr}°E`, ovX + 1.8, textY);
      }

      if (canalLocationLine) {
        textY += 3.0;
        doc.setFont(calibriFont, 'normal');
        doc.setFontSize(4.8);
        doc.setTextColor(226, 232, 240);
        doc.text(canalLocationLine, ovX + 1.8, textY, { maxWidth: ovW - 3.6 });
      }

      // Photo Caption Strip on Bottom Left (if descriptive caption exists)
      const isCustomCaption = photo.caption && !photo.caption.startsWith('Before #') && !photo.caption.startsWith('During #') && !photo.caption.startsWith('After #');
      if (isCustomCaption) {
        const capMaxW = photoW - ovW - 4;
        if (capMaxW > 25) {
          const capX = photoX + 1.5;
          const capY = photoY + photoH - ovH - 1.5;
          
          doc.saveGraphicsState();
          if ((doc as any).GState) {
            doc.setGState(new (doc as any).GState({ opacity: 0.45 }));
          }
          doc.setFillColor(0, 0, 0);
          doc.roundedRect(capX, capY, capMaxW, ovH, 0.8, 0.8, 'F');
          doc.restoreGraphicsState();

          doc.setFont(calibriFont, 'bold');
          doc.setFontSize(4.8);
          doc.setTextColor(255, 255, 255);
          doc.text(photo.caption || '', capX + 1.5, capY + 3.0, { maxWidth: capMaxW - 3 });
        }
      }
    }

    // 4. Description & Particulars Box — 2-Row Format (Removed redundant canal distance row)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, bottomBoxY, contentWidth, bottomBoxH);

    const activityCategoryText = (report.maintenanceActivity || report.reportType || 'Canal Maintenance').toUpperCase();
    const remarksText = report.remarks || `${report.maintenanceActivity || 'Maintenance activity'} undertaken by NIA O&M Personnel.`;
    const remarksDisplay = remarksText.length > 220 ? remarksText.substring(0, 217) + '...' : remarksText;

    doc.setFont(cambriaFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(activityCategoryText, pageWidth / 2, bottomBoxY + 4.8, { align: 'center', maxWidth: contentWidth - 6 });

    doc.setFont(cambriaFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(remarksDisplay, pageWidth / 2, bottomBoxY + 10.2, { align: 'center', maxWidth: contentWidth - 6 });

    // 5. Document Bottom Footer
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

    doc.setFont(calibriFont, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    const repFormattedId = formatReportId(report.id, report.revisionNumber);
    doc.text(repFormattedId, margin, pageHeight - 11);

    const photoDocUserSig = getUserSignatories(report.submittedByUserId).photoDoc;
    const photoDocNoStr = photoDocUserSig.documentNo || 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01';

    doc.setFont(calibriFont, 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(photoDocNoStr, margin, pageHeight - 6.5);

    doc.setFont(calibriFont, 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${pageIdx + 1} of ${pageItems.length}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  }

  return doc;
}

export async function buildPhotoDocsPdfBlob(
  reports: FieldReport[],
  weekInfo: WmrWeekInfo,
  selectedImo: string = 'All',
  selectedNis: string = 'All'
): Promise<{ blob: Blob; url: string; doc: jsPDF }> {
  const doc = await generatePhotoDocsPdf(reports, weekInfo, selectedImo, selectedNis);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url, doc };
}

export async function downloadPhotoDocsPdf(
  reports: FieldReport[],
  weekInfo: WmrWeekInfo,
  selectedImo: string = 'All',
  selectedNis: string = 'All'
): Promise<void> {
  const doc = await generatePhotoDocsPdf(reports, weekInfo, selectedImo, selectedNis);
  const cleanKey = weekInfo.key.replace(/[^a-zA-Z0-9_-]/g, '_');
  const imoPrefix = selectedImo && selectedImo !== 'All IMOs' && selectedImo !== 'All'
    ? `${selectedImo.replace(/[^a-zA-Z0-9]/g, '_')}_`
    : '';
  doc.save(`NIA_PhotoDocs_${imoPrefix}${cleanKey}.pdf`);
}
