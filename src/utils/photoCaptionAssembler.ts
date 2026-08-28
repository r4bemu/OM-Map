/**
 * NIA MIMAROPA – Smart Photo Caption Composition Engine
 * Composes natural, professional, grammatically coherent civil & irrigation engineering photo captions.
 * Strictly deterministic and grounded in user inputs:
 *  - Activity Category
 *  - Inspection Stage (BEFORE / DURING / AFTER)
 *  - Selected T1 Situation (Subject)
 *  - Selected T2 Details / Actions
 *  - Selected T3 Functional Context / Outcome
 */

import { 
  CaptionStage, 
  CaptionActivityCode, 
  PHOTO_CAPTION_CATEGORIES, 
  findCaptionCategory,
  Tap1Situation,
  Tap2Detail,
  Tap3Context,
  ActivityCaptionCategory
} from '../data/photoCaptionTree';

export interface AssembleCaptionOptions {
  activityOrCode?: string;
  stage: CaptionStage | 'Before' | 'During' | 'After';
  t1Id?: string;
  t2Ids: string[];
  t3Id?: string; // If undefined or 'skip'/'skipped', T3 is omitted
  locationName?: string;
  canalSegment?: string;
  includeLocation?: boolean;
}

export interface AssembledCaptionResult {
  caption: string;
  t1?: Tap1Situation;
  selectedT2: Tap2Detail[];
  t3?: Tap3Context;
  isComplete: boolean;
}

/**
 * Normalizes stage string to 'BEFORE' | 'DURING' | 'AFTER'
 */
export function normalizeCaptionStage(stage?: string): CaptionStage {
  if (!stage) return 'DURING';
  const s = stage.toUpperCase().trim();
  if (s.startsWith('BEF')) return 'BEFORE';
  if (s.startsWith('AFT')) return 'AFTER';
  return 'DURING';
}

/**
 * Cleans technical subjects with slashes into clean nouns
 */
function cleanSubject(subject: string): string {
  let s = subject.trim();
  if (s.includes('Steel gate rods / mechanism')) return 'Steel gate mechanism';
  if (s.includes('Headgate / intake structure')) return 'Headgate structure';
  if (s.includes('River / creek bed')) return 'River bed';
  if (s.includes('Service road / access berm')) return 'Service road';
  if (s.includes('Staff gauge / marker')) return 'Staff gauge';
  if (s.includes('Gabion / retaining wall')) return 'Retaining wall';
  if (s.includes(' / ')) {
    s = s.split(' / ')[0].trim();
  }
  return s;
}

/**
 * Strips redundant prepositions while preserving core semantic meaning
 */
function cleanDetailToken(token: string): string {
  let t = token.trim();
  t = t.replace(/^(with\s+|using\s+|and\s+)/i, '').trim();
  if (t.toLowerCase() === 'rusty and corroded') {
    return 'surface rust and corrosion';
  }
  if (t.toLowerCase() === 'with stiff and jammed spindle' || t.toLowerCase() === 'stiff and jammed spindle') {
    return 'stiff, jammed spindle rod';
  }
  return t;
}

/**
 * Combines a list of string items grammatically (Oxford comma)
 */
function combineItemsGrammatically(items: string[]): string {
  const clean = items.map(s => s.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

/**
 * Composes a smart, concise, grammatically refined caption
 */
export function assemblePhotoCaption(options: AssembleCaptionOptions): AssembledCaptionResult {
  const stage = normalizeCaptionStage(options.stage);
  const category = findCaptionCategory(options.activityOrCode);
  const stageConfig = category.stages[stage];

  if (!stageConfig || !stageConfig.situations || stageConfig.situations.length === 0) {
    return { caption: '', selectedT2: [], isComplete: false };
  }

  // Determine T1 Situation
  let t1: Tap1Situation | undefined;
  if (stageConfig.skipT1) {
    t1 = stageConfig.situations[0];
  } else if (options.t1Id) {
    t1 = stageConfig.situations.find(s => s.id === options.t1Id);
  }

  // Fallback to first if autoDeclared
  if (!t1 && stageConfig.situations[0]?.autoDeclared) {
    t1 = stageConfig.situations[0];
  }

  if (!t1) {
    return { caption: '', selectedT2: [], isComplete: false };
  }

  // Resolve selected T2 details
  const selectedT2: Tap2Detail[] = [];
  if (Array.isArray(options.t2Ids)) {
    options.t2Ids.forEach(id => {
      const found = t1?.t2Options.find(opt => opt.id === id);
      if (found) selectedT2.push(found);
    });
  }

  // Resolve optional T3 context (skip if not provided or 'skip')
  let t3: Tap3Context | undefined;
  if (options.t3Id && options.t3Id !== 'skip' && options.t3Id !== 'skipped') {
    t3 = t1.t3Options.find(opt => opt.id === options.t3Id);
  }

  if (selectedT2.length === 0 && !t3) {
    // Only T1 selected so far (Step 1)
    return {
      caption: t1.label,
      t1,
      selectedT2: [],
      t3: undefined,
      isComplete: false
    };
  }

  const rawSubject = t1.subjectToken.trim();
  const subject = cleanSubject(rawSubject);
  const rawT2Tokens = selectedT2.map(t => t.token.trim());
  const t3Token = t3 ? t3.token.trim() : '';

  let composedSentence = '';

  // -------------------------------------------------------------------------
  // STAGE-SPECIFIC SMART NATURAL LANGUAGE GENERATION (NLG)
  // -------------------------------------------------------------------------
  if (stage === 'BEFORE') {
    const cleanedDetails = rawT2Tokens.map(cleanDetailToken);
    const combinedDetails = combineItemsGrammatically(cleanedDetails);

    const isDirectAdjectiveOrParticiple = /^(partially|completely|severely|heavily|critically|clogged|blocked|stuck|eroded|damaged|washed out|collapsed|cracked|weathered|overflowing)/i.test(combinedDetails);

    const isDefectOrObstruction = /^(vegetation|soil|silt|fine sand|gravel|garbage|intentional|large obstacle|surface rust|stiff|cracks|settlement|rusted|unlubricated|faded|misaligned|bent|leaking|scoured|dense|dense weed|overgrown|weeds)/i.test(combinedDetails);

    if (combinedDetails) {
      if (isDirectAdjectiveOrParticiple) {
        composedSentence = `${subject} ${combinedDetails}`;
      } else if (isDefectOrObstruction) {
        composedSentence = `${subject} showing ${combinedDetails}`;
      } else {
        composedSentence = `${subject} with ${combinedDetails}`;
      }
    } else {
      composedSentence = `Pre-maintenance condition of ${subject.toLowerCase()}`;
    }

    // Connect T3 outcome (e.g. causing critically reduced flow, resulting in seepage)
    if (t3Token) {
      const cleanT3 = t3Token.replace(/^(causing\s+|resulting\s+in\s+)/i, '');
      if (/^(before\s+|prior\s+to\s+)/i.test(cleanT3)) {
        composedSentence = `${composedSentence}, prior to maintenance servicing`;
      } else if (/^(critically\s+reduced|severe\s+reduction|no\s+water\s+flow|reduced\s+water\s+flow|inability|threatening|water\s+seepage)/i.test(cleanT3)) {
        composedSentence = `${composedSentence}, causing ${cleanT3}`;
      } else if (/^(due\s+to|acceptable|with\s+|under\s+|to\s+|for\s+)/i.test(t3Token)) {
        composedSentence = `${composedSentence}, ${t3Token}`;
      } else {
        composedSentence = `${composedSentence}, resulting in ${cleanT3}`;
      }
    }

  } else if (stage === 'DURING') {
    // Check if subject is an actor (Excavator, Workers, NIA Personnel, Operator) or a facility component
    const isActorSubject = /^(Excavator|Workers|Worker|Personnel|NIA Personnel|IA members|Operator|Backhoe|Team)/i.test(subject);
    
    // Check if T2 contains passive actions on materials (loaded, piled, spread, bagged, poured)
    const isMaterialPassive = /^(Silt|Spoil|Excavated|Material|Earth|Soil|Concrete|Debris)/i.test(subject) || rawT2Tokens.some(t => /^(loaded|piled|spread|bagged|poured|stacked|placed)/i.test(t.replace(/^with\s+/i, '')));

    // Check if T2 contains active participles
    const isParticipleAction = rawT2Tokens.some(t => /^(scooping|cutting|removing|clearing|applying|spraying|repairing|reconnecting|adjusting|installing|stacking|placing|building|pouring|measuring|instructing|coordinating|guiding|holding|securing|mounting|welding|grading|leveling|compacting|brushing|hauling|bagging|oiling|greasing)/i.test(t.replace(/^with\s+/i, '')));

    if (isActorSubject) {
      const actions = rawT2Tokens.map(t => t.replace(/^(with\s+|and\s+)/i, '').trim());
      const combinedActions = combineItemsGrammatically(actions);
      
      if (combinedActions) {
        composedSentence = `${subject} ${combinedActions}`;
      } else {
        composedSentence = `${subject} conducting operations`;
      }
    } else if (isMaterialPassive) {
      const actions = rawT2Tokens.map(t => {
        let act = t.replace(/^(with\s+|during\s+maintenance\s+with\s+)/i, '').trim();
        if (/^(loaded|piled|spread|bagged|poured|compacted|hauled)/i.test(act)) {
          return `being ${act}`;
        }
        return act;
      });
      const combinedActions = combineItemsGrammatically(actions);
      composedSentence = `${subject} ${combinedActions}`;
    } else {
      // Subject is canal, gate, lining, structure
      const cleanedDetails = rawT2Tokens.map(cleanDetailToken);
      const combinedDetails = combineItemsGrammatically(cleanedDetails);

      if (isParticipleAction) {
        composedSentence = `${category.name} in progress on ${subject.toLowerCase()}, ${combinedDetails}`;
      } else if (combinedDetails) {
        composedSentence = `${subject} maintenance underway with ${combinedDetails}`;
      } else {
        composedSentence = `${category.name} in progress on ${subject.toLowerCase()}`;
      }
    }

    // Connect T3 context (methodology, equipment ownership, agreement)
    if (t3Token) {
      if (/^(using\s+|with\s+|under\s+|for\s+|at\s+|by\s+|to\s+|along\s+|across\s+|near\s+|in\s+|on\s+)/i.test(t3Token)) {
        composedSentence = `${composedSentence}, ${t3Token}`;
      } else {
        composedSentence = `${composedSentence}, utilizing ${t3Token}`;
      }
    }

  } else if (stage === 'AFTER') {
    // Completed state: restored canal profile, freshly painted gate, cleared banks
    const cleanedDetails = rawT2Tokens.map(cleanDetailToken);
    const combinedDetails = combineItemsGrammatically(cleanedDetails);

    const isDirectParticiple = /^(cleared\s+of|clean\s+|restored\s+|painted\s+|repaired\s+|functional\s+|operational\s+|compacted\s+|leveled\s+|mounted\s+|installed\s+)/i.test(combinedDetails);

    if (combinedDetails) {
      if (isDirectParticiple) {
        composedSentence = `Completed ${subject.toLowerCase()} ${combinedDetails}`;
      } else if (/^(with\s+)/i.test(combinedDetails)) {
        composedSentence = `Completed ${subject.toLowerCase()} ${combinedDetails}`;
      } else {
        composedSentence = `Completed ${subject.toLowerCase()} with ${combinedDetails}`;
      }
    } else {
      composedSentence = `Completed ${subject.toLowerCase()} after maintenance`;
    }

    // Connect T3 outcome (restoring design capacity, maintaining good water flow)
    if (t3Token) {
      if (/^(restoring\s+|maintaining\s+|sustaining\s+|ensuring\s+|at\s+|for\s+|with\s+|to\s+)/i.test(t3Token)) {
        composedSentence = `${composedSentence}, ${t3Token}`;
      } else if (/^(gate\s+fully\s+operational)/i.test(t3Token)) {
        composedSentence = `${composedSentence}, restoring full gate operation and water flow control`;
      } else if (/^(water\s+level\s+monitoring\s+now\s+active)/i.test(t3Token)) {
        composedSentence = `${composedSentence}, with water level monitoring now active at this station`;
      } else if (/^(gauge\s+now\s+functional)/i.test(t3Token)) {
        composedSentence = `${composedSentence}, with gauge now fully functional for water level monitoring`;
      } else {
        composedSentence = `${composedSentence}, restoring ${t3Token.replace(/^(restored\s+|restoring\s+)/i, '')}`;
      }
    }
  }

  // -------------------------------------------------------------------------
  // CLEANUP & REFINEMENT POST-PROCESSING
  // -------------------------------------------------------------------------
  let finalized = composedSentence
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\bwith\s+with\b/gi, 'with')
    .replace(/\bthe\s+the\b/gi, 'the')
    .replace(/\bat\s+at\b/gi, 'at')
    .replace(/\bfor\s+for\b/gi, 'for')
    .replace(/\bbeing\s+being\b/gi, 'being')
    .replace(/\butilizing\s+to\b/gi, 'to')
    .trim();

  // Ensure first letter is capitalized and sentence ends with period
  if (finalized.length > 0) {
    finalized = finalized.charAt(0).toUpperCase() + finalized.slice(1);
    if (!finalized.endsWith('.')) {
      finalized = `${finalized}.`;
    }
  }

  // Optional Location Suffix
  if (options.includeLocation && (options.canalSegment || options.locationName)) {
    const loc = options.canalSegment || options.locationName;
    if (loc && !finalized.toLowerCase().includes(loc.toLowerCase())) {
      finalized = finalized.replace(/\.$/, '') + ` along ${loc}.`;
    }
  }

  const isComplete = Boolean(t1 && selectedT2.length > 0);

  return {
    caption: finalized,
    t1,
    selectedT2,
    t3,
    isComplete
  };
}
