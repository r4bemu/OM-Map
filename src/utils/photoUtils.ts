import { PhotoAttachment } from '../types';

/**
 * Robust, unified resolver for photo attachment URLs across all app components.
 * Prioritizes:
 * 1. Data URLs (lossless/framed base64 in memory/IndexedDB)
 * 2. Explicit server proxy URL or web URL (if non-empty)
 * 3. Google Drive proxy URL via driveFileId or long ID
 * 4. Google Drive thumbnail URL
 */
export function resolvePhotoAttachmentUrl(photo?: PhotoAttachment | any): string {
  if (!photo) return '';

  // 1. Direct Data URLs (highest fidelity)
  const dataUrl = photo.dataUrl || photo.sourceDataUrl;
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
    return dataUrl.trim();
  }

  // 2. Existing valid URL (if not empty or whitespace)
  if (typeof photo.url === 'string' && photo.url.trim().length > 0) {
    return photo.url.trim();
  }

  // 3. Google Drive file ID proxy
  if (photo.driveFileId && typeof photo.driveFileId === 'string' && photo.driveFileId.trim().length > 0) {
    const cleanId = photo.driveFileId.replace(/^photo_/, '').trim();
    return `/api/drive/photo/${cleanId}`;
  }

  // 4. Drive ID fallback if id looks like a Drive ID (not local mock/photo- prefix)
  if (photo.id && typeof photo.id === 'string' && photo.id.length >= 20 && !photo.id.startsWith('photo-') && !photo.id.startsWith('p-')) {
    const cleanId = photo.id.replace(/^photo_/, '').trim();
    return `/api/drive/photo/${cleanId}`;
  }

  // 5. Thumbnail URL
  if (photo.thumbnailUrl && typeof photo.thumbnailUrl === 'string' && photo.thumbnailUrl.trim().length > 0) {
    return photo.thumbnailUrl.trim();
  }

  return '';
}

/**
 * Handle image loading errors by attempting successive fallbacks (Drive file proxy -> Thumbnail -> Fallback UI)
 */
export function handleImageFallback(
  e: any,
  photo?: PhotoAttachment | any,
  fallbackMessage: string = 'Photo Attachment'
) {
  const target = e.currentTarget;
  const driveFileId = photo?.driveFileId || (photo?.id && photo.id.length >= 20 && !photo.id.startsWith('photo-') ? photo.id : undefined);

  // Fallback 1: Try Drive photo API endpoint if not already tried
  if (driveFileId) {
    const driveUrl = `/api/drive/photo/${driveFileId.replace(/^photo_/, '')}`;
    if (!target.src.includes(driveUrl)) {
      target.src = driveUrl;
      return;
    }
  }

  // Fallback 2: Try thumbnailUrl if not already tried
  if (photo?.thumbnailUrl && target.src !== photo.thumbnailUrl) {
    target.src = photo.thumbnailUrl;
    return;
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
