import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Filter, 
  MapPin, 
  Building2, 
  Compass, 
  RotateCcw, 
  Check, 
  Layers,
  Wrench,
  Activity
} from 'lucide-react';
import { LocationFilter, GISLayer, FieldReport } from '../types';

interface LocationFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: LocationFilter;
  onApplyFilter: (filter: LocationFilter) => void;
  onResetFilter: () => void;
  layers: GISLayer[];
  fieldReports?: FieldReport[];
}

// Standard Activity Categories Roster (12 Official Categories + Filters)
const MAINTENANCE_ACTIVITY_CATEGORIES = [
  'All Activities',
  'Desilting / Clearing of Canal (Mechanical)',
  'Desilting / Clearing of Canal (Manual)',
  'Brush Dam / Dredging at Water Source',
  'Gate Lubrication',
  'Temporary Fix',
  'Canal Repair / Construction',
  'Service Road Maintenance',
  'Painting / Repainting',
  'Staff Gauge Installation / Maintenance',
  'Herbicide / Vegetation Control (Chemical)',
  'Farm Ditch / Lateral Restoration',
  'Other Repair / Maintenance',
  'Operational Status Observation'
];

// Helper to safely extract canonical properties from GeoJSON feature properties
function getCanonicalProp(p: any, key: 'IMO' | 'Province' | 'NIS'): string {
  if (!p) return '';
  if (key === 'IMO') {
    return String(p.IMO || p.imo || p.Imo || p.IMO_NAME || p.imo_name || '').trim();
  }
  if (key === 'Province') {
    return String(p.Province || p.province || p.PROVINCE || '').trim();
  }
  if (key === 'NIS') {
    return String(p.NIS || p.nis || p.Nis || p.NIS_NAME || p.nis_name || '').trim();
  }
  return '';
}

export const LocationFilterModal: React.FC<LocationFilterModalProps> = ({
  isOpen,
  onClose,
  activeFilter,
  onApplyFilter,
  onResetFilter,
  layers,
  fieldReports = []
}) => {
  const [filterState, setFilterState] = useState<LocationFilter>({
    imo: activeFilter.imo || 'All IMOs',
    nis: activeFilter.nis || 'All NIS',
    province: activeFilter.province || 'All Provinces',
    activityCategory: activeFilter.activityCategory || 'All Activities'
  });

  useEffect(() => {
    setFilterState({
      imo: activeFilter.imo || 'All IMOs',
      nis: activeFilter.nis || 'All NIS',
      province: activeFilter.province || 'All Provinces',
      activityCategory: activeFilter.activityCategory || 'All Activities'
    });
  }, [activeFilter, isOpen]);

  // Extract all feature entries from active GIS layers
  const featureList = useMemo(() => {
    const items: {
      feature: any;
      layerCategory: string;
      isCanal: boolean;
      imo: string;
      province: string;
      nis: string;
    }[] = [];

    layers.forEach((layer) => {
      if (!layer.data || !layer.data.features) return;
      const isCanal = layer.category === 'Canals' || layer.category === 'Canal Networks' || layer.geometryType === 'LineString' || layer.name.toLowerCase().includes('canal');

      layer.data.features.forEach((feat: any) => {
        const p = feat.properties || {};
        items.push({
          feature: feat,
          layerCategory: layer.category,
          isCanal,
          imo: getCanonicalProp(p, 'IMO'),
          province: getCanonicalProp(p, 'Province'),
          nis: getCanonicalProp(p, 'NIS')
        });
      });
    });

    return items;
  }, [layers]);

  // 1. Dynamic IMO Options (Top Partition derived strictly from loaded GIS datasets)
  const imoOptions = useMemo(() => {
    const extracted = new Set<string>();
    featureList.forEach(item => {
      if (item.imo) extracted.add(item.imo);
    });

    const sorted = Array.from(extracted).sort();
    return ['All IMOs', ...sorted];
  }, [featureList]);

  // 2. Dynamic Province Options (Filtered by selected IMO)
  const provinceOptions = useMemo(() => {
    const extracted = new Set<string>();
    featureList.forEach(item => {
      if (
        filterState.imo &&
        filterState.imo !== 'All IMOs' &&
        item.imo &&
        !item.imo.toLowerCase().includes(filterState.imo.toLowerCase()) &&
        !filterState.imo.toLowerCase().includes(item.imo.toLowerCase())
      ) {
        return;
      }
      if (item.province) extracted.add(item.province);
    });

    const sorted = Array.from(extracted).sort();
    return ['All Provinces', ...sorted];
  }, [featureList, filterState.imo]);

  // 3. Dynamic NIS Options (Independent facet cross-cutting admin hierarchy, filtered by IMO & Province)
  const nisOptions = useMemo(() => {
    const extracted = new Set<string>();
    featureList.forEach(item => {
      if (
        filterState.imo &&
        filterState.imo !== 'All IMOs' &&
        item.imo &&
        !item.imo.toLowerCase().includes(filterState.imo.toLowerCase()) &&
        !filterState.imo.toLowerCase().includes(item.imo.toLowerCase())
      ) {
        return;
      }

      if (
        filterState.province &&
        filterState.province !== 'All Provinces' &&
        item.province &&
        !item.province.toLowerCase().includes(filterState.province.toLowerCase()) &&
        !filterState.province.toLowerCase().includes(item.province.toLowerCase())
      ) {
        return;
      }

      if (item.nis) extracted.add(item.nis);
    });

    const sorted = Array.from(extracted).sort();
    return ['All NIS', ...sorted];
  }, [featureList, filterState.imo, filterState.province]);

  // 4. Dynamic Activity Category Options (combines standard list with live field reports)
  const activityCategoryOptions = useMemo(() => {
    const actSet = new Set<string>(MAINTENANCE_ACTIVITY_CATEGORIES);
    fieldReports.forEach(r => {
      if (r.maintenanceActivity && r.maintenanceActivity.trim()) {
        actSet.add(r.maintenanceActivity.trim());
      }
    });
    return Array.from(actSet);
  }, [fieldReports]);

  // Dynamic Matching GIS Features Count
  const matchingFeatureCount = useMemo(() => {
    let count = 0;
    featureList.forEach((item) => {
      if (filterState.imo && filterState.imo !== 'All IMOs') {
        if (item.imo && !item.imo.toLowerCase().includes(filterState.imo.toLowerCase()) && !filterState.imo.toLowerCase().includes(item.imo.toLowerCase())) {
          return;
        }
      }

      if (filterState.province && filterState.province !== 'All Provinces') {
        if (item.province && !item.province.toLowerCase().includes(filterState.province.toLowerCase()) && !filterState.province.toLowerCase().includes(item.province.toLowerCase())) {
          return;
        }
      }

      if (filterState.nis && filterState.nis !== 'All NIS') {
        if (item.nis && !item.nis.toLowerCase().includes(filterState.nis.toLowerCase()) && !filterState.nis.toLowerCase().includes(item.nis.toLowerCase())) {
          return;
        }
      }

      count++;
    });
    return count;
  }, [featureList, filterState]);

  // Dynamic Matching Field Reports Count
  const matchingReportCount = useMemo(() => {
    let count = 0;
    fieldReports.forEach(r => {
      if (!r) return;

      if (filterState.imo && filterState.imo !== 'All IMOs') {
        const repImo = (r.imoOffice || '').toLowerCase();
        const targetImo = filterState.imo.toLowerCase();
        if (repImo && !repImo.includes(targetImo) && !targetImo.includes(repImo)) {
          return;
        }
      }

      if (filterState.nis && filterState.nis !== 'All NIS') {
        const repNis = (r.nisBinding || '').toLowerCase();
        const targetNis = filterState.nis.toLowerCase();
        if (repNis && !repNis.includes(targetNis) && !targetNis.includes(repNis)) {
          return;
        }
      }

      if (filterState.activityCategory && filterState.activityCategory !== 'All Activities') {
        const act = (r.maintenanceActivity || r.operationalState || r.categoryMode || '').toLowerCase();
        const targetAct = filterState.activityCategory.toLowerCase();
        if (!act.includes(targetAct) && !targetAct.includes(act)) {
          return;
        }
      }

      count++;
    });
    return count;
  }, [fieldReports, filterState]);

  if (!isOpen) return null;

  const handleIMOChange = (val: string) => {
    setFilterState(prev => ({
      ...prev,
      imo: val,
      province: 'All Provinces',
      nis: 'All NIS'
    }));
  };

  const handleProvinceChange = (val: string) => {
    setFilterState(prev => ({
      ...prev,
      province: val,
      nis: 'All NIS'
    }));
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyFilter(filterState);
    onClose();
  };

  const handleReset = () => {
    const emptyFilter: LocationFilter = {
      imo: 'All IMOs',
      nis: 'All NIS',
      province: 'All Provinces',
      activityCategory: 'All Activities'
    };
    setFilterState(emptyFilter);
    onResetFilter();
  };

  return (
    <aside className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-20 md:left-4 md:right-auto z-50 md:z-40 w-full md:w-[440px] max-h-[85vh] md:max-h-[580px] bg-slate-900/98 md:bg-slate-900/98 backdrop-blur-xl border-t md:border border-slate-700/80 rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 md:slide-in-from-left-4">
      {/* Mobile Drag Handle */}
      <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto my-1.5 md:hidden shrink-0" />

      {/* Header (Budgeted Space) */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/80 shrink-0 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#166534]/15 text-[#166534] dark:text-emerald-300 border border-[#166534]/30">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 font-heading flex items-center gap-1.5 leading-tight">
              <span>Location &amp; Activity Filter</span>
            </h2>
            <p className="text-[10px] text-slate-400">
              Filter IMO partitions, NIS systems &amp; maintenance activity category
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Form Body - Responsive Scrollable Area */}
      <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-3.5 space-y-3 flex flex-col">
        {/* 1. IMO Partition Selector */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#166534] dark:text-emerald-400">
              <Building2 className="w-3.5 h-3.5" />
              <span>1. IMO Office Partition</span>
            </span>
            {filterState.imo && filterState.imo !== 'All IMOs' && (
              <span className="text-[9px] bg-[#166534]/15 border border-[#166534]/30 text-[#166534] dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">Active IMO</span>
            )}
          </label>
          <select
            value={filterState.imo || 'All IMOs'}
            onChange={(e) => handleIMOChange(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534] transition cursor-pointer"
          >
            {imoOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Province Selector */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#166534] dark:text-emerald-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>2. Province (Jurisdiction)</span>
            </span>
            {filterState.province && filterState.province !== 'All Provinces' && (
              <span className="text-[9px] bg-[#166534]/15 border border-[#166534]/30 text-[#166534] dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">Active Province</span>
            )}
          </label>
          <select
            value={filterState.province || 'All Provinces'}
            onChange={(e) => handleProvinceChange(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534] transition cursor-pointer"
          >
            {provinceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 3. NIS System Facet (Cross-cutting) */}
        <div className="space-y-1.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/80">
          <label className="block text-xs font-bold text-[#166534] dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>3. National Irrigation System (NIS)</span>
            </span>
            {filterState.nis && filterState.nis !== 'All NIS' && (
              <span className="text-[9px] bg-[#166534]/15 border border-[#166534]/30 text-[#166534] dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">Active NIS</span>
            )}
          </label>
          <select
            value={filterState.nis || 'All NIS'}
            onChange={(e) => setFilterState({ ...filterState, nis: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#166534] transition cursor-pointer"
          >
            {nisOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="text-[9.5px] text-slate-400 leading-tight">
            Applies to Canals, Irrigation Structures &amp; Activity Points
          </p>
        </div>

        {/* 4. Maintenance Activity Category Selector */}
        <div className="space-y-1.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/80">
          <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              <span>4. Maintenance Activity Category</span>
            </span>
            {filterState.activityCategory && filterState.activityCategory !== 'All Activities' && (
              <span className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded font-semibold">Active Category</span>
            )}
          </label>
          <select
            value={filterState.activityCategory || 'All Activities'}
            onChange={(e) => setFilterState({ ...filterState, activityCategory: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition cursor-pointer"
          >
            {activityCategoryOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="text-[9.5px] text-slate-400 leading-tight">
            Filters field activities on the map and weekly reporting summary
          </p>
        </div>

        {/* Matching Count Indicators */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-xl flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[10px]">
              <Layers className="w-3 h-3 text-[#166534] dark:text-emerald-400" />
              <span>GIS Features:</span>
            </div>
            <div className="font-mono font-bold text-xs text-[#166534] dark:text-emerald-400">
              {matchingFeatureCount} / {featureList.length}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-xl flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[10px]">
              <Activity className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Field Activities:</span>
            </div>
            <div className="font-mono font-bold text-xs text-amber-700 dark:text-amber-300">
              {matchingReportCount} / {fieldReports.length}
            </div>
          </div>
        </div>
      </form>

      {/* Footer Actions (Sticky Bottom) */}
      <div className="p-3 border-t border-slate-700/80 shrink-0 bg-slate-800/80 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 bg-[#166534] hover:bg-[#15803d] text-white font-bold rounded-xl text-xs shadow-sm border border-[#15803d]/50 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Filter</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
