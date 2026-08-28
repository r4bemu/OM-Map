import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Check, 
  ChevronRight, 
  RotateCcw, 
  CheckCircle2, 
  Layers, 
  HelpCircle, 
  Zap,
  Tag,
  ArrowRight,
  Info,
  X,
  Edit3
} from 'lucide-react';
import { 
  CaptionStage, 
  CaptionActivityCode, 
  PHOTO_CAPTION_CATEGORIES, 
  findCaptionCategory,
  ActivityCaptionCategory,
  Tap1Situation,
  Tap2Detail,
  Tap3Context
} from '../data/photoCaptionTree';
import { 
  assemblePhotoCaption, 
  normalizeCaptionStage,
  AssembledCaptionResult 
} from '../utils/photoCaptionAssembler';

export interface PhotoCaptionWizardProps {
  initialActivity?: string;
  initialStage?: 'Before' | 'During' | 'After' | CaptionStage;
  currentCaption?: string;
  locationName?: string;
  canalSegment?: string;
  onApplyCaption: (caption: string, stage?: 'Before' | 'During' | 'After') => void;
  onClose?: () => void;
  inlineMode?: boolean; // If true, renders inline without modal backdrop
}

export const PhotoCaptionWizard: React.FC<PhotoCaptionWizardProps> = ({
  initialActivity,
  initialStage = 'During',
  currentCaption = '',
  locationName,
  canalSegment,
  onApplyCaption,
  onClose,
  inlineMode = false
}) => {
  // Active Category State
  const [selectedActivityCode, setSelectedActivityCode] = useState<CaptionActivityCode>(() => {
    return findCaptionCategory(initialActivity).code;
  });

  // Active Stage State
  const [activeStage, setActiveStage] = useState<CaptionStage>(() => {
    return normalizeCaptionStage(initialStage);
  });

  // Active Selections
  const [selectedT1Id, setSelectedT1Id] = useState<string>('');
  const [selectedT2Ids, setSelectedT2Ids] = useState<string[]>([]);
  const [selectedT3Id, setSelectedT3Id] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [isEditingManually, setIsEditingManually] = useState<boolean>(false);

  // Resolved Category and Stage Configuration
  const currentCategory: ActivityCaptionCategory = useMemo(() => {
    return PHOTO_CAPTION_CATEGORIES.find(c => c.code === selectedActivityCode) || PHOTO_CAPTION_CATEGORIES[0];
  }, [selectedActivityCode]);

  const currentStageConfig = useMemo(() => {
    return currentCategory.stages[activeStage];
  }, [currentCategory, activeStage]);

  // Auto-declare T1 if stageConfig has skipT1 or single autoDeclared situation
  useEffect(() => {
    if (currentStageConfig?.skipT1 && currentStageConfig.situations.length > 0) {
      setSelectedT1Id(currentStageConfig.situations[0].id);
    } else if (currentStageConfig?.situations.length === 1 && currentStageConfig.situations[0].autoDeclared) {
      setSelectedT1Id(currentStageConfig.situations[0].id);
    } else {
      // If previous T1 is not in the new situations list, reset it
      const exists = currentStageConfig?.situations.some(s => s.id === selectedT1Id);
      if (!exists) {
        setSelectedT1Id(currentStageConfig?.situations[0]?.id || '');
      }
    }
    // Clear invalid T2 & T3 on stage/activity change
    setSelectedT2Ids([]);
    setSelectedT3Id('');
  }, [currentStageConfig, selectedActivityCode, activeStage]);

  // Selected T1 Situation object
  const activeT1: Tap1Situation | undefined = useMemo(() => {
    if (!currentStageConfig) return undefined;
    if (currentStageConfig.skipT1) return currentStageConfig.situations[0];
    return currentStageConfig.situations.find(s => s.id === selectedT1Id) || currentStageConfig.situations[0];
  }, [currentStageConfig, selectedT1Id]);

  // T2 toggle handler (multi-select)
  const handleToggleT2 = (t2Id: string) => {
    setSelectedT2Ids(prev => {
      if (prev.includes(t2Id)) {
        return prev.filter(id => id !== t2Id);
      } else {
        return [...prev, t2Id];
      }
    });
    setIsEditingManually(false);
  };

  // T3 select handler (single select with toggle / skip)
  const handleSelectT3 = (t3Id: string) => {
    if (selectedT3Id === t3Id) {
      setSelectedT3Id(''); // deselect
    } else {
      setSelectedT3Id(t3Id);
    }
    setIsEditingManually(false);
  };

  // Live Assembled Caption
  const assembledResult: AssembledCaptionResult = useMemo(() => {
    return assemblePhotoCaption({
      activityOrCode: selectedActivityCode,
      stage: activeStage,
      t1Id: selectedT1Id,
      t2Ids: selectedT2Ids,
      t3Id: selectedT3Id,
      locationName,
      canalSegment
    });
  }, [selectedActivityCode, activeStage, selectedT1Id, selectedT2Ids, selectedT3Id, locationName, canalSegment]);

  // Final caption text to display / apply
  const finalCaption = isEditingManually && customText ? customText : assembledResult.caption;

  // Sync custom text when assembled caption updates (if not manually editing)
  useEffect(() => {
    if (!isEditingManually && assembledResult.caption) {
      setCustomText(assembledResult.caption);
    }
  }, [assembledResult.caption, isEditingManually]);

  const handleApply = () => {
    const formattedStage = activeStage === 'BEFORE' ? 'Before' : activeStage === 'DURING' ? 'During' : 'After';
    onApplyCaption(finalCaption, formattedStage);
    if (onClose) onClose();
  };

  const handleReset = () => {
    setSelectedT2Ids([]);
    setSelectedT3Id('');
    setCustomText('');
    setIsEditingManually(false);
  };

  const content = (
    <div className="space-y-4">
      {/* Wizard Header Bar: Activity Category & Stage Pills */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  3-Level Photo Caption Wizard
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono">
                  Official Standard
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Pick 3 taps to compose standard, grammatically correct photo captions.
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Selector & Stage Switcher Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
          {/* Activity Category Select */}
          <div className="sm:col-span-7 space-y-1">
            <label className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Activity Category (12 Activities)</span>
            </label>
            <select
              value={selectedActivityCode}
              onChange={e => setSelectedActivityCode(e.target.value as CaptionActivityCode)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-xs px-2.5 py-1.5 rounded-xl focus:border-cyan-400 focus:outline-none cursor-pointer"
            >
              {PHOTO_CAPTION_CATEGORIES.map(cat => (
                <option key={cat.code} value={cat.code}>
                  [{cat.code}] {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Photo Stage Switcher (BEFORE / DURING / AFTER) */}
          <div className="sm:col-span-5 space-y-1">
            <label className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Photo Stage</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['BEFORE', 'DURING', 'AFTER'] as const).map(s => {
                const isSelected = activeStage === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveStage(s)}
                    className={`py-1 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                      isSelected
                        ? s === 'BEFORE'
                          ? 'bg-blue-600 text-white shadow-sm font-black'
                          : s === 'DURING'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-emerald-600 text-white shadow-sm font-black'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>{s === 'BEFORE' ? '🔵' : s === 'DURING' ? '🟡' : '🟢'}</span>
                    <span>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAP 1: WHAT IS THE CURRENT SITUATION?
         ===================================================================== */}
      <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-black flex items-center justify-center">
              1
            </span>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              TAP 1: What is the current situation?
            </span>
          </div>
          {currentStageConfig?.skipT1 && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
              <Zap className="w-3 h-3" />
              <span>Auto-declared</span>
            </span>
          )}
        </div>

        {currentStageConfig?.skipT1 ? (
          <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center gap-2 text-xs text-slate-300">
            <span className="text-base">{activeT1?.emoji || '⚡'}</span>
            <span className="font-bold text-slate-100">{activeT1?.label}</span>
            <span className="text-[10.5px] text-slate-400 italic">
              (Single logical subject for this stage — auto-selected)
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {currentStageConfig?.situations.map(sit => {
              const isSelected = selectedT1Id === sit.id;
              return (
                <button
                  key={sit.id}
                  type="button"
                  onClick={() => {
                    setSelectedT1Id(sit.id);
                    setSelectedT2Ids([]);
                    setSelectedT3Id('');
                    setIsEditingManually(false);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500 text-white ring-1 ring-cyan-500/50 shadow-md shadow-cyan-950/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base shrink-0 pt-0.5">{sit.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-snug">{sit.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">Token: "{sit.subjectToken}"</div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          TAP 2: WHAT SPECIFIC DETAIL / CONDITION / ACTION? (MULTI-SELECT)
         ===================================================================== */}
      {activeT1 && (
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black flex items-center justify-center">
                2
              </span>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                TAP 2: What specific detail / condition / action?
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
              Multi-Select Allowed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {activeT1.t2Options.map(t2 => {
              const isSelected = selectedT2Ids.includes(t2.id);
              return (
                <button
                  key={t2.id}
                  type="button"
                  onClick={() => handleToggleT2(t2.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 text-white ring-1 ring-amber-500/50 shadow-md shadow-amber-950/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base shrink-0 pt-0.5">{t2.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-snug">{t2.label}</div>
                    <div className="text-[10px] text-slate-400 italic line-clamp-1">"{t2.token}"</div>
                  </div>
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-slate-700 bg-slate-900'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAP 3: WHAT IS THE FUNCTIONAL CONTEXT / OUTCOME? (OPTIONAL)
         ===================================================================== */}
      {activeT1 && (
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-3 sm:p-3.5 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black flex items-center justify-center">
                3
              </span>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                TAP 3: Functional Context / Outcome (Optional)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono italic">
              Function & Outcome — Not Implementor
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {/* Skip Chip */}
            <button
              type="button"
              onClick={() => handleSelectT3('skip')}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 ${
                selectedT3Id === '' || selectedT3Id === 'skip'
                  ? 'bg-slate-800 border-slate-600 text-white font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="text-sm">⏭️</span>
              <span className="text-xs">Skip (No context)</span>
            </button>

            {activeT1.t3Options.map(t3 => {
              const isSelected = selectedT3Id === t3.id;
              return (
                <button
                  key={t3.id}
                  type="button"
                  onClick={() => handleSelectT3(t3.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500/50 shadow-md shadow-emerald-950/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base shrink-0 pt-0.5">{t3.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-snug">{t3.label}</div>
                    <div className="text-[10px] text-slate-400 italic line-clamp-1">"{t3.token}"</div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          ASSEMBLED CAPTION PREVIEW & ACTIONS
         ===================================================================== */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-4 h-4 ${assembledResult.isComplete ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Assembled Photo Caption
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingManually(!isEditingManually)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingManually ? 'Lock Assembled' : 'Edit Manually'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Assembled Caption Box */}
        {isEditingManually ? (
          <textarea
            rows={2}
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="Edit assembled photo caption..."
            className="w-full bg-slate-900 border border-cyan-500/60 rounded-xl p-2.5 text-xs text-white focus:outline-none font-medium leading-relaxed"
          />
        ) : (
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
            {finalCaption ? (
              <p className="text-xs text-slate-100 font-medium leading-relaxed select-all">
                {finalCaption}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Select a situation and at least one detail chip above to assemble the caption...
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={!finalCaption}
            onClick={handleApply}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Apply Caption to Photo</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (inlineMode) {
    return content;
  }

  // Modal View
  return (
    <div 
      className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div 
        className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {content}
        </div>
      </div>
    </div>
  );
};
