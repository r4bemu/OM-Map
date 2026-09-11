import { PhotoAttachment } from '../types';

/**
 * Robust, unified resolver for photo attachment URLs across all app components.
 * Prioritizes:
 * 1. Data URLs (lossless/framed base64 in memory/IndexedDB)
 * 2. External Web URLs (http/https not pointing to obsolete local proxy)
 * 3. High-Quality Direct Google Drive Image CDN (https://drive.google.com/thumbnail?id=...&sz=w1200)
 * 4. Google Drive LH3 CDN (https://lh3.googleusercontent.com/d/...)
 * 5. Backend Server Proxy (/api/drive/photo/...)
 * 6. Google Drive thumbnail URL
 */
export function resolvePhotoAttachmentUrl(photo?: PhotoAttachment | any): string {
  if (!photo) return '';

  // 1. Direct Data URLs (highest fidelity)
  const dataUrl = photo.dataUrl || photo.sourceDataUrl;
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
    return dataUrl.trim();
  }

  // 2. Existing valid data URL in photo.url
  if (typeof photo.url === 'string' && photo.url.startsWith('data:image/')) {
    return photo.url.trim();
  }

  // 3. Extract clean Google Drive File ID
  const rawId = photo.driveFileId || (photo.id && typeof photo.id === 'string' && photo.id.length >= 20 && !photo.id.startsWith('photo-') && !photo.id.startsWith('p-') ? photo.id : undefined);
  const cleanId = rawId ? String(rawId).replace(/^photo_/, '').trim() : undefined;

  if (cleanId) {
    // Prefer direct Google Drive thumbnail CDN with high resolution (works across static hosting, offline caches, & local dev)
    return `https://drive.google.com/thumbnail?id=${cleanId}&sz=w1200`;
  }

  // 4. Existing valid external URL (e.g. web/unsplash)
  if (typeof photo.url === 'string' && photo.url.trim().length > 0 && !photo.url.startsWith('/api/drive/photo/')) {
    return photo.url.trim();
  }

  // 5. Existing server proxy URL if present
  if (typeof photo.url === 'string' && photo.url.trim().length > 0) {
    return photo.url.trim();
  }

  // 6. Thumbnail URL
  if (photo.thumbnailUrl && typeof photo.thumbnailUrl === 'string' && photo.thumbnailUrl.trim().length > 0) {
    return photo.thumbnailUrl.trim();
  }

  return '';
}

/**
 * Handle image loading errors by attempting successive multi-tier fallbacks:
 * Direct CDN -> LH3 CDN -> Local Server Proxy -> Export View -> Thumbnail -> Styled Fallback UI
 */
export function handleImageFallback(
  e: any,
  photo?: PhotoAttachment | any,
  fallbackMessage: string = 'Photo Attachment'
) {
  const target = e.currentTarget;
  if (!target) return;

  const rawId = photo?.driveFileId || (photo?.id && typeof photo.id === 'string' && photo.id.length >= 20 && !photo.id.startsWith('photo-') ? photo.id : undefined);
  const cleanId = rawId ? String(rawId).replace(/^photo_/, '').trim() : undefined;

  if (cleanId) {
    const currentSrc = target.src || '';
    const tier1 = `https://drive.google.com/thumbnail?id=${cleanId}&sz=w1200`;
    const tier2 = `https://lh3.googleusercontent.com/d/${cleanId}`;
    const tier3 = `/api/drive/photo/${cleanId}`;
    const tier4 = `https://drive.google.com/uc?export=view&id=${cleanId}`;

    // Step 1: If thumbnail CDN failed, try LH3 full-res CDN
    if (currentSrc.includes('thumbnail?id=') || currentSrc.includes('drive.google.com/thumbnail')) {
      target.src = tier2;
      return;
    }

    // Step 2: If LH3 failed, try server proxy
    if (currentSrc.includes('lh3.googleusercontent.com/d/')) {
      target.src = tier3;
      return;
    }

    // Step 3: If server proxy failed, try export view
    if (currentSrc.includes('/api/drive/photo/')) {
      target.src = tier4;
      return;
    }

    // Step 4: If export view failed, try initial thumbnail link if available
    if (photo?.thumbnailUrl && currentSrc !== photo.thumbnailUrl) {
      target.src = photo.thumbnailUrl;
      return;
    }
  }

  // Final fallback: Hide broken img and inject styled fallback container
  target.style.display = 'none';
  const parent = target.parentElement;
  if (parent && !parent.querySelector('.img-doc-fallback, .img-fallback')) {
    const fallback = document.createElement('div');
    fallback.className = 'img-fallback w-full h-full min-h-[100px] flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center bg-slate-900/90 rounded-lg select-none';
    fallback.innerHTML = `<span class="text-xl mb-1 opacity-60">📷</span><span class="text-[11px] font-medium text-slate-400">${fallbackMessage}</span>`;
    parent.prepend(fallback);
  }
}
