import React, { useState } from 'react';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Download, 
  X, 
  Plus, 
  RotateCcw
} from 'lucide-react';
import { GISLayer, UserRole, FieldReport } from '../types';
import { clearAllLayersDB } from '../utils/offlineStorage';
import { exportLayerToGeoJson } from '../utils/geoJsonExport';

interface LayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layers: GISLayer[];
  fieldReports?: FieldReport[];
  onToggleVisibility: (layerId: string) => void;
  onChangeOpacity: (layerId: string, opacity: number) => void;
  onChangeColor: (layerId: string, color: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onOpenUpload: () => void;
  currentRole: UserRole;
  onSyncDriveLayers?: () => void;
  isSyncingDrive?: boolean;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  isOpen,
  onClose,
  layers,
  fieldReports = [],
  onToggleVisibility,
  onChangeOpacity,
  onChangeColor,
  onOpenUpload,
  currentRole,
  onSyncDriveLayers,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  if (!isOpen) return null;

  // Simplified categories: All, Canals, Structures, Maintenance, Operations
  const categories = ['All', 'Canals', 'Structures', 'Maintenance', 'Operations'];

  const uniqueLayers = Array.from(new Map<string, GISLayer>(layers.map(l => [l.id, l])).values());

  const getLayerCabinet = (l: GISLayer): 'Canals' | 'Structures' | 'Maintenance' | 'Operations' => {
    // 1. Check Maintenance Reports / Activity Category layers
    if (
      l.id.startsWith('layer-activity-') ||
      l.id === 'layer-reports-maintenance' ||
      l.id.startsWith('layer-maintenance-') ||
      l.category === 'Maintenance' ||
      l.category === 'Maintenance Reports' ||
      l.subCategory === 'Maintenance Reports' ||
      (l.name && l.name.toLowerCase().includes('maintenance'))
    ) {
      return 'Maintenance';
    }

    // 2. Check Operational Status Reports / State layers
    if (
      l.id.startsWith('layer-operational-') ||
      l.id === 'layer-reports-operational' ||
      l.category === 'Operations' ||
      l.category === 'Operational Status Reports' ||
      l.subCategory === 'Operational Status Reports' ||
      (l.name && (l.name.toLowerCase().includes('operational status') || l.name.toLowerCase().includes('operational report') || l.name.toLowerCase().includes('operational')))
    ) {
      return 'Operations';
    }

    // 3. Structures (Points, Dam, Intake, Gates)
    if (
      l.category === 'Structures' ||
      l.subCategory === 'Structures' ||
      l.geometryType === 'Point' ||
      (l.name && (l.name.toLowerCase().includes('structure') || l.name.toLowerCase().includes('gate') || l.name.toLowerCase().includes('dam')))
    ) {
      return 'Structures';
    }

    // 4. Default to Canals
    return 'Canals';
  };

  const isMatchCategory = (l: GISLayer, cat: string): boolean => {
    if (cat === 'All') return true;
    return getLayerCabinet(l) === cat;
  };

  const filteredLayers = uniqueLayers.filter(l => isMatchCategory(l, activeCategory));

  const isAllVisible = uniqueLayers.length > 0 && uniqueLayers.every(l => l.visible);

  const handleToggleAllVisibility = () => {
    const targetState = !isAllVisible;
    uniqueLayers.forEach(l => {
      if (l.visible !== targetState) {
        onToggleVisibility(l.id);
      }
    });
  };

  const downloadLayerAsGeoJSON = (layer: GISLayer) => {
    exportLayerToGeoJson(layer, fieldReports);
  };

  const handleClearDriveCache = async () => {
    if (confirm('Clear Google Drive vector feature cache to test cold downloading?\n\nYour custom layer configurations, colors, names, and opacity settings will be 100% PRESERVED.\n\nProceed?')) {
      try {
        await fetch('/api/drive/clear-cache', { method: 'POST' });
        await clearAllLayersDB();
        if (onSyncDriveLayers) {
          onSyncDriveLayers();
        }
      } catch (e: any) {
        alert('Failed to clear cache: ' + e?.message);
      }
    }
  };

  return (
    <aside
      className="fixed md:absolute top-16 md:top-20 right-2 md:right-4 z-40 w-auto md:w-80 max-h-[82vh] md:max-h-[600px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drawer Header */}
      <div className="p-2.5 border-b border-slate-700/80 flex items-center justify-between shrink-0 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#166534]/15 text-[#166534] dark:text-emerald-300 border border-[#166534]/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 font-heading flex items-center gap-1.5">
              <span>GIS Data Layers</span>
              {currentRole === 'Developer' && (
                <span className="text-[8px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-mono">
                  DEV
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400">
              {uniqueLayers.length} layers active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Hide All / Show All Toggle Button */}
          <button
            onClick={handleToggleAllVisibility}
            className={`px-2 py-1 rounded-lg border transition text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
              isAllVisible
                ? 'bg-[#166534]/20 text-[#166534] dark:text-emerald-300 border-[#166534]/50 hover:bg-[#166534]/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-slate-100'
            }`}
            title={isAllVisible ? 'Hide all active layers' : 'Show all active layers'}
          >
            {isAllVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{isAllVisible ? 'Hide All' : 'Show All'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Horizontal Category Pill Navigation (Efficient Space Budgeting) */}
      <div className="p-1.5 border-b border-slate-700/80 bg-slate-800/60 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 select-none">
        {categories.map((cat) => {
          const count = uniqueLayers.filter(l => isMatchCategory(l, cat)).length;
          const isActive = activeCategory === cat;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
                isActive
                  ? 'bg-[#166534] text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[9px] px-1 rounded-full ${isActive ? 'bg-black/30 text-white font-mono' : 'bg-slate-700 text-slate-300 font-mono'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Layer List Container */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 divide-y divide-slate-700/50">
        {filteredLayers.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-medium">
            No layers found in <span className="text-[#166534] dark:text-emerald-400 font-bold">{activeCategory}</span>.
          </div>
        ) : (
          filteredLayers.map((layer, idx) => {
            const assignedCabinet = getLayerCabinet(layer);
            const badgeStyle =
              assignedCabinet === 'Maintenance'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                : assignedCabinet === 'Operations'
                ? 'bg-pink-500/15 text-pink-800 dark:text-pink-300 border-pink-500/30'
                : assignedCabinet === 'Structures'
                ? 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30'
                : 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30';

            return (
              <div key={`${layer.id}-${idx}`} className="pt-2 first:pt-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => onToggleVisibility(layer.id)}
                      className={`p-1.5 rounded-lg transition border shrink-0 cursor-pointer ${
                        layer.visible
                          ? 'bg-[#166534]/15 text-[#166534] dark:text-emerald-300 border-[#166534]/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                    >
                      {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    <div className="min-w-0">
                      <h3 className={`text-xs font-bold truncate ${layer.visible ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
                        {layer.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-0.5">
                        <span className="font-mono text-[#166534] dark:text-emerald-400 font-semibold">{layer.featureCount} features</span>
                        <span>•</span>
                        <span className={`uppercase px-1.5 py-0.2 rounded font-mono font-bold text-[8px] border ${badgeStyle}`}>
                          {layer.subCategory || assignedCabinet} ({layer.geometryType || 'Mixed'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Layer Color Dot & Export Action */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="color"
                      value={layer.color}
                      onChange={(e) => onChangeColor(layer.id, e.target.value)}
                      className="w-5 h-5 rounded-full border border-slate-700 bg-transparent cursor-pointer p-0 overflow-hidden"
                      title="Change vector layer color"
                    />

                    <button
                      onClick={() => downloadLayerAsGeoJSON(layer)}
                      className="p-1 text-slate-400 hover:text-[#166534] dark:hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="Export as GeoJSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Opacity Slider Control */}
                <div className="flex items-center gap-2 px-2 py-0.5 bg-slate-800/60 rounded-lg text-[9px]">
                  <span className="text-slate-400 font-medium shrink-0">Opacity</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={layer.opacity}
                    onChange={(e) => onChangeOpacity(layer.id, parseFloat(e.target.value))}
                    className="w-full accent-[#166534] cursor-pointer h-1 bg-slate-700 rounded-lg"
                  />
                  <span className="text-[#166534] dark:text-emerald-400 font-mono w-7 text-right shrink-0 font-bold">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-2 border-t border-slate-700/80 bg-slate-800/80 flex items-center justify-between shrink-0">
        {(currentRole === 'Developer' || currentRole === 'RO Evaluator' || currentRole === 'RO Reviewer' || currentRole === 'IMO Evaluator' || currentRole === 'IMO Reviewer') ? (
          <button
            onClick={onOpenUpload}
            className="px-2.5 py-1 bg-[#166534] hover:bg-[#15803d] text-white border border-[#15803d]/50 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-3 h-3" />
            <span>Upload Layer</span>
          </button>
        ) : (
          <span className="text-[10px] text-slate-500 font-medium">Read-Only Layer Access</span>
        )}

        {(currentRole === 'Developer' || currentRole === 'RO Evaluator' || currentRole === 'IMO Evaluator') && (
          <div className="flex items-center gap-1">
            {onSyncDriveLayers && (
              <button
                onClick={onSyncDriveLayers}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[#15803d] hover:text-white border border-slate-700 rounded-lg text-[9px] font-mono transition flex items-center gap-1 cursor-pointer"
                title="Cold Sync Google Drive Folders"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Sync Drive</span>
              </button>
            )}

            {currentRole === 'Developer' && (
              <button
                onClick={handleClearDriveCache}
                className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-lg text-[9px] font-mono transition cursor-pointer"
                title="Safe Purge Server Cache & Cold Download"
              >
                Purge Cache
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
