import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Trash2, 
  Eye, 
  GripVertical, 
  ChevronUp, 
  ChevronDown, 
  Maximize2, 
  Sliders, 
  HelpCircle, 
  Check, 
  Image as ImageIcon,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { PhotoAttachment } from '../types';
import { PhotoPreviewModal } from './PhotoPreviewModal';
import { Inline3TapCaptionSelector } from './Inline3TapCaptionSelector';
import { 
  processAndFramePhotoFile, 
  formatBytes, 
  DEFAULT_COMPRESSION_CAP_BYTES 
} from '../utils/imageCompressor';
import { CaptionContext } from '../utils/captionGenerator';
import { getSavedConfigurations } from '../utils/appConfigurations';

/**
 * Auto-expanding textarea that dynamically grows with the caption text
 * allowing the user to view the full phrase in one glance without internal scrolling.
 */
const AutoExpandingCaptionTextarea: React.FC<{
  value: string;
  disabled?: boolean;
  onChange: (val: string) => void;
  placeholder?: string;
}> = ({ value, disabled, onChange, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(42, textareaRef.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      disabled={disabled}
      rows={1}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3 py-2.5 rounded-xl focus:border-cyan-500 focus:outline-none resize-none overflow-hidden leading-relaxed transition-all shadow-inner"
    />
  );
};

interface PhotoManagerProps {
  photos: PhotoAttachment[];
  onChangePhotos: (photos: PhotoAttachment[]) => void;
  context?: CaptionContext;
  onOpenPhotographyGuide?: () => void;
  disabled?: boolean;
}

export const PhotoManager: React.FC<PhotoManagerProps> = ({
  photos,
  onChangePhotos,
  context,
  onOpenPhotographyGuide,
  disabled = false
}) => {
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [compressionCapBytes, setCompressionCapBytes] = useState<number>(() => getSavedConfigurations().photoResolutionCapBytes);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [dragOverZone, setDragOverZone] = useState<boolean>(false);

  useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail?.photoResolutionCapBytes !== undefined) {
        setCompressionCapBytes(e.detail.photoResolutionCapBytes);
      }
    };
    window.addEventListener('ommap_configurations_updated', handleConfigUpdate);
    return () => window.removeEventListener('ommap_configurations_updated', handleConfigUpdate);
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Total payload calculation
  const totalSizeBytes = photos.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);

  // Stage Sequential Counter Helper (Before #1, During #1, After #1...)
  const getStageLabel = (photoId: string): string => {
    let beforeCount = 0;
    let duringCount = 0;
    let afterCount = 0;

    for (const p of photos) {
      const s = p.stage || 'During';
      if (s === 'Before') beforeCount++;
      if (s === 'During') duringCount++;
      if (s === 'After') afterCount++;

      if (p.id === photoId) {
        if (s === 'Before') return `Before #${beforeCount}`;
        if (s === 'During') return `During #${duringCount}`;
        if (s === 'After') return `After #${afterCount}`;
      }
    }
    return 'Inspection Photo';
  };

  // Reordering handlers
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...photos];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    onChangePhotos(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= photos.length - 1) return;
    const updated = [...photos];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    onChangePhotos(updated);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= photos.length || toIndex >= photos.length) return;
    const updated = [...photos];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChangePhotos(updated);
  };

  const handleRemovePhoto = (photoId: string) => {
    const updated = photos.filter(p => p.id !== photoId);
    onChangePhotos(updated);
  };

  const handleStageChange = (photoId: string, newStage: 'Before' | 'During' | 'After') => {
    const updated = photos.map(p => p.id === photoId ? { ...p, stage: newStage } : p);
    onChangePhotos(updated);
  };

  const handleQuickCaptionApply = (photoId: string, captionText: string) => {
    const updated = photos.map(p => p.id === photoId ? { ...p, caption: captionText } : p);
    onChangePhotos(updated);
  };

  // File Upload Processor
  const handleProcessFiles = async (files: FileList | File[]) => {
    const filesArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (filesArray.length === 0) return;

    try {
      setIsProcessingUpload(true);
      const newAttachments: PhotoAttachment[] = [];

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        
        // Auto-assign stage sequence: First photo defaults to Before or During
        let autoStage: 'Before' | 'During' | 'After' = 'During';
        if (photos.length === 0 && i === 0) autoStage = 'Before';
        else if (photos.length === 1 && i === 0) autoStage = 'During';
        else if (photos.length >= 2 && i === filesArray.length - 1) autoStage = 'After';

        const attachment = await processAndFramePhotoFile(file, {
          maxSizeBytes: compressionCapBytes,
          stage: autoStage
        });

        // If context provides coordinates, attach GPS metadata
        if (context?.locationName) attachment.locationName = context.locationName;
        if (context?.canalSegment) attachment.canalSegment = context.canalSegment;
        if (context?.nisName) attachment.featureName = context.nisName;

        newAttachments.push(attachment);
      }

      onChangePhotos([...photos, ...newAttachments]);
    } catch (err) {
      console.error('Photo upload processing error:', err);
    } finally {
      setIsProcessingUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Drag & Drop handlers for upload zone
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(false);
    if (disabled || isProcessingUpload) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  };

  return (
    <div 
      onDragOver={e => { e.preventDefault(); setDragOverZone(true); }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOverZone(false);
        }
      }}
      onDrop={handleDrop}
      className={`space-y-4 relative transition-all rounded-2xl ${
        dragOverZone && photos.length > 0 ? 'ring-2 ring-emerald-500 bg-emerald-950/10 p-2' : ''
      }`}
    >
      {/* Top Action Toolbar: Camera, Upload Files & Photography Protocol */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-1">
        <div className="flex items-center gap-2">
          {/* Open Camera Button */}
          <label className="py-2 px-3 bg-[#166534] hover:bg-[#15803d] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40 transition active:scale-95">
            <Camera className="w-4 h-4" />
            <span>Open Camera</span>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={disabled || isProcessingUpload}
              onChange={e => e.target.files && handleProcessFiles(e.target.files)}
              className="hidden"
            />
          </label>

          {/* Upload Files Button (Mobile gallery direct picker) */}
          <label className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-sm active:scale-95">
            <Upload className="w-4 h-4 text-[#166534] dark:text-emerald-400" />
            <span>Upload Files</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp"
              multiple
              disabled={disabled || isProcessingUpload}
              onChange={e => e.target.files && handleProcessFiles(e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {/* Payload Summary & Photography Protocol */}
        <div className="flex items-center gap-2">
          {photos.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-[11px] text-slate-300 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-[#166534] dark:text-emerald-400" />
              <span>{photos.length} photo{photos.length > 1 ? 's' : ''} ({formatBytes(totalSizeBytes)})</span>
            </div>
          )}

          {onOpenPhotographyGuide && (
            <button
              type="button"
              onClick={onOpenPhotographyGuide}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-xl transition cursor-pointer"
              title="Photography Protocol & Guidelines"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Drag & Drop Upload Zone (Shown only when NO photos are uploaded yet) */}
      {photos.length === 0 && (
        <div
          className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all ${
            dragOverZone
              ? 'border-emerald-500 bg-emerald-950/20'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-1.5">
            <ImageIcon className="w-6 h-6 text-slate-500" />
            <p className="text-xs font-semibold text-slate-300">
              {isProcessingUpload ? 'Compressing & Framing to 4:3 Landscape...' : 'Drag & drop inspection photos here, or use the buttons above'}
            </p>
          </div>
        </div>
      )}

      {/* Uploaded Photos Grid Header */}
      {photos.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-b border-slate-800 pb-1.5">
          <span className="font-semibold text-slate-300">
            {photos.length} Inspection Photo{photos.length > 1 ? 's' : ''} Attached
          </span>
          <span className="font-mono text-emerald-400 font-bold">
            Total: {formatBytes(totalSizeBytes)}
          </span>
        </div>
      )}

      {/* Photos Cards Grid (Standard 4:3 Ratio Thumbnail Cards) */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {photos.map((photo, idx) => {
            const stageText = getStageLabel(photo.id);

            return (
              <div
                key={photo.id}
                draggable={!disabled}
                onDragStart={e => e.dataTransfer.setData('text/plain', String(idx))}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const srcIdx = Number(e.dataTransfer.getData('text/plain'));
                  if (!isNaN(srcIdx)) handleReorder(srcIdx, idx);
                }}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-3 space-y-2.5 transition shadow-lg group"
              >
                {/* Card Top Header: Drag Handle, Stage Pills, Size Badge & Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Reorder Buttons */}
                    <div className="flex items-center text-slate-500">
                      <button
                        type="button"
                        disabled={idx === 0 || disabled}
                        onClick={() => handleMoveUp(idx)}
                        className="p-1 hover:text-emerald-400 disabled:opacity-20 transition cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === photos.length - 1 || disabled}
                        onClick={() => handleMoveDown(idx)}
                        className="p-1 hover:text-emerald-400 disabled:opacity-20 transition cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Stage Toggle Pills */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                      {(['Before', 'During', 'After'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleStageChange(photo.id, s)}
                          className={`px-2 py-0.5 rounded transition cursor-pointer ${
                            photo.stage === s
                              ? s === 'Before'
                                ? 'bg-amber-500 text-slate-950 font-black'
                                : s === 'During'
                                ? 'bg-[#15803d] text-white font-black'
                                : 'bg-emerald-500 text-slate-950 font-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Action Buttons: Delete Photo */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 4:3 Thumbnail Plate (Clean Preview Clickable to Open Studio) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditingPhotoIndex(idx)}
                  className="relative w-full aspect-[4/3] bg-white rounded-xl overflow-hidden shadow-inner cursor-pointer group/plate"
                  title="Click to adjust 4:3 framing and caption"
                >
                  <img
                    src={photo.url || photo.dataUrl}
                    alt={photo.caption || 'Site inspection photo'}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/plate:opacity-100 flex items-center justify-center transition-opacity gap-2">
                    <span className="px-3 py-1.5 bg-[#15803d] text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Adjust 4:3 Framing</span>
                    </span>
                  </div>
                </div>

                {/* Inline Caption Editor with Auto-Expanding Textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span>Photo Caption</span>
                    </label>
                  </div>

                  <AutoExpandingCaptionTextarea
                    value={photo.caption || ''}
                    disabled={disabled}
                    onChange={val => handleQuickCaptionApply(photo.id, val)}
                    placeholder="Enter formal photo caption or select 3-step options below..."
                  />

                  {/* Inline 3-Batch Tap Caption Selector */}
                  <Inline3TapCaptionSelector
                    activity={context?.maintenanceActivity}
                    stage={photo.stage}
                    currentCaption={photo.caption}
                    locationName={photo.locationName || context?.locationName}
                    canalSegment={photo.canalSegment || context?.canalSegment}
                    disabled={disabled}
                    onApplyCaption={cap => handleQuickCaptionApply(photo.id, cap)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox 4:3 Framing & Caption Studio Modal */}
      {editingPhotoIndex !== null && photos[editingPhotoIndex] && (
        <PhotoPreviewModal
          isOpen={editingPhotoIndex !== null}
          onClose={() => setEditingPhotoIndex(null)}
          photo={photos[editingPhotoIndex]}
          context={context}
          maxCompressionBytes={compressionCapBytes}
          onSavePhoto={(updated) => {
            const updatedList = [...photos];
            updatedList[editingPhotoIndex] = updated;
            onChangePhotos(updatedList);
          }}
        />
      )}
    </div>
  );
};
