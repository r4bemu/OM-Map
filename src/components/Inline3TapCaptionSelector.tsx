import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Zap, 
  CheckCircle2 
} from 'lucide-react';
import { 
  CaptionStage, 
  findCaptionCategory, 
  ActivityCaptionCategory, 
  Tap1Situation 
} from '../data/photoCaptionTree';
import { 
  assemblePhotoCaption, 
  normalizeCaptionStage 
} from '../utils/photoCaptionAssembler';

export interface Inline3TapCaptionSelectorProps {
  activity?: string;
  stage?: 'Before' | 'During' | 'After' | CaptionStage;
  currentCaption?: string;
  locationName?: string;
  canalSegment?: string;
  disabled?: boolean;
  onApplyCaption: (caption: string) => void;
}

export const Inline3TapCaptionSelector: React.FC<Inline3TapCaptionSelectorProps> = ({
  activity,
  stage = 'During',
  currentCaption = '',
  locationName,
  canalSegment,
  disabled = false,
  onApplyCaption
}) => {
  const normStage = normalizeCaptionStage(stage);

  // Resolved Category and Stage Configuration
  const category: ActivityCaptionCategory = useMemo(() => {
    return findCaptionCategory(activity);
  }, [activity]);

  const stageConfig = useMemo(() => {
    return category.stages[normStage];
  }, [category, normStage]);

  // Step state: 1 (Situation) | 2 (Detail/Action) | 3 (Outcome/Context)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedT1Id, setSelectedT1Id] = useState<string>('');
  const [selectedT2Ids, setSelectedT2Ids] = useState<string[]>([]);
  const [selectedT3Id, setSelectedT3Id] = useState<string>('');

  // Handle stage or category change (or auto-declared situations)
  useEffect(() => {
    if (stageConfig?.skipT1 && stageConfig.situations.length > 0) {
      setSelectedT1Id(stageConfig.situations[0].id);
      setCurrentStep(2); // Skip directly to Step 2
    } else if (stageConfig?.situations.length === 1 && stageConfig.situations[0].autoDeclared) {
      setSelectedT1Id(stageConfig.situations[0].id);
      setCurrentStep(2); // Skip directly to Step 2
    } else {
      setSelectedT1Id('');
      setCurrentStep(1);
    }
    setSelectedT2Ids([]);
    setSelectedT3Id('');
  }, [stageConfig, normStage, category.code]);

  // Active Situation object
  const activeT1: Tap1Situation | undefined = useMemo(() => {
    if (!stageConfig) return undefined;
    if (stageConfig.skipT1) return stageConfig.situations[0];
    return stageConfig.situations.find(s => s.id === selectedT1Id) || (selectedT1Id ? undefined : undefined);
  }, [stageConfig, selectedT1Id]);

  // Helper to reassemble and broadcast caption
  const updateAndBroadcast = (t1Id: string, t2Ids: string[], t3Id: string) => {
    const res = assemblePhotoCaption({
      activityOrCode: category.code,
      stage: normStage,
      t1Id,
      t2Ids,
      t3Id,
      locationName,
      canalSegment
    });
    if (res.caption) {
      onApplyCaption(res.caption);
    }
  };

  // Step 1: Select Situation
  const handleSelectT1 = (sitId: string) => {
    setSelectedT1Id(sitId);
    setSelectedT2Ids([]);
    setSelectedT3Id('');
    setCurrentStep(2);
    updateAndBroadcast(sitId, [], '');
  };

  // Step 2: Toggle Detail Chip
  const handleToggleT2 = (t2Id: string) => {
    let nextT2: string[];
    if (selectedT2Ids.includes(t2Id)) {
      nextT2 = selectedT2Ids.filter(id => id !== t2Id);
    } else {
      nextT2 = [...selectedT2Ids, t2Id];
    }
    setSelectedT2Ids(nextT2);
    updateAndBroadcast(selectedT1Id, nextT2, selectedT3Id);
  };

  // Step 3: Select Outcome Chip
  const handleSelectT3 = (t3Id: string) => {
    setSelectedT3Id(t3Id);
    updateAndBroadcast(selectedT1Id, selectedT2Ids, t3Id);
  };

  // Reset back to Step 1
  const handleReset = () => {
    if (stageConfig?.skipT1 && stageConfig.situations.length > 0) {
      setSelectedT1Id(stageConfig.situations[0].id);
      setCurrentStep(2);
    } else {
      setSelectedT1Id('');
      setCurrentStep(1);
    }
    setSelectedT2Ids([]);
    setSelectedT3Id('');
  };

  if (!stageConfig || !stageConfig.situations || stageConfig.situations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-1">
      {/* Consolidated Step Navigation Header */}
      <div className="flex items-center justify-between text-[10.5px] border-b border-slate-800/80 pb-1.5 gap-2">
        <div className="flex items-center gap-1.5 font-bold">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
            currentStep === 1
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : currentStep === 2
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}>
            {currentStep === 1 ? 'Step 1 of 3' : currentStep === 2 ? 'Step 2 of 3' : 'Step 3 of 3'}
          </span>

          <span className="text-slate-300 text-xs">
            {currentStep === 1 && 'Select Situation / Subject'}
            {currentStep === 2 && 'Select Specific Details (Multi-select)'}
            {currentStep === 3 && 'Select Functional Outcome / Context'}
          </span>
        </div>
      </div>

      {/* =====================================================================
          STEP 1: TAP 1 SITUATION / SUBJECT
         ===================================================================== */}
      {currentStep === 1 && (
        <div className="space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">
            {stageConfig.situations.map((sit) => {
              const isSelected = selectedT1Id === sit.id;
              return (
                <button
                  key={sit.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectT1(sit.id)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 text-left ${
                    isSelected
                      ? 'bg-cyan-950/70 border-cyan-500 text-white font-bold shadow-cyan-950/50'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800 hover:border-cyan-500/40'
                  }`}
                >
                  <span className="text-xs">{sit.emoji}</span>
                  <span className="font-medium">{sit.label}</span>
                </button>
              );
            })}
          </div>

          {(selectedT1Id || selectedT2Ids.length > 0 || selectedT3Id) && (
            <div className="flex items-center justify-between pt-1 px-0.5 border-t border-slate-800/60">
              <button
                type="button"
                disabled={disabled}
                onClick={handleReset}
                className="px-2 py-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
                title="Reset selection"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STEP 2: TAP 2 DETAILS / CONDITIONS / ACTIONS (MULTI-SELECT)
         ===================================================================== */}
      {currentStep === 2 && activeT1 && (
        <div className="space-y-2 animate-in fade-in duration-150">
          {/* Situation Context Breadcrumb */}
          <div className="text-[10.5px] text-slate-400 px-0.5 flex items-center gap-1.5">
            <span className="text-xs">{activeT1.emoji}</span>
            <span className="font-semibold text-slate-200">{activeT1.label}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">
            {activeT1.t2Options.map((t2) => {
              const isSelected = selectedT2Ids.includes(t2.id);
              return (
                <button
                  key={t2.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleToggleT2(t2.id)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 text-left ${
                    isSelected
                      ? 'bg-amber-950/70 border-amber-500 text-amber-200 font-bold shadow-amber-950/50'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800 hover:border-amber-500/40'
                  }`}
                >
                  <span className="text-xs">{t2.emoji}</span>
                  <span className="font-medium">{t2.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-amber-400 stroke-[3]" />}
                </button>
              );
            })}
          </div>

          {/* Bottom Action Bar with Relocated Back/Reset and "More caption" Button */}
          <div className="flex items-center justify-between pt-1 px-0.5 border-t border-slate-800/60">
            <div className="flex items-center gap-2">
              {!stageConfig.skipT1 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setCurrentStep(1)}
                  className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition flex items-center gap-1 cursor-pointer text-xs"
                  title="Go back to previous step"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={handleReset}
                className="px-2.5 py-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800/60 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
                title="Reset selection"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => setCurrentStep(3)}
              className="text-xs px-3 py-1 bg-gradient-to-r from-amber-600/40 to-emerald-600/40 hover:from-amber-600/60 hover:to-emerald-600/60 text-emerald-200 hover:text-white border border-emerald-500/50 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>More caption</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: TAP 3 FUNCTIONAL CONTEXT / OUTCOME (OPTIONAL)
         ===================================================================== */}
      {currentStep === 3 && activeT1 && (
        <div className="space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">
            {/* Skip Chip */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleSelectT3('skip')}
              className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
                selectedT3Id === 'skip'
                  ? 'bg-slate-800 border-slate-600 text-white font-bold'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800'
              }`}
            >
              <span className="text-xs">⏭️</span>
              <span className="font-medium">Skip (No context)</span>
            </button>

            {activeT1.t3Options.map((t3) => {
              const isSelected = selectedT3Id === t3.id;
              return (
                <button
                  key={t3.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectT3(t3.id)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 text-left ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 font-bold shadow-emerald-950/50'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <span className="text-xs">{t3.emoji}</span>
                  <span className="font-medium">{t3.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
                </button>
              );
            })}
          </div>

          {/* Bottom Action Bar with Relocated Back/Reset Buttons */}
          <div className="flex items-center justify-between pt-1 px-0.5 border-t border-slate-800/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setCurrentStep(2)}
                className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition flex items-center gap-1 cursor-pointer text-xs"
                title="Go back to previous step"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={handleReset}
                className="px-2.5 py-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800/60 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
                title="Reset selection"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
