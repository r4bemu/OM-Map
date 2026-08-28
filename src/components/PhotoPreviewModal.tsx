import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  MoveHorizontal, 
  MoveVertical, 
  Check, 
  Sparkles, 
  Camera, 
  Tag, 
  FileText,
  Sliders,
  Maximize2
} from 'lucide-react';
import { PhotoAttachment, PhotoFramingConfig } from '../types';
import { Inline3TapCaptionSelector } from './Inline3TapCaptionSelector';
import { 
  renderFramedImage, 
  calculateDefaultFraming, 
  TARGET_CANVAS_WIDTH, 
  TARGET_CANVAS_HEIGHT,
  DEFAULT_COMPRESSION_CAP_BYTES,
  formatBytes
} from '../utils/imageCompressor';
import { CaptionContext } from '../utils/captionGenerator';

interface PhotoPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: PhotoAttachment | null;
  onSavePhoto: (updatedPhoto: PhotoAttachment) => void;
  context?: CaptionContext;
  maxCompressionBytes?: number;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  isOpen,
  onClose,
  photo,
  onSavePhoto,
  context,
  maxCompressionBytes = DEFAULT_COMPRESSION_CAP_BYTES
}) => {
  if (!isOpen || !photo) return null;

  const rawMasterSource = photo.sourceDataUrl || photo.dataUrl || photo.url;

  // Local Framing State initialized from photo.framingConfig or calculated default
  const [framing, setFraming] = useState<PhotoFramingConfig>(() => {
    if (photo.framingConfig) {
      return { ...photo.framingConfig };
    }
    return {
      mode: 'fit-width',
      zoom: 1.0,
      panStep: 0,
      offsetXPercent: 0,
      offsetYPercent: 0
    };
  });

  const [stage, setStage] = useState<'Before' | 'During' | 'After'>(photo.stage || 'During');
  const [caption, setCaption] = useState<string>(photo.caption || '');
  const [livePreviewUrl, setLivePreviewUrl] = useState<string>(photo.url || photo.dataUrl || '');
  const [liveSizeBytes, setLiveSizeBytes] = useState<number>(photo.sizeBytes || 0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imageNaturalDim, setImageNaturalDim] = useState<{ width: number; height: number; aspect: number }>({
    width: 1400,
    height: 1050,
    aspect: 1.3333
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number; initialStep: number }>({ x: 0, y: 0, initialStep: 0 });

  // Load master image and detect natural aspect ratio
  useEffect(() => {
    if (!rawMasterSource) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 1400;
      const h = img.naturalHeight || 1050;
      const aspect = w / Math.max(1, h);
      setImageNaturalDim({ width: w, height: h, aspect });

      if (!photo.framingConfig) {
        const def = calculateDefaultFraming(w, h);
        setFraming(def);
      }
    };
    img.src = rawMasterSource;
  }, [rawMasterSource, photo]);

  // Check if image overflows the 4:3 frame in the current mode to enable/disable panning
  const hasOverflow = useMemo(() => {
    const targetAspect = TARGET_CANVAS_WIDTH / TARGET_CANVAS_HEIGHT; // 1.3333
    const zoom = framing.zoom || 1.0;

    if (framing.mode === 'fit-width') {
      const drawnH = (TARGET_CANVAS_WIDTH / imageNaturalDim.aspect) * zoom;
      return drawnH > TARGET_CANVAS_HEIGHT + 2; // Taller than 4:3 frame
    } else if (framing.mode === 'fit-height') {
      const drawnW = (TARGET_CANVAS_HEIGHT * imageNaturalDim.aspect) * zoom;
      return drawnW > TARGET_CANVAS_WIDTH + 2; // Wider than 4:3 frame
    }
    return zoom > 1.01;
  }, [framing.mode, framing.zoom, imageNaturalDim]);

  // Live Canvas Rendering
  useEffect(() => {
    let active = true;
    const render = async () => {
      if (!rawMasterSource) return;
      try {
        setIsProcessing(true);
        const result = await renderFramedImage(
          rawMasterSource,
          framing,
          TARGET_CANVAS_WIDTH,
          TARGET_CANVAS_HEIGHT,
          maxCompressionBytes
        );
        if (active) {
          setLivePreviewUrl(result.dataUrl);
          setLiveSizeBytes(result.sizeBytes);
          setIsProcessing(false);
        }
      } catch (err) {
        console.warn('Framing preview render error:', err);
        if (active) setIsProcessing(false);
      }
    };

    const timer = setTimeout(render, 40);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rawMasterSource, framing, maxCompressionBytes]);

  // Direct Interactive Canvas Drag Handling
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasOverflow) return;
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialStep: framing.panStep ?? 0
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !hasOverflow) return;
    const deltaX = e.clientX - dragStartPosRef.current.x;
    const deltaY = e.clientY - dragStartPosRef.current.y;

    if (framing.mode === 'fit-height') {
      // Horizontal pan drag (drag left -> shift right, drag right -> shift left)
      const stepDelta = Math.round((deltaX / 18));
      const nextStep = Math.max(-10, Math.min(10, dragStartPosRef.current.initialStep - stepDelta));
      if (nextStep !== framing.panStep) {
        setFraming(prev => ({ ...prev, panStep: nextStep }));
      }
    } else {
      // Vertical pan drag (drag up -> shift down, drag down -> shift up)
      const stepDelta = Math.round((deltaY / 18));
      const nextStep = Math.max(-10, Math.min(10, dragStartPosRef.current.initialStep - stepDelta));
      if (nextStep !== framing.panStep) {
        setFraming(prev => ({ ...prev, panStep: nextStep }));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  // Mouse Wheel / Trackpad Zoom handling on the 4:3 canvas plate
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
      setFraming(prev => {
        const cur = prev.zoom || 1.0;
        const next = Math.max(0.5, Math.min(2.0, Number((cur + zoomDelta).toFixed(2))));
        return { ...prev, zoom: next };
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Zoom controls
  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, Number(newZoom.toFixed(2))));
    setFraming(prev => ({ ...prev, zoom: clamped }));
  };

  const handleResetFraming = () => {
    const def = calculateDefaultFraming(imageNaturalDim.width, imageNaturalDim.height);
    setFraming({ ...def, zoom: 1.0, panStep: 0 });
  };

  // Save changes and return to parent
  const handleSave = () => {
    const updated: PhotoAttachment = {
      ...photo,
      url: livePreviewUrl,
      dataUrl: livePreviewUrl,
      sourceDataUrl: rawMasterSource,
      stage,
      caption: caption.trim(),
      sizeBytes: liveSizeBytes,
      framingConfig: { ...framing }
    };
    onSavePhoto(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[96vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200 font-sans"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 truncate">
                <span>4:3 Document Photo Framing &amp; Caption Studio</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  1400×1050 px (4:3)
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Pure WYSIWYG document framing — exactly as it appears in the official PDF report
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
            
            {/* LEFT / CENTER: PURE WYSIWYG 4:3 DOCUMENT PREVIEW PLATE */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-3">
              
              {/* The Pure 4:3 Canvas Plate (No soft borders, no rounded corners, no green brackets, no floating status overlays) */}
              <div className="w-full flex justify-center bg-slate-950/60 p-2 sm:p-3 rounded-xl border border-slate-800">
                <div 
                  ref={containerRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={`relative w-full aspect-[4/3] max-w-[560px] bg-white overflow-hidden shadow-2xl select-none ${
                    hasOverflow ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                  }`}
                  title={hasOverflow ? 'Click and drag to pan image inside 4:3 frame' : '100% full view inside 4:3 frame'}
                >
                  {/* Clean 4:3 Image Plate with exact WYSIWYG fidelity */}
                  {livePreviewUrl ? (
                    <img 
                      src={livePreviewUrl} 
                      alt="4:3 Document Preview" 
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-mono">
                      Generating 4:3 Canvas...
                    </div>
                  )}

                  {/* Document Margin Guide Crosshair on hover */}
                  <div className="absolute inset-0 border border-slate-900/10 pointer-events-none" />
                </div>
              </div>

              {/* Single Unified Panning Scrollbar (-10 to +10 steps, Center 0) */}
              <div className="w-full max-w-[560px] bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    {framing.mode === 'fit-height' ? (
                      <>
                        <MoveHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>◀ Pan Left (-10)</span>
                      </>
                    ) : (
                      <>
                        <MoveVertical className="w-3.5 h-3.5 text-emerald-400" />
                        <span>▲ Pan Up (+10)</span>
                      </>
                    )}
                  </span>

                  <span className="text-[11px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {framing.panStep === 0 ? 'Center (0)' : `Offset ${framing.panStep > 0 ? `+${framing.panStep}` : framing.panStep}`}
                  </span>

                  <span className="flex items-center gap-1.5 text-slate-400">
                    {framing.mode === 'fit-height' ? (
                      <>
                        <span>Pan Right (+10) ▶</span>
                      </>
                    ) : (
                      <>
                        <span>Pan Down (-10) ▼</span>
                      </>
                    )}
                  </span>
                </div>

                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={1}
                  disabled={!hasOverflow}
                  value={framing.panStep ?? 0}
                  onChange={(e) => setFraming(prev => ({ ...prev, panStep: Number(e.target.value) }))}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                    hasOverflow
                      ? 'bg-slate-800 accent-[#15803d]'
                      : 'bg-slate-800/40 opacity-40 cursor-not-allowed'
                  }`}
                />
                {!hasOverflow && (
                  <p className="text-[10px] text-center text-slate-500 font-mono">
                    100% of image fits inside 4:3 frame — panning centered
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR: FRAMING CONTROLS, ZOOM & CONTEXTUAL CAPTION ASSIGNMENT */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Framing Mode & Zoom Card */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Framing &amp; Aspect Ratio Mode</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResetFraming}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Reset to 100% full view default"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset 100%</span>
                  </button>
                </div>

                {/* Mode Selector Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFraming(prev => ({ ...prev, mode: 'fit-width', zoom: 1.0, panStep: 0 }))}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      framing.mode === 'fit-width'
                        ? 'bg-[#15803d] text-white border-emerald-500 shadow-md shadow-emerald-950'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                    title="Fit 100% width and reset zoom to 100%"
                  >
                    <MoveVertical className="w-3.5 h-3.5 shrink-0" />
                    <span>Fit Width (Vertical Pan)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFraming(prev => ({ ...prev, mode: 'fit-height', zoom: 1.0, panStep: 0 }))}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      framing.mode === 'fit-height'
                        ? 'bg-[#15803d] text-white border-emerald-500 shadow-md shadow-emerald-950'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                    title="Fit 100% height and reset zoom to 100%"
                  >
                    <MoveHorizontal className="w-3.5 h-3.5 shrink-0" />
                    <span>Fit Height (Horizontal Pan)</span>
                  </button>
                </div>

                {/* Zoom Scale Controls (50% to 200%) - Controllable via mouse wheel & range slider */}
                <div 
                  onWheel={(e) => {
                    const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
                    setFraming(prev => {
                      const cur = prev.zoom || 1.0;
                      const next = Math.max(0.5, Math.min(2.0, Number((cur + zoomDelta).toFixed(2))));
                      return { ...prev, zoom: next };
                    });
                  }}
                  className="space-y-1.5 pt-1"
                >
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold">Zoom Scale (Scroll Mouse / Drag Bar)</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.round((framing.zoom || 1.0) * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleZoomChange((framing.zoom || 1.0) - 0.1)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      value={framing.zoom || 1.0}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#15803d]"
                    />

                    <button
                      type="button"
                      onClick={() => handleZoomChange((framing.zoom || 1.0) + 0.1)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Inspection Stage Selector */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Inspection Stage Sequence
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Before', 'During', 'After'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStage(s)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                        stage === s
                          ? s === 'Before'
                            ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950'
                            : s === 'During'
                            ? 'bg-[#15803d] text-white border-emerald-500 shadow-md shadow-emerald-950'
                            : 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context-Aware 3-Level Photo Caption Selector */}
              {/* Context-Aware 3-Level Photo Caption Selector */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Photo Caption Selection</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{caption.length} chars</span>
                </div>

                {/* Custom Caption Input */}
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Enter formal photo caption for the official report, or select 3-step options below..."
                  className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2.5 rounded-xl focus:border-cyan-500 focus:outline-none min-h-[72px] resize-y font-medium leading-relaxed"
                />

                {/* Inline 3-Batch Tap Caption Selector */}
                <Inline3TapCaptionSelector
                  activity={context?.maintenanceActivity}
                  stage={stage}
                  currentCaption={caption}
                  locationName={photo.locationName || context?.locationName}
                  canalSegment={photo.canalSegment || context?.canalSegment}
                  onApplyCaption={(cap) => setCaption(cap)}
                />
              </div>

            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-950/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="px-5 py-2 bg-[#15803d] hover:bg-[#16a34a] text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-950 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Apply 4:3 Framing &amp; Caption</span>
          </button>
        </div>

      </div>
    </div>
  );
};
