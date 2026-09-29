import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Download, 
  Trash2, 
  Layers, 
  Search, 
  Plus,
  Shuffle,
  Tag,
  Files
} from 'lucide-react';
import { parseGISFile, ParsedGISResult } from '../utils/kmzParser';
import { GISLayer } from '../types';

import { classifyVectorItem, BLUE_PALETTE } from '../utils/canalLayerClassifier';
import { DeleteLayerConfirmationModal } from './DeleteLayerConfirmationModal';
import { detectImoFromFileName } from '../config/authUsers';
import { uploadGISLayerToDrive } from '../lib/googleDriveService';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLayer: (layer: GISLayer) => void;
  layers?: GISLayer[];
  onToggleVisibility?: (layerId: string) => void;
  onDeleteLayer?: (layerId: string) => void;
  defaultImo?: string;
}

const PALETTE_COLORS = [
  '#38bdf8', // Light Blue (Main Canals)
  '#2563eb', // Blue (Lateral Canals)
  '#1e3a8a', // Dark Navy Blue (Unclassified Canals)
  '#0284c7', // Sky / Azure Blue (Structures)
  '#0ea5e9', // Ocean Blue
  '#1d4ed8', // Royal Deep Blue
  '#1e40af', // Indigo Navy
  '#0369a1'  // Marine Blue
];

function getRandomGISColor(): string {
  const randomIndex = Math.floor(Math.random() * PALETTE_COLORS.length);
  return PALETTE_COLORS[randomIndex];
}

function detectGISCategory(
  fileName: string,
  geometryType: 'LineString' | 'Point' | 'Mixed' | string
): 'Canals' | 'Structures' | 'Maintenance' | 'Operations' {
  const nameLower = fileName.toLowerCase();

  if (nameLower.includes('maintenance') || nameLower.includes('wmr') || nameLower.includes('desilt') || nameLower.includes('clearing') || nameLower.includes('repair')) {
    return 'Maintenance';
  }

  if (nameLower.includes('operation') || nameLower.includes('operational') || nameLower.includes('discharge') || nameLower.includes('flow') || nameLower.includes('water_level')) {
    return 'Operations';
  }

  if (nameLower.includes('structure') || nameLower.includes('gate') || nameLower.includes('dam') || nameLower.includes('turnout') || nameLower.includes('point')) {
    return 'Structures';
  }

  if (geometryType === 'Point') return 'Structures';

  return 'Canals';
}

export const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddLayer,
  layers = [],
  onToggleVisibility,
  onDeleteLayer,
  defaultImo
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'all'>('upload');

  // Upload Form State
  const [isParsing, setIsParsing] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [parsingProgressText, setParsingProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Single File Preview State
  const [parsedResult, setParsedResult] = useState<ParsedGISResult | null>(null);
  const [layerName, setLayerName] = useState('');
  const [layerCategory, setLayerCategory] = useState<'Canals' | 'Structures' | 'Maintenance' | 'Operations'>('Canals');
  const [layerColor, setLayerColor] = useState('#06b6d4');
  const [layerOpacity, setLayerOpacity] = useState(0.8);

  // IMO Office Jurisdiction State
  const [selectedImo, setSelectedImo] = useState<string>(
    defaultImo && defaultImo !== 'All IMOs' && defaultImo !== 'Regional Office IV-B'
      ? defaultImo
      : 'Mindoro Oriental-Marinduque-Romblon IMO'
  );
  const [isImoAutoDetected, setIsImoAutoDetected] = useState(false);

  // Search filter for All GIS Data tab
  const [filterQuery, setFilterQuery] = useState('');

  // Delete Confirmation Modal State
  const [layerPendingDelete, setLayerPendingDelete] = useState<GISLayer | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetUploadState = () => {
    setIsParsing(false);
    setIsUploadingDrive(false);
    setParsingProgressText('');
    setError(null);
    setParsedResult(null);
    setLayerName('');
    setLayerCategory('Canals');
    setLayerColor(getRandomGISColor());
    setLayerOpacity(0.8);
    setIsImoAutoDetected(false);
    setSelectedImo(
      defaultImo && defaultImo !== 'All IMOs' && defaultImo !== 'Regional Office IV-B'
        ? defaultImo
        : 'Mindoro Oriental-Marinduque-Romblon IMO'
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Reset upload state whenever modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      resetUploadState();
      setSuccessMessage(null);
      setActiveTab('upload');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFilesChange = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setError(null);
    setSuccessMessage(null);
    setIsParsing(true);
    setParsedResult(null);

    const fileArray = Array.from(files);

    // If MULTIPLE files uploaded at once
    if (fileArray.length > 1) {
      setParsingProgressText(`Parsing ${fileArray.length} GIS files in batch...`);
      
      let successCount = 0;
      const failedFiles: string[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setParsingProgressText(`Processing file ${i + 1} of ${fileArray.length}: ${file.name}...`);
        
        try {
          const result = await parseGISFile(file);
          const autoCategory = detectGISCategory(result.fileName, result.geometryType);
          
          const classification = classifyVectorItem(
            result.fileName,
            autoCategory,
            undefined,
            result.geoJsonData?.features?.[0]?.properties,
            result.geometryType
          );

          const safeGeomType: 'LineString' | 'Point' | 'Mixed' = 
            result.geometryType === 'Point' ? 'Point' : 'LineString';

          const isMultiFeature = (result.geoJsonData?.features?.length || 0) > 1;
          const assignedSubCategory = classification.isStructure
            ? 'Structures'
            : isMultiFeature
            ? 'Canal Network'
            : classification.hierarchyType;

          const fileImo = detectImoFromFileName(result.fileName) || selectedImo;

          // Attempt Google Drive backup
          let driveInfo: { fileId?: string; folderId?: string; source: string } = { source: 'Upload' };
          try {
            const driveRes = await uploadGISLayerToDrive(fileImo, result.fileName, result.geoJsonData);
            if (driveRes.success) {
              driveInfo = {
                fileId: driveRes.fileId,
                folderId: driveRes.folderId,
                source: driveRes.source
              };
            }
          } catch (_) {}

          const newLayer: GISLayer = {
            id: `layer-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            name: result.fileName.replace(/\.[^/.]+$/, ''),
            category: classification.isStructure ? 'Structures' : 'Canals',
            subCategory: assignedSubCategory,
            visible: true,
            color: classification.color,
            opacity: classification.opacity ?? 0.85,
            data: result.geoJsonData,
            featureCount: result.featureCount,
            geometryType: safeGeomType,
            uploadedAt: new Date().toISOString(),
            sizeBytes: result.fileSize,
            isDefault: false,
            imoOffice: fileImo,
            driveFileId: driveInfo.fileId,
            driveFolderId: driveInfo.folderId,
            source: driveInfo.source as any,
            fileName: result.fileName
          };

          onAddLayer(newLayer);
          successCount++;
        } catch (err: any) {
          console.error(`Error parsing file ${file.name}:`, err);
          failedFiles.push(file.name);
        }
      }

      setIsParsing(false);
      setParsingProgressText('');

      if (successCount > 0) {
        let msg = `Successfully uploaded and added ${successCount} GIS layer(s) to the map with assigned IMO offices!`;
        if (failedFiles.length > 0) {
          msg += ` (${failedFiles.length} file(s) failed: ${failedFiles.join(', ')})`;
        }
        setSuccessMessage(msg);
      } else {
        setError(`Failed to process uploaded files: ${failedFiles.join(', ')}`);
      }

      resetUploadState();
      return;
    }

    // SINGLE File Upload
    const singleFile = fileArray[0];
    setParsingProgressText(`Parsing ${singleFile.name}...`);

    try {
      const result = await parseGISFile(singleFile);
      setParsedResult(result);
      setLayerName(result.fileName.replace(/\.[^/.]+$/, ''));
      
      const autoCategory = detectGISCategory(result.fileName, result.geometryType);
      const classification = classifyVectorItem(
        result.fileName,
        autoCategory,
        undefined,
        result.geoJsonData?.features?.[0]?.properties,
        result.geometryType
      );

      setLayerCategory(classification.isStructure ? 'Structures' : 'Canals');
      setLayerColor(classification.color);

      // Auto-detect IMO from filename
      const detectedImo = detectImoFromFileName(result.fileName);
      if (detectedImo) {
        setSelectedImo(detectedImo);
        setIsImoAutoDetected(true);
      } else {
        setIsImoAutoDetected(false);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err.message || 'Failed to parse GIS file. Ensure it is a valid GeoJSON, KML, or KMZ file.');
    } finally {
      setIsParsing(false);
      setParsingProgressText('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesChange(e.dataTransfer.files);
    }
  };

  const handleSubmitSingle = async () => {
    if (!parsedResult) return;

    setIsUploadingDrive(true);
    setParsingProgressText('Synchronizing layer to Google Drive and local storage...');

    const safeGeomType: 'LineString' | 'Point' | 'Mixed' = 
      parsedResult.geometryType === 'Point' ? 'Point' : 'LineString';

    const classification = classifyVectorItem(
      parsedResult.fileName,
      layerCategory,
      undefined,
      parsedResult.geoJsonData?.features?.[0]?.properties,
      parsedResult.geometryType
    );

    const isMultiFeature = (parsedResult.geoJsonData?.features?.length || 0) > 1;
    const assignedSubCategory = classification.isStructure
      ? 'Structures'
      : isMultiFeature
      ? 'Canal Network'
      : classification.hierarchyType;

    let driveInfo: { fileId?: string; folderId?: string; source: string; message?: string } = { source: 'Upload' };
    try {
      const driveRes = await uploadGISLayerToDrive(selectedImo, layerName || parsedResult.fileName, parsedResult.geoJsonData);
      if (driveRes.success) {
        driveInfo = {
          fileId: driveRes.fileId,
          folderId: driveRes.folderId,
          source: driveRes.source,
          message: driveRes.message
        };
      }
    } catch (dErr) {
      console.warn('Drive upload error during single submit:', dErr);
    }

    const newLayer: GISLayer = {
      id: `layer-${Date.now()}`,
      name: layerName || parsedResult.fileName,
      category: layerCategory as any,
      subCategory: assignedSubCategory,
      visible: true,
      color: layerColor,
      opacity: layerOpacity,
      data: parsedResult.geoJsonData,
      featureCount: parsedResult.featureCount,
      geometryType: safeGeomType,
      uploadedAt: new Date().toISOString(),
      sizeBytes: parsedResult.fileSize,
      isDefault: false,
      imoOffice: selectedImo,
      driveFileId: driveInfo.fileId,
      driveFolderId: driveInfo.folderId,
      source: driveInfo.source as any,
      fileName: parsedResult.fileName
    };

    onAddLayer(newLayer);
    setIsUploadingDrive(false);
    
    const driveStatusText = driveInfo.source === 'Google Drive' 
      ? 'and backed up to Google Drive' 
      : 'and stored in persistent database';
    setSuccessMessage(`Layer "${newLayer.name}" added to map (${selectedImo}) ${driveStatusText}! You can upload more files below.`);
    resetUploadState();
  };

  const downloadLayerAsGeoJSON = (layer: GISLayer) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(layer.data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `${layer.name.toLowerCase().replace(/\s+/g, '_')}_export.geojson`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLayers = layers.filter(l => 
    l.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.category.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-heading">GIS Data Center</h2>
              <p className="text-[11px] text-slate-400">Upload single or multiple GIS layers with auto-category detection</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'upload'
                ? 'border-cyan-400 text-cyan-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload GIS Data</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'all'
                ? 'border-cyan-400 text-cyan-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All GIS Datasets ({layers.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Success Notification */}
              {successMessage && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                  <button 
                    onClick={() => setSuccessMessage(null)}
                    className="text-emerald-400 hover:text-white text-xs font-bold shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Target IMO Jurisdiction Selector */}
              {!parsedResult && (
                <div className="p-3 bg-slate-800/40 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">Target IMO Office / Jurisdiction</span>
                    <span className="text-[10px] text-slate-400">Designated Google Drive cloud folder &amp; map filter scope</span>
                  </div>
                  <select
                    value={selectedImo}
                    onChange={(e) => {
                      setSelectedImo(e.target.value);
                      setIsImoAutoDetected(false);
                    }}
                    className="bg-slate-800 border border-slate-700 text-cyan-300 font-bold text-xs px-2.5 py-1.5 rounded-lg focus:border-cyan-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Mindoro Oriental-Marinduque-Romblon IMO">MOMARO IMO</option>
                    <option value="Occidental Mindoro IMO">OMIMO</option>
                    <option value="Palawan IMO">PALIMO</option>
                  </select>
                </div>
              )}

              {/* Default File Dropzone Window (Supports Multiple Files) */}
              {!parsedResult && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-800/40 hover:bg-slate-800/80 p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFilesChange(e.target.files)}
                    accept=".geojson,.json,.kml,.kmz"
                    multiple
                    className="hidden"
                  />
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-2 text-cyan-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-xs font-semibold">{parsingProgressText || 'Parsing GIS Vectors & Attributes...'}</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                        <Files className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-white mb-1">
                        Click or drag &amp; drop single or multiple GIS files here
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Supports batch upload for <strong className="text-cyan-400">.KMZ</strong>, <strong className="text-cyan-400">.GeoJSON</strong>, or <strong className="text-cyan-400">.KML</strong> files
                      </p>
                      <div className="mt-3 px-3 py-1 bg-slate-900/80 border border-slate-700 rounded-lg text-[10px] text-slate-400 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-emerald-400" />
                        <span>Categories automatically detected &amp; stroke/fill colors randomly assigned</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Parsing Error */}
              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Parsed Result Preview & Single Layer Confirmation */}
              {parsedResult && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Parsed {parsedResult.format} Data
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {(parsedResult.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 font-mono pt-1">
                      <div>Features: <strong>{parsedResult.featureCount}</strong></div>
                      <div>Geometry: <strong>{parsedResult.geometryType}</strong></div>
                    </div>
                  </div>

                  {/* Layer Config Fields (Category Auto-Detected, Color Randomly Assigned) */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Layer Display Name</label>
                      <input
                        type="text"
                        value={layerName}
                        onChange={(e) => setLayerName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs p-2.5 rounded-xl focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                        <span>Assigned IMO Office / Jurisdiction</span>
                        {isImoAutoDetected && (
                          <span className="text-[10px] text-emerald-400 font-medium lowercase tracking-normal bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            auto-detected
                          </span>
                        )}
                      </label>
                      <select
                        value={selectedImo}
                        onChange={(e) => {
                          setSelectedImo(e.target.value);
                          setIsImoAutoDetected(false);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-amber-300 font-bold text-xs p-2.5 rounded-xl focus:border-cyan-500 focus:outline-none cursor-pointer"
                      >
                        <option value="Mindoro Oriental-Marinduque-Romblon IMO">Mindoro Oriental-Marinduque-Romblon IMO (MOMARO)</option>
                        <option value="Occidental Mindoro IMO">Occidental Mindoro IMO (OMIMO)</option>
                        <option value="Palawan IMO">Palawan IMO (PALIMO)</option>
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Determines the designated Google Drive cloud archive folder and role-based IMO map filtering.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Layer Cabinet / Category</label>
                        <select
                          value={layerCategory}
                          onChange={(e) => setLayerCategory(e.target.value as any)}
                          className="w-full bg-slate-800 border border-slate-700 text-cyan-400 font-bold text-xs p-2.5 rounded-xl focus:border-cyan-500 focus:outline-none cursor-pointer"
                        >
                          <option value="Canals">Canals</option>
                          <option value="Structures">Structures</option>
                          <option value="Maintenance">Maintenance</option>
                          <option value="Operations">Operations</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Random Stroke / Fill Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={layerColor}
                            onChange={(e) => setLayerColor(e.target.value)}
                            className="w-9 h-9 rounded-xl border border-slate-700 bg-transparent cursor-pointer p-0"
                          />
                          <span className="text-xs text-slate-300 font-mono flex-1">{layerColor}</span>
                          <button
                            type="button"
                            onClick={() => setLayerColor(getRandomGISColor())}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition"
                            title="Randomize color"
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option to choose different file before submitting */}
                  <div className="pt-2 flex justify-start">
                    <button
                      type="button"
                      onClick={resetUploadState}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Choose different file(s)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All GIS Data Tab */}
          {activeTab === 'all' && (
            <div className="space-y-3">
              {/* Filter search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter datasets by name or category..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Datasets list */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {filteredLayers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No GIS data layers found.
                  </div>
                ) : (
                  filteredLayers.map((layer, idx) => (
                    <div
                      key={`${layer.id}-${idx}`}
                      className="p-3 bg-slate-800/50 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3 hover:border-slate-600 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-600"
                          style={{ backgroundColor: layer.color }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{layer.name}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                            {layer.imoOffice && (
                              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                {layer.imoOffice.includes('MOMARO') || layer.imoOffice.includes('Oriental')
                                  ? 'MOMARO'
                                  : layer.imoOffice.includes('Occidental') || layer.imoOffice.includes('OMIMO')
                                  ? 'OMIMO'
                                  : 'PALIMO'}
                              </span>
                            )}
                            <span className="bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-300 font-medium">{layer.category}</span>
                            <span>•</span>
                            <span className="font-mono">{layer.featureCount} features</span>
                            <span>•</span>
                            <span className="uppercase font-mono text-slate-400">{layer.geometryType}</span>
                            {Boolean(layer.driveFileId) && (
                              <>
                                <span>•</span>
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded text-[9px] font-mono">
                                  Drive
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle Active / Inactive */}
                        {onToggleVisibility && (
                          <button
                            onClick={() => onToggleVisibility(layer.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                              layer.visible
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                            }`}
                            title={layer.visible ? 'Click to Inactivate' : 'Click to Activate'}
                          >
                            {layer.visible ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Inactive</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Download Dataset as GeoJSON */}
                        <button
                          onClick={() => downloadLayerAsGeoJSON(layer)}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
                          title="Download GeoJSON Dataset"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete dataset */}
                        {onDeleteLayer && !layer.isDefault && (
                          <button
                            onClick={() => setLayerPendingDelete(layer)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition cursor-pointer"
                            title="Delete dataset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          {activeTab === 'upload' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                Close
              </button>
              {parsedResult && (
                <button
                  onClick={handleSubmitSingle}
                  disabled={isUploadingDrive}
                  className="px-5 py-2 text-xs font-bold bg-[#009933] hover:bg-[#00802b] disabled:opacity-50 text-white rounded-xl shadow-sm border border-[#00802b]/50 transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  {isUploadingDrive ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing to Drive...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Add Layer to Map</span>
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('upload')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Upload New Layer</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Layer Confirmation Modal */}
      <DeleteLayerConfirmationModal
        isOpen={Boolean(layerPendingDelete)}
        layer={layerPendingDelete}
        onClose={() => setLayerPendingDelete(null)}
        onConfirm={() => {
          if (layerPendingDelete && onDeleteLayer) {
            onDeleteLayer(layerPendingDelete.id);
            setLayerPendingDelete(null);
          }
        }}
      />
    </div>
  );
};
