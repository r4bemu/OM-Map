import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, Layers, Hash } from 'lucide-react';
import { GISLayer } from '../types';

interface DeleteLayerConfirmationModalProps {
  isOpen: boolean;
  layer: GISLayer | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteLayerConfirmationModal: React.FC<DeleteLayerConfirmationModalProps> = ({
  isOpen,
  layer,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !layer) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-layer-title"
    >
      <div 
        className="bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 text-left relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/60 hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 shrink-0">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h3 id="delete-layer-title" className="text-base font-bold text-white">Delete GIS Dataset Layer</h3>
            <p className="text-xs text-rose-300/80 font-medium">Permanent deletion confirmation</p>
          </div>
        </div>

        {/* Prompt */}
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Are you sure you want to permanently delete this GIS dataset? This action cannot be undone and will remove the layer from the map and layer catalog.
        </p>

        {/* Layer Info Preview Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 mb-5 space-y-2">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-sm"
              style={{ backgroundColor: layer.color || '#3b82f6' }}
            />
            <span className="text-xs font-bold text-white truncate">{layer.name}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Layers className="w-3 h-3 text-slate-500" />
              <span className="truncate">Category: <strong className="text-slate-200">{layer.category || 'Canals'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Hash className="w-3 h-3 text-slate-500" />
              <span>Features: <strong className="text-slate-200">{layer.featureCount || (layer.data?.features ? layer.data.features.length : 0)}</strong></span>
            </div>
            {layer.geometryType && (
              <div className="text-slate-400 col-span-2">
                Geometry: <strong className="text-slate-200 uppercase">{layer.geometryType}</strong>
                {layer.imoOffice ? ` • ${layer.imoOffice}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl border border-rose-500/50 shadow-lg shadow-rose-950/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Dataset'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
