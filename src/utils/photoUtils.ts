import { PhotoAttachment } from '../types';
import { 
  getCachedPhotoSync, 
  getCachedPhotoDB, 
  saveCachedPhotoDB, 
  normalizePhotoKey 
} from './offlineStorage';

/**
 * Robust, unified resolver for photo attachment URLs across all app components.
 * Prioritizes:
 * 1. Data URLs (lossless/framed base64 in memory)
 * 2. Instant in-memory IndexedDB cache lookup
 * 3. High-Quality Direct Google Drive Image CDN (https://drive.google.com/thumbnail?id=...&sz=w1200)
 * 4. Backend Server Local Disk Proxy (/api/drive/photo/...)
 * 5. Google Drive thumbnail URL
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

  // 3. Extract clean Google Drive File ID & Photo ID
  const rawId = photo.driveFileId || (photo.id && typeof photo.id === 'string' && photo.id.length >= 20 && !photo.id.startsWith('photo-') && !photo.id.startsWith('p-') ? photo.id : undefined);
  const cleanId = rawId ? normalizePhotoKey(rawId) : undefined;
  const photoId = photo.id ? normalizePhotoKey(photo.id) : undefined;

  // 4. Synchronous in-memory cache check (instant response from IndexedDB preload)
  if (cleanId) {
    const cached = getCachedPhotoSync(cleanId);
    if (cached) return cached;
  }
  if (photoId) {
    const cached = getCachedPhotoSync(photoId);
    if (cached) return cached;
  }

  // 5. Offline detection: Prefer local server proxy if offline so local server disk cache is tried first
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (isOffline && cleanId) {
    return `/api/drive/photo/${cleanId}`;
  }

  // 6. Online: Direct Google Drive thumbnail CDN with high resolution (works across static hosting, offline caches, & local dev)
  if (cleanId) {
    return `https://drive.google.com/thumbnail?id=${cleanId}&sz=w1200`;
  }

  // 7. Existing valid external URL (e.g. web/unsplash)
  if (typeof photo.url === 'string' && photo.url.trim().length > 0 && !photo.url.startsWith('/api/drive/photo/')) {
    return photo.url.trim();
  }

  // 8. Existing server proxy URL if present
  if (typeof photo.url === 'string' && photo.url.trim().length > 0) {
    return photo.url.trim();
  }

  // 9. Thumbnail URL
  if (photo.thumbnailUrl && typeof photo.thumbnailUrl === 'string' && photo.thumbnailUrl.trim().length > 0) {
    return photo.thumbnailUrl.trim();
  }

  return '';
}

/**
 * Handle image loading errors by attempting successive multi-tier fallbacks:
 * IndexedDB Cache -> Local Server Proxy -> Direct CDN -> LH3 CDN -> Export View -> Styled Fallback UI
 */
export function handleImageFallback(
  e: any,
  photo?: PhotoAttachment | any,
  fallbackMessage: string = 'Photo Attachment'
) {
  const target = e.currentTarget as HTMLImageElement | null;
  if (!target) return;

  const rawId = photo?.driveFileId || (photo?.id && typeof photo.id === 'string' && photo.id.length >= 20 && !photo.id.startsWith('photo-') ? photo.id : undefined);
  const cleanId = rawId ? normalizePhotoKey(rawId) : undefined;
  const photoId = photo?.id ? normalizePhotoKey(photo.id) : undefined;
  const lookupKey = cleanId || photoId;

  // Step 0: Immediate synchronous in-memory cache check
  const syncCached = (cleanId ? getCachedPhotoSync(cleanId) : null) || (photoId ? getCachedPhotoSync(photoId) : null);
  if (syncCached && target.src !== syncCached) {
    target.src = syncCached;
    target.style.display = '';
    const existingFallback = target.parentElement?.querySelector('.img-doc-fallback, .img-fallback');
    if (existingFallback) existingFallback.remove();
    return;
  }

  // Step 0b: Check IndexedDB asynchronously
  if (lookupKey) {
    getCachedPhotoDB(lookupKey).then(cached => {
      if (cached && target) {
        target.src = cached;
        target.style.display = '';
        const existingFallback = target.parentElement?.querySelector('.img-doc-fallback, .img-fallback');
        if (existingFallback) existingFallback.remove();
      }
    }).catch(() => {});
  }

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  // If offline, do NOT attempt remote CDN requests that will throw unhandled network errors
  if (isOffline) {
    target.style.display = 'none';
    const parent = target.parentElement;
    if (parent && !parent.querySelector('.img-doc-fallback, .img-fallback')) {
      const fallback = document.createElement('div');
      fallback.className = 'img-fallback w-full h-full min-h-[100px] flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center bg-slate-900/90 rounded-lg select-none';
      fallback.innerHTML = `<span class="text-xl mb-1 opacity-60">📷</span><span class="text-[11px] font-medium text-slate-400">${fallbackMessage}</span>`;
      parent.prepend(fallback);
    }
    return;
  }

  if (cleanId) {
    const currentSrc = target.src || '';
    const tierProxy = `/api/drive/photo/${cleanId}`;
    const tierCdn = `https://drive.google.com/thumbnail?id=${cleanId}&sz=w1200`;
    const tierLh3 = `https://lh3.googleusercontent.com/d/${cleanId}`;
    const tierExport = `https://drive.google.com/uc?export=view&id=${cleanId}`;

    // Step 1: If direct CDN failed, try local server proxy
    if (currentSrc.includes('thumbnail?id=') || currentSrc.includes('drive.google.com/thumbnail')) {
      target.src = tierProxy;
      return;
    }

    // Step 2: If server proxy failed, try LH3 full-res CDN
    if (currentSrc.includes('/api/drive/photo/')) {
      target.src = tierLh3;
      return;
    }

    // Step 3: If LH3 failed, try export view
    if (currentSrc.includes('lh3.googleusercontent.com/d/')) {
      target.src = tierExport;
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

/**
 * Automatically capture an image element once loaded and persist it into IndexedDB
 * for 100% reliable zero-network offline loading in the future.
 */
export function captureAndCacheImageElement(img: HTMLImageElement, photo?: any): void {
  if (!img || img.naturalWidth <= 10 || img.naturalHeight <= 10) return;
  const rawId = photo?.driveFileId || (photo?.id && typeof photo.id === 'string' && photo.id.length >= 20 && !photo.id.startsWith('photo-') ? photo.id : undefined);
  const cleanId = rawId ? normalizePhotoKey(rawId) : (photo?.id ? normalizePhotoKey(photo.id) : undefined);
  if (!cleanId) return;

  // If already in memory cache, skip
  if (getCachedPhotoSync(cleanId)) return;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(img.naturalWidth, 1200);
    canvas.height = Math.round(canvas.width * (img.naturalHeight / img.naturalWidth));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      saveCachedPhotoDB(cleanId, dataUrl).catch(() => {});
      return;
    }
  } catch (_) {
    // If canvas was tainted by cross-origin, attempt direct fetch if online
  }

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const fetchUrl = img.src || `/api/drive/photo/${cleanId}`;
    fetch(fetchUrl, { mode: 'cors' })
      .then(res => res.ok ? res.blob() : null)
      .then(blob => {
        if (blob && blob.size > 500) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const resUrl = reader.result as string;
            if (resUrl && resUrl.startsWith('data:image/')) {
              saveCachedPhotoDB(cleanId, resUrl).catch(() => {});
            }
          };
          reader.readAsDataURL(blob);
        }
      })
      .catch(() => {});
  }
}

