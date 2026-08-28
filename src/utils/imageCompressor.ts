import { PhotoAttachment, PhotoFramingConfig } from '../types';

export const TARGET_CANVAS_WIDTH = 1400;
export const TARGET_CANVAS_HEIGHT = 1050; // Strict 4:3 Landscape aspect ratio (1400 / 1050 = 1.3333...)
export const DEFAULT_COMPRESSION_CAP_BYTES = 300 * 1024; // 300 KB default target cap

/**
 * Calculates default centered framing config that completely fills the 4:3 frame with zero blank spaces:
 * - Widescreen / Landscape (>= 4:3) -> Fit Height (covers full height and centered width with zero top/bottom blank spaces)
 * - Portrait / Tall / Square (< 4:3) -> Fit Width (covers full width and centered height with zero side blank spaces)
 */
export function calculateDefaultFraming(naturalWidth: number, naturalHeight: number): PhotoFramingConfig {
  const aspect = naturalWidth / Math.max(1, naturalHeight);
  const targetAspect = TARGET_CANVAS_WIDTH / TARGET_CANVAS_HEIGHT; // 4/3 = 1.3333

  // Fit with no blank spaces (cover-fit centered):
  const mode: 'fit-width' | 'fit-height' = aspect >= targetAspect ? 'fit-height' : 'fit-width';

  return {
    mode,
    zoom: 1.0, // 100% Full View default
    panStep: 0, // Centered default (0 on -10 to +10 scale)
    offsetXPercent: 0,
    offsetYPercent: 0,
    naturalWidth,
    naturalHeight,
    naturalAspectRatio: aspect
  };
}

/**
 * Loads an image from a Data URL or Blob URL and retrieves its HTMLImageElement and natural dimensions
 */
export function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/**
 * Renders an image onto a strict 4:3 canvas (1400x1050 px) using non-destructive framing parameters
 */
export async function renderFramedImage(
  sourceDataUrl: string,
  config: PhotoFramingConfig,
  targetWidth = TARGET_CANVAS_WIDTH,
  targetHeight = TARGET_CANVAS_HEIGHT,
  maxSizeBytes = DEFAULT_COMPRESSION_CAP_BYTES
): Promise<{ dataUrl: string; sizeBytes: number }> {
  const img = await loadImageElement(sourceDataUrl);
  const natW = img.naturalWidth || img.width || targetWidth;
  const natH = img.naturalHeight || img.height || targetHeight;
  const imgAspect = natW / Math.max(1, natH);
  const canvasAspect = targetWidth / targetHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Fill canvas background with clean neutral white (for document compatibility)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Calculate base scale according to Framing Mode (Fit Width vs Fit Height)
  let baseDrawW = targetWidth;
  let baseDrawH = targetHeight;

  if (config.mode === 'fit-width') {
    baseDrawW = targetWidth;
    baseDrawH = targetWidth / imgAspect;
  } else if (config.mode === 'fit-height') {
    baseDrawH = targetHeight;
    baseDrawW = targetHeight * imgAspect;
  } else {
    // Custom / Fill Mode (Cover)
    const scale = Math.max(targetWidth / natW, targetHeight / natH);
    baseDrawW = natW * scale;
    baseDrawH = natH * scale;
  }

  // Apply Zoom Scale (0.5x to 2.0x, default 1.0)
  const zoom = Math.max(0.5, Math.min(2.0, config.zoom || 1.0));
  const finalDrawW = baseDrawW * zoom;
  const finalDrawH = baseDrawH * zoom;

  // Compute Base Centered Coordinates
  let drawX = (targetWidth - finalDrawW) / 2;
  let drawY = (targetHeight - finalDrawH) / 2;

  // Single-Axis Panning Offset (-10 to +10 step scale, where 0 is centered)
  const panStep = Math.max(-10, Math.min(10, config.panStep ?? 0));
  const panFraction = panStep / 10; // -1.0 to +1.0

  if (config.mode === 'fit-width') {
    // Vertical Panning (Up / Down)
    // When image is taller than canvas, shift within the overflow boundary
    const overflowY = Math.max(0, finalDrawH - targetHeight);
    if (overflowY > 0) {
      // panStep -10 moves image down (reveals top), panStep +10 moves image up (reveals bottom)
      drawY = (targetHeight - finalDrawH) / 2 - panFraction * (overflowY / 2);
    }
  } else if (config.mode === 'fit-height') {
    // Horizontal Panning (Left / Right)
    // When image is wider than canvas, shift within the overflow boundary
    const overflowX = Math.max(0, finalDrawW - targetWidth);
    if (overflowX > 0) {
      // panStep -10 moves image right (reveals left), panStep +10 moves image left (reveals right)
      drawX = (targetWidth - finalDrawW) / 2 - panFraction * (overflowX / 2);
    }
  }

  // Direct touch/drag offset overrides if provided
  if (typeof config.offsetXPercent === 'number' && config.offsetXPercent !== 0) {
    drawX += (config.offsetXPercent / 100) * targetWidth;
  }
  if (typeof config.offsetYPercent === 'number' && config.offsetYPercent !== 0) {
    drawY += (config.offsetYPercent / 100) * targetHeight;
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw image on 4:3 canvas
  ctx.drawImage(img, drawX, drawY, finalDrawW, finalDrawH);

  // Multi-pass Compression to satisfy maxSizeBytes cap (e.g. 300 KB)
  let quality = 0.86;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let sizeBytes = estimateDataUrlSizeBytes(dataUrl);

  // Progressive compression steps if over cap
  const qualitySteps = [0.80, 0.74, 0.68, 0.60, 0.52];
  let stepIndex = 0;

  while (maxSizeBytes > 0 && sizeBytes > maxSizeBytes && stepIndex < qualitySteps.length) {
    quality = qualitySteps[stepIndex];
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    sizeBytes = estimateDataUrlSizeBytes(dataUrl);
    stepIndex++;
  }

  return {
    dataUrl,
    sizeBytes
  };
}

/**
 * Estimates binary byte size of a base64 Data URL
 */
export function estimateDataUrlSizeBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const base64Str = dataUrl.split(',')[1] || '';
  const padding = (base64Str.match(/=/g) || []).length;
  return Math.max(0, Math.floor((base64Str.length * 3) / 4 - padding));
}

/**
 * Formats bytes to human-readable string (e.g. "245 KB", "1.2 MB")
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reads a File as base64 string
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Pipeline function: Ingests a raw File, detects dimensions, builds 100% full view framing,
 * renders standard 4:3 canvas, and retains the lossless sourceDataUrl
 */
export async function processAndFramePhotoFile(
  file: File,
  options?: {
    maxSizeBytes?: number;
    stage?: 'Before' | 'During' | 'After';
    caption?: string;
  }
): Promise<PhotoAttachment> {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(sourceDataUrl);
  const natW = img.naturalWidth || 1400;
  const natH = img.naturalHeight || 1050;

  const defaultFraming = calculateDefaultFraming(natW, natH);
  const targetCap = options?.maxSizeBytes ?? DEFAULT_COMPRESSION_CAP_BYTES;

  const { dataUrl, sizeBytes } = await renderFramedImage(
    sourceDataUrl,
    defaultFraming,
    TARGET_CANVAS_WIDTH,
    TARGET_CANVAS_HEIGHT,
    targetCap
  );

  const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const capturedAt = file.lastModified
    ? new Date(file.lastModified).toISOString()
    : new Date().toISOString();

  return {
    id: photoId,
    url: dataUrl,
    dataUrl,
    sourceDataUrl,
    stage: options?.stage || 'During',
    caption: options?.caption || '',
    capturedAt,
    sizeBytes,
    framingConfig: defaultFraming
  };
}
