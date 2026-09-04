import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  Edit3,
  FileSpreadsheet,
  Building2,
  RotateCcw,
  FileDown,
  Loader2
} from 'lucide-react';
import { FieldReport, AuthUser, UserRole } from '../types';
import { downloadWmrPdf } from '../utils/reportPdfBuilder';
import { getAvailableWeeksFromReports, isReportInWeek, FridayWeekInfo } from '../utils/weekUtils';
import { getUserSignatories, saveUserSignatories } from '../utils/signatoriesConfig';

interface Form691WeeklyReportProps {
  reports: FieldReport[];
  initialWeekKey?: string;
  currentUser?: AuthUser | null;
  activeImo?: string;
  activeNis?: string;
  currentRole?: UserRole;
}

// MIMAROPA Region Official IMO & National Irrigation System (NIS) Taxonomy
interface NISDefinition {
  name: string;
  division?: string;
  totalCanalLengthKm?: number;
  totalStructuresCount?: number;
}

interface IMODefinition {
  name: string;
  shortName: string;
  systems: NISDefinition[];
}

const MIMAROPA_SYSTEMS: IMODefinition[] = [
  {
    name: 'MOMARO IMO',
    shortName: 'MOMARO',
    systems: [
      { name: 'BACO-BUCAYAO RIS' },
      { name: 'MAG-ASAWANG TUBIG RIS' },
      { name: 'CANTINGAS RIS' },
      { name: 'PULA RIS' },
      { name: 'BANSUD RIS' }
    ]
  },
  {
    name: 'OCCIDENTAL MINDORO IMO',
    shortName: 'Occidental Mindoro',
    systems: [
      { name: 'MONGPONG RIS' },
      { name: 'AMNAY RIS' },
      { name: 'CAGURAY RIS' },
      { name: 'LUMINTAO RIS' },
      { name: 'PAGBAHAN RIS' }
    ]
  },
  {
    name: 'PALAWAN IMO',
    shortName: 'Palawan',
    systems: [
      { name: 'BATANG-BATANG RIS' },
      { name: 'MALATGAO RIS', division: 'DIVISION 1' },
      { name: 'MALATGAO RIS', division: 'DIVISION 2' }
    ]
  }
];

// Helper: Parse stationing string (e.g. "Sta 0+760.00 to Sta 1+150.00" or coords)
function parseStationing(locationName?: string, report?: FieldReport): {
  fromStation: string;
  toStation: string;
  canalName: string;
  structureType: string;
  structureStation: string;
  structureUnits: string;
  condition: string;
} {
  const loc = locationName || report?.locationName || '';
  const act = report?.maintenanceActivity || '';

  let fromStation = '';
  let toStation = '';
  let canalName = report?.canalSegment || '';
  let structureType = '';
  let structureStation = '';
  let structureUnits = '';
  let condition = 'In good condition / Maintained';

  // Check if structure activity
  const isStructure = act.includes('Dam') || act.includes('Intake') || act.includes('Gate') || act.includes('Diversion') || act.includes('Staff gauge') || act.includes('dredging');

  if (isStructure) {
    if (act.includes('Dam') || act.includes('dredging')) structureType = 'Dam';
    else if (act.includes('Intake')) structureType = 'Intake';
    else if (act.includes('Gate') || act.includes('Lubrication')) structureType = 'Steel gates';
    else if (act.includes('Staff gauge')) structureType = 'Staff gauge';
    else if (act.includes('Diversion')) structureType = 'Diversion works';
    else structureType = 'Structure';

    structureStation = '0+000.00';
    structureUnits = '1';

    if (act.includes('dredging') || act.includes('Brass dam')) condition = 'Washed-out brush dam';
    else if (act.includes('Gate') || act.includes('Rusty')) condition = 'Rusty';
    else if (act.includes('Staff gauge')) condition = 'Installation of staff gauge';
    else condition = 'Silted';
  } else {
    // Canal line segment
    if (!canalName) {
      if (loc.includes('Lateral')) {
        const match = loc.match(/Lateral\s+[A-Z0-9-]+/i);
        canalName = match ? match[0] : 'Lateral Canal';
      } else if (loc.includes('Main Canal')) {
        canalName = 'Main Canal';
      } else {
        canalName = 'Main Canal';
      }
    }

    const actLower = act.toLowerCase();
    if (actLower.includes('desilting')) condition = 'Silted';
    else if (actLower.includes('brush dam') || actLower.includes('dredging') || actLower.includes('source')) condition = 'Silted intake basin';
    else if (actLower.includes('gate') || actLower.includes('lube') || actLower.includes('lubrication')) condition = 'Ungreased mechanism';
    else if (actLower.includes('temp') || actLower.includes('fix') || actLower.includes('emergency')) condition = 'Damaged embankment';
    else if (actLower.includes('repair') || actLower.includes('construction') || actLower.includes('lining')) condition = 'Dilapidated canal';
    else if (actLower.includes('road') || actLower.includes('service') || actLower.includes('surfacing')) condition = 'Uneven service road';
    else if (actLower.includes('paint') || actLower.includes('repainting')) condition = 'Corroded / faded paint';
    else if (actLower.includes('gauge') || actLower.includes('staff')) condition = 'Missing / faded gauge';
    else if (actLower.includes('herbicide') || actLower.includes('chemical') || actLower.includes('weed') || actLower.includes('vegetation') || actLower.includes('clearing')) condition = 'Heavy weed growth';
    else if (actLower.includes('farm ditch') || actLower.includes('lateral restoration')) condition = 'Silted farm ditch';
    else if (actLower.includes('other')) condition = 'Inspection required';
  }

  // Attempt to extract stationing regex "X+XXX"
  const stationMatches = loc.match(/(\d+\+\d+(\.\d+)?)/g);
  if (stationMatches && stationMatches.length >= 2) {
    fromStation = stationMatches[0];
    toStation = stationMatches[1];
  } else if (stationMatches && stationMatches.length === 1) {
    fromStation = stationMatches[0];
    if (structureType) structureStation = stationMatches[0];
  }

  return {
    fromStation,
    toStation,
    canalName,
    structureType,
    structureStation,
    structureUnits,
    condition
  };
}

export const Form691WeeklyReport: React.FC<Form691WeeklyReportProps> = ({
  reports,
  initialWeekKey,
  currentUser,
  activeImo,
  activeNis,
  currentRole
}) => {
  // Determine user's role and assigned scope
  const userAssignedImo = currentUser?.imoOffice || activeImo;
  const userAssignedNis = currentUser?.nisBinding || activeNis;
  const isRegionalRole = !userAssignedImo || userAssignedImo === 'All IMOs' || userAssignedImo === 'Regional Office IV-B' || ['Developer', 'RO Admin', 'RO Evaluator', 'RO Reviewer', 'RO Preparer'].includes(currentUser?.role || currentRole || '');

  const [selectedImo, setSelectedImo] = useState<string>(() => {
    if (isRegionalRole) return activeImo && activeImo !== 'All IMOs' ? activeImo : 'All IMOs';
    return userAssignedImo || 'MOMARO IMO';
  });

  const [selectedNis, setSelectedNis] = useState<string>(() => {
    if (userAssignedNis && userAssignedNis !== 'All' && userAssignedNis !== 'All NIS') return userAssignedNis;
    return 'All NIS';
  });

  // Keep state synchronized with current user role and scoping props
  useEffect(() => {
    if (isRegionalRole) {
      if (activeImo && activeImo !== 'All IMOs') {
        setSelectedImo(activeImo);
      }
      if (activeNis && activeNis !== 'All NIS' && activeNis !== 'All') {
        setSelectedNis(activeNis);
      }
    } else {
      if (userAssignedImo) {
        setSelectedImo(userAssignedImo);
      }
      if (userAssignedNis && userAssignedNis !== 'All' && userAssignedNis !== 'All NIS') {
        setSelectedNis(userAssignedNis);
      }
    }
  }, [currentUser, activeImo, activeNis, isRegionalRole, userAssignedImo, userAssignedNis]);

  // Available NIS list for the selected IMO
  const availableNisForSelectedImo = useMemo(() => {
    if (selectedImo === 'All IMOs' || selectedImo === 'All') {
      return MIMAROPA_SYSTEMS.flatMap(imo => imo.systems);
    }
    const isMOMARO = (str: string) => str.includes('MOMARO') || str.includes('ORIENTAL');
    const isOccidental = (str: string) => str.includes('OCCIDENTAL');
    const isPalawan = (str: string) => str.includes('PALAWAN');
    const sUpper = selectedImo.toUpperCase();

    const found = MIMAROPA_SYSTEMS.find(imo => {
      if (isMOMARO(sUpper) && isMOMARO(imo.name)) return true;
      if (isOccidental(sUpper) && isOccidental(imo.name)) return true;
      if (isPalawan(sUpper) && isPalawan(imo.name)) return true;
      return imo.name.toUpperCase().includes(sUpper) || imo.shortName.toUpperCase().includes(sUpper);
    });
    return found ? found.systems : [];
  }, [selectedImo]);

  // Available weeks (Friday-ending NIA work weeks)
  const availableWeeks = useMemo(() => {
    return getAvailableWeeksFromReports(reports);
  }, [reports]);

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(
    initialWeekKey || (availableWeeks[0] ? availableWeeks[0].key : '')
  );

  const selectedWeekObj = useMemo(() => {
    return availableWeeks.find(w => w.key === selectedWeekKey) || availableWeeks[0];
  }, [availableWeeks, selectedWeekKey]);

  // Signatory State (Configurable per user profile)
  const initialUserSig = useMemo(() => getUserSignatories(currentUser?.id, currentUser).wmr, [currentUser]);
  const [preparedByName, setPreparedByName] = useState(initialUserSig.preparedByName);
  const [preparedByTitle, setPreparedByTitle] = useState(initialUserSig.preparedByTitle);
  const [reviewedByName, setReviewedByName] = useState(initialUserSig.reviewedByName);
  const [reviewedByTitle, setReviewedByTitle] = useState(initialUserSig.reviewedByTitle);
  const [notedByName, setNotedByName] = useState(initialUserSig.notedByName);
  const [notedByTitle, setNotedByTitle] = useState(initialUserSig.notedByTitle);
  const [initialsNote, setInitialsNote] = useState(initialUserSig.initialsNote || 'MLRN -\nLMM -');
  const [isEditingSignatories, setIsEditingSignatories] = useState(false);

  // Sync if currentUser changes or custom event fired
  useEffect(() => {
    const sig = getUserSignatories(currentUser?.id, currentUser).wmr;
    setPreparedByName(sig.preparedByName);
    setPreparedByTitle(sig.preparedByTitle);
    setReviewedByName(sig.reviewedByName);
    setReviewedByTitle(sig.reviewedByTitle);
    setNotedByName(sig.notedByName);
    setNotedByTitle(sig.notedByTitle);
    if (sig.initialsNote) setInitialsNote(sig.initialsNote);
  }, [currentUser]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const getSignatories = () => ({
    preparedByName,
    preparedByTitle,
    reviewedByName,
    reviewedByTitle,
    notedByName,
    notedByTitle,
    initialsNote
  });

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadWmrPdf(reports, selectedWeekObj, getSignatories(), selectedImo, selectedNis);
    } catch (err) {
      console.error('Failed to download WMR PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Filter reports matching selected Friday-ending week
  const weekReports = useMemo(() => {
    return reports.filter(r => isReportInWeek(r, selectedWeekKey));
  }, [reports, selectedWeekKey]);

  // Group weekly reports by IMO and NIS scoped to user permissions / selection
  const formattedData = useMemo(() => {
    const isMOMARO = (str: string) => str.includes('momaro') || str.includes('oriental') || str.includes('marinduque') || str.includes('romblon');
    const isOccidental = (str: string) => str.includes('occidental') || str.includes('omimo');
    const isPalawan = (str: string) => str.includes('palawan') || str.includes('pimo');

    let targetImos = [...MIMAROPA_SYSTEMS];
    if (selectedImo && selectedImo !== 'All IMOs' && selectedImo !== 'All') {
      const sLower = selectedImo.toLowerCase();
      targetImos = targetImos.filter(imo => {
        const imoLower = imo.name.toLowerCase();
        if (isMOMARO(sLower) && isMOMARO(imoLower)) return true;
        if (isOccidental(sLower) && isOccidental(imoLower)) return true;
        if (isPalawan(sLower) && isPalawan(imoLower)) return true;
        return imoLower.includes(sLower) || imo.shortName.toLowerCase().includes(sLower) || sLower.includes(imo.shortName.toLowerCase());
      });
    }

    const processedReportIds = new Set<string>();

    const result = targetImos.map(imo => {
      let targetSystems = [...imo.systems];
      if (selectedNis && selectedNis !== 'All NIS' && selectedNis !== 'All') {
        const nisTargetLower = selectedNis.toLowerCase();
        targetSystems = targetSystems.filter(nis =>
          nis.name.toLowerCase().includes(nisTargetLower) || nisTargetLower.includes(nis.name.toLowerCase())
        );
      }

      const nisGroups = targetSystems.map(nis => {
        // Find reports matching this NIS
        const nisLower = nis.name.toLowerCase();
        const imoLower = imo.name.toLowerCase();

        const matchedReports = weekReports.filter(r => {
          if (!r || processedReportIds.has(r.id)) return false;
          const repImo = (r.imoOffice || '').toLowerCase();
          const repNis = (r.nisBinding || '').toLowerCase();
          const repLoc = (r.locationName || '').toLowerCase();
          const repCanal = (r.canalSegment || '').toLowerCase();

          let matchesImo = false;
          if (!repImo) {
            matchesImo = true;
          } else if (isMOMARO(imoLower) && isMOMARO(repImo)) {
            matchesImo = true;
          } else if (isOccidental(imoLower) && isOccidental(repImo)) {
            matchesImo = true;
          } else if (isPalawan(imoLower) && isPalawan(repImo)) {
            matchesImo = true;
          } else {
            matchesImo = repImo.includes(imo.shortName.toLowerCase()) || repImo.includes(imoLower) || imoLower.includes(repImo);
          }

          const matchesNis = repNis.includes(nisLower) || repLoc.includes(nisLower) || repCanal.includes(nisLower) || nisLower.includes(repNis);
          return matchesImo && (matchesNis || (repNis === '' && repLoc.includes(nisLower)));
        });

        matchedReports.forEach(r => processedReportIds.add(r.id));

        const rows = matchedReports.map(rep => {
          const parsed = parseStationing(rep.locationName, rep);
          const distKm = rep.segmentDistanceMeters
            ? (rep.segmentDistanceMeters / 1000).toFixed(3)
            : (rep.calculatedVolumeM3 ? '' : '');

          // Remarks construction
          let remarks = rep.remarks || '';
          if (!remarks || remarks.startsWith('Maintenance activity performed')) {
            remarks = `${rep.maintenanceActivity || 'Maintenance action'} conducted along ${rep.locationName || nis.name} by ${rep.reporterName || 'NIA O&M Personnel'}.`;
          }

          return {
            id: rep.id,
            canalName: parsed.canalName || rep.canalSegment || 'Main Canal',
            lengthCanalKm: rep.segmentDistanceMeters ? (rep.segmentDistanceMeters / 1000).toFixed(3) : '',
            noOfStructures: parsed.structureUnits || (parsed.structureType ? '1' : ''),
            maintainedByIA: rep.reporterRole === 'Field Personnel' ? 'YES' : 'NO',
            fromStation: parsed.fromStation || (rep.segmentDistanceMeters ? '0+000.00' : ''),
            toStation: parsed.toStation || (rep.segmentDistanceMeters ? `${(rep.segmentDistanceMeters).toFixed(2)}` : ''),
            lengthKm: distKm,
            canalCondition: !parsed.structureType ? parsed.condition : '',
            structureType: parsed.structureType,
            structureStation: parsed.structureStation,
            structureUnits: parsed.structureUnits,
            structureCondition: parsed.structureType ? parsed.condition : '',
            remarks: remarks
          };
        });

        return {
          nisName: nis.name,
          division: nis.division,
          rows
        };
      });

      // Dynamic IMO remaining reports
      const imoLower = imo.name.toLowerCase();
      const remainingImoReports = weekReports.filter(r => {
        if (!r || processedReportIds.has(r.id)) return false;
        const repImo = (r.imoOffice || '').toLowerCase();
        if (!repImo) return false;
        if (isMOMARO(imoLower) && isMOMARO(repImo)) return true;
        if (isOccidental(imoLower) && isOccidental(repImo)) return true;
        if (isPalawan(imoLower) && isPalawan(repImo)) return true;
        return repImo.includes(imo.shortName.toLowerCase()) || repImo.includes(imoLower);
      });

      if (remainingImoReports.length > 0) {
        const groups = new Map<string, FieldReport[]>();
        remainingImoReports.forEach(r => {
          const groupKey = (r.nisBinding || r.locationName || r.canalSegment || 'OTHER CANAL SYSTEMS').toUpperCase();
          if (!groups.has(groupKey)) groups.set(groupKey, []);
          groups.get(groupKey)!.push(r);
          processedReportIds.add(r.id);
        });

        groups.forEach((reps, groupTitle) => {
          const rows = reps.map(rep => {
            const parsed = parseStationing(rep.locationName, rep);
            const distKm = rep.segmentDistanceMeters ? (rep.segmentDistanceMeters / 1000).toFixed(3) : '';
            let remarks = rep.remarks || `${rep.maintenanceActivity || 'Maintenance action'} conducted along ${rep.locationName || groupTitle} by ${rep.reporterName || 'NIA O&M Personnel'}.`;
            return {
              id: rep.id,
              canalName: parsed.canalName || rep.canalSegment || 'Main Canal',
              lengthCanalKm: distKm,
              noOfStructures: parsed.structureUnits || (parsed.structureType ? '1' : ''),
              maintainedByIA: rep.reporterRole === 'Field Personnel' ? 'YES' : 'NO',
              fromStation: parsed.fromStation || (rep.segmentDistanceMeters ? '0+000.00' : ''),
              toStation: parsed.toStation || (rep.segmentDistanceMeters ? `${(rep.segmentDistanceMeters).toFixed(2)}` : ''),
              lengthKm: distKm,
              canalCondition: !parsed.structureType ? parsed.condition : '',
              structureType: parsed.structureType,
              structureStation: parsed.structureStation,
              structureUnits: parsed.structureUnits,
              structureCondition: parsed.structureType ? parsed.condition : '',
              remarks
            };
          });
          nisGroups.push({
            nisName: groupTitle,
            division: undefined,
            rows
          });
        });
      }

      return {
        imoName: imo.name,
        systems: nisGroups
      };
    });

    // Global Unmatched Reports
    const remainingGlobalReports = weekReports.filter(r => r && !processedReportIds.has(r.id));
    if (remainingGlobalReports.length > 0) {
      const rows = remainingGlobalReports.map(rep => {
        processedReportIds.add(rep.id);
        const parsed = parseStationing(rep.locationName, rep);
        const distKm = rep.segmentDistanceMeters ? (rep.segmentDistanceMeters / 1000).toFixed(3) : '';
        let remarks = rep.remarks || `${rep.maintenanceActivity || 'Maintenance action'} by ${rep.reporterName || 'NIA O&M Personnel'}.`;
        return {
          id: rep.id,
          canalName: parsed.canalName || rep.canalSegment || 'Main Canal',
          lengthCanalKm: distKm,
          noOfStructures: parsed.structureUnits || (parsed.structureType ? '1' : ''),
          maintainedByIA: rep.reporterRole === 'Field Personnel' ? 'YES' : 'NO',
          fromStation: parsed.fromStation || (rep.segmentDistanceMeters ? '0+000.00' : ''),
          toStation: parsed.toStation || (rep.segmentDistanceMeters ? `${(rep.segmentDistanceMeters).toFixed(2)}` : ''),
          lengthKm: distKm,
          canalCondition: !parsed.structureType ? parsed.condition : '',
          structureType: parsed.structureType,
          structureStation: parsed.structureStation,
          structureUnits: parsed.structureUnits,
          structureCondition: parsed.structureType ? parsed.condition : '',
          remarks
        };
      });
      result.push({
        imoName: 'REGIONAL OFFICE / GENERAL ALIGNMENTS',
        systems: [{
          nisName: 'GENERAL CANAL REACHES',
          division: undefined,
          rows
        }]
      });
    }

    return result;
  }, [weekReports, selectedImo, selectedNis]);

  function matchedReportsAlreadyClaimed(id: string): boolean {
    return false;
  }

  // Export Form 691 CSV
  const handleExportForm691CSV = () => {
    const headers = [
      'NAME OF IMO/SYSTEM',
      'NAME OF CANAL',
      'TOTAL LENGTH OF CANAL (KM)',
      'TOTAL NO. OF STRUCTURES',
      'MAINTAINED BY IA UNDER IMT (YES)',
      'MAINTAINED BY IA UNDER IMT (NO)',
      'PROGRAM FOR MAINTENANCE - CANAL STATION FROM',
      'PROGRAM FOR MAINTENANCE - CANAL STATION TO',
      'PROGRAM FOR MAINTENANCE - CANAL LENGTH (KM)',
      'PROGRAM FOR MAINTENANCE - CANAL CONDITION',
      'PROGRAM FOR MAINTENANCE - STRUCTURE TYPE',
      'PROGRAM FOR MAINTENANCE - STRUCTURE STATION',
      'PROGRAM FOR MAINTENANCE - STRUCTURE NO. OF UNITS',
      'PROGRAM FOR MAINTENANCE - STRUCTURE CONDITION',
      'REMARKS'
    ];

    const rows: string[] = [];

    formattedData.forEach(imo => {
      rows.push(`"${imo.imoName}",,,,,,,,,,,,,,`);
      imo.systems.forEach(sys => {
        const sysLabel = sys.division ? `${sys.nisName} (${sys.division})` : sys.nisName;
        rows.push(`"${sysLabel}",,,,,,,,,,,,,,`);

        if (sys.rows.length === 0) {
          rows.push(`"No maintenance activities for this week.",,,,,,,,,,,,,,`);
        } else {
          sys.rows.forEach(r => {
            rows.push([
              `""`,
              `"${r.canalName}"`,
              `"${r.lengthCanalKm}"`,
              `"${r.noOfStructures}"`,
              r.maintainedByIA === 'YES' ? '"✓"' : '""',
              r.maintainedByIA === 'NO' ? '"✓"' : '""',
              `"${r.fromStation}"`,
              `"${r.toStation}"`,
              `"${r.lengthKm}"`,
              `"${r.canalCondition}"`,
              `"${r.structureType}"`,
              `"${r.structureStation}"`,
              `"${r.structureUnits}"`,
              `"${r.structureCondition}"`,
              `"${r.remarks.replace(/"/g, '""')}"`
            ].join(','));
          });
        }
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NIA_Form691_Weekly_Report_${selectedWeekKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Landscape Print & Page Styling */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 6mm 8mm !important;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #form691-printable-sheet {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Toolbar (Screen Only) */}
      <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">Period:</span>
            <select
              value={selectedWeekKey}
              onChange={(e) => setSelectedWeekKey(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-1.5 rounded-xl font-bold focus:border-amber-500 focus:outline-none"
            >
              {availableWeeks.map(w => (
                <option key={w.key} value={w.key}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* IMO & NIS Scope Selector / Badge */}
          {isRegionalRole ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* IMO Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400">IMO:</span>
                <select
                  value={selectedImo}
                  onChange={(e) => {
                    setSelectedImo(e.target.value);
                    setSelectedNis('All NIS');
                  }}
                  className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs px-2.5 py-1.5 rounded-xl font-semibold focus:border-cyan-500 focus:outline-none"
                >
                  <option value="All IMOs">All IMOs (Consolidated)</option>
                  <option value="MOMARO IMO">MOMARO IMO</option>
                  <option value="Occidental Mindoro IMO">Occidental Mindoro IMO</option>
                  <option value="Palawan IMO">Palawan IMO</option>
                </select>
              </div>

              {/* NIS Selector */}
              {selectedImo !== 'All IMOs' && availableNisForSelectedImo.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400">NIS:</span>
                  <select
                    value={selectedNis}
                    onChange={(e) => setSelectedNis(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-emerald-300 text-xs px-2.5 py-1.5 rounded-xl font-semibold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="All NIS">All NIS Systems</option>
                    {availableNisForSelectedImo.map(nis => (
                      <option key={nis.name} value={nis.name}>{nis.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-1 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center gap-2">
              <span className="text-[11px] text-cyan-400 font-mono font-bold">🔒 {selectedImo}</span>
              {selectedNis !== 'All NIS' && (
                <span className="text-[11px] text-emerald-400 font-mono font-bold">• {selectedNis}</span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsEditingSignatories(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${isEditingSignatories
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingSignatories ? 'Done Editing Signatories' : 'Edit Signatories'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Download WMR (PDF) */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-3.5 py-1.5 bg-[#009933] hover:bg-[#00802b] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm border border-[#00802b]/50 active:scale-95"
            title="Download true vector PDF file of Form 691"
          >
            {isDownloadingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                <span>Download WMR (PDF)</span>
              </>
            )}
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportForm691CSV}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Download CSV formatted in Form 691 schema"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#009933]" />
            <span>Export WMR CSV</span>
          </button>
        </div>
      </div>

      {/* Signatories Editor Drawer (Screen Only) */}
      {isEditingSignatories && (
        <div className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-2xl space-y-3 print:hidden">
          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Edit3 className="w-4 h-4" />
            <span>Edit Report Signatories &amp; Approvers</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Prepared by:</span>
              <input
                type="text"
                value={preparedByName}
                onChange={e => setPreparedByName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded-lg text-xs"
              />
              <input
                type="text"
                value={preparedByTitle}
                onChange={e => setPreparedByTitle(e.target.value)}
                placeholder="Designation"
                className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-2 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Reviewed by:</span>
              <input
                type="text"
                value={reviewedByName}
                onChange={e => setReviewedByName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded-lg text-xs"
              />
              <input
                type="text"
                value={reviewedByTitle}
                onChange={e => setReviewedByTitle(e.target.value)}
                placeholder="Designation"
                className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-2 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Noted by:</span>
              <input
                type="text"
                value={notedByName}
                onChange={e => setNotedByName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded-lg text-xs"
              />
              <input
                type="text"
                value={notedByTitle}
                onChange={e => setNotedByTitle(e.target.value)}
                placeholder="Designation"
                className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-2 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
      )}



      {/* ========================================================================= */}
      {/* FORM 691 PRINTABLE DOCUMENT CONTAINER (PIXEL-PERFECT OFFICIAL REPLICA)    */}
      {/* ========================================================================= */}
      <div
        id="form691-printable-sheet"
        className="bg-white text-black p-6 sm:p-8 rounded-xl shadow-2xl overflow-x-auto print:p-0 print:shadow-none print:m-0 font-cambria leading-tight border border-slate-300 print:border-none w-full min-w-[1100px] max-w-[1280px] mx-auto"
      >
        {/* Document Header with Official Logos & Metadata (No divider line) */}
        <div className="flex items-start justify-between pb-2">
          <div className="flex items-center gap-3">
            {/* Left Double Logo (Malacañang + NIA) */}
            <div className="flex items-center">
              <img
                src="/header-2025-left.png"
                alt="Office of the President & NIA Official Seal"
                className="h-14 w-auto object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/asd.ico.png';
                }}
              />
            </div>

            <div className="text-left space-y-0.5 pl-1">
              <div className="text-[10.5px] font-bold text-slate-900 font-cambria">Republic of the Philippines</div>
              <div className="text-[10px] font-normal tracking-wide uppercase text-slate-800 font-cambria">OFFICE OF THE PRESIDENT</div>
              <div className="text-[13px] font-bold text-slate-950 uppercase tracking-wide font-trajan">NATIONAL IRRIGATION ADMINISTRATION</div>
              <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wide font-trajan">REGIONAL OFFICE NO. IV-B (MIMAROPA)</div>
            </div>
          </div>

          {/* Right Header Logo (Bagong Pilipinas) */}
          <div className="flex items-center">
            <img
              src="/header-2026-right.png"
              alt="Bagong Pilipinas"
              className="h-14 w-auto object-contain shrink-0"
            />
          </div>
        </div>

        {/* Subheader: WEEKLY MAINTENANCE REPORT */}
        <div className="text-left py-2 space-y-0.5 font-cambria">
          <h1 className="text-xs font-bold uppercase text-black tracking-wide">
            WEEKLY MAINTENANCE REPORT
          </h1>
          <div className="text-[11px] font-bold text-black">
            {selectedWeekObj.label}
          </div>
          <div className="text-[10px] font-normal text-slate-800">
            {selectedNis && selectedNis !== 'All NIS' && selectedNis !== 'All'
              ? selectedNis
              : selectedImo && selectedImo !== 'All IMOs' && selectedImo !== 'All'
                ? selectedImo
                : 'Region IV-B MIMAROPA'}
          </div>
        </div>

        {/* Main Form 691 Table */}
        <table className="w-full border-collapse border-2 border-black text-[9.5px] my-2">
          {/* Banner Row */}
          <thead>
            <tr className="bg-slate-100 border-b border-black">
              <th colSpan={15} className="py-1 text-center font-bold text-[10px] uppercase tracking-wider text-black border-r border-black font-cambria">
                {selectedNis && selectedNis !== 'All NIS' && selectedNis !== 'All'
                  ? selectedNis.toUpperCase()
                  : selectedImo && selectedImo !== 'All IMOs' && selectedImo !== 'All'
                    ? selectedImo.toUpperCase()
                    : 'MIMAROPA REGION'}
              </th>
            </tr>

            {/* Nested Multi-Header Rows matching official Form 691 */}
            <tr className="bg-white border-b border-black text-center font-bold text-[9px]">
              <th rowSpan={3} className="border border-black p-1 w-24 uppercase">NAME OF<br />IMO/SYSTEM</th>
              <th rowSpan={3} className="border border-black p-1 w-28 uppercase">NAME OF CANAL</th>
              <th colSpan={2} className="border border-black p-1 uppercase">TOTAL</th>
              <th colSpan={2} className="border border-black p-1 uppercase">MAINTAINED BY IA<br />UNDER IMT</th>
              <th colSpan={8} className="border border-black p-1 uppercase">PROGRAM FOR MAINTENANCE</th>
              <th rowSpan={3} className="border border-black p-1.5 uppercase min-w-[200px]">REMARKS</th>
            </tr>
            <tr className="bg-white border-b border-black text-center font-bold text-[8.5px]">
              {/* TOTAL */}
              <th rowSpan={2} className="border border-black p-1 w-14">LENGTH OF<br />CANAL (KM)</th>
              <th rowSpan={2} className="border border-black p-1 w-14">NO. OF<br />STRUCTURES</th>

              {/* MAINTAINED BY IA */}
              <th rowSpan={2} className="border border-black p-1 w-7">YES</th>
              <th rowSpan={2} className="border border-black p-1 w-7">NO</th>

              {/* PROGRAM FOR MAINTENANCE: CANAL & STRUCTURE */}
              <th colSpan={4} className="border border-black p-1">CANAL</th>
              <th colSpan={4} className="border border-black p-1">STRUCTURE</th>
            </tr>
            <tr className="bg-white border-b-2 border-black text-center font-bold text-[8px]">
              {/* CANAL */}
              <th className="border border-black p-1 w-14">STATION<br />FROM</th>
              <th className="border border-black p-1 w-14">STATION<br />TO</th>
              <th className="border border-black p-1 w-12">LENGTH (km)</th>
              <th className="border border-black p-1 w-24">CONDITION</th>

              {/* STRUCTURE */}
              <th className="border border-black p-1 w-20">TYPE</th>
              <th className="border border-black p-1 w-14">STATION</th>
              <th className="border border-black p-1 w-10">NO. OF<br />UNITS</th>
              <th className="border border-black p-1 w-24">CONDITION</th>
            </tr>
          </thead>

          <tbody>
            {formattedData.map((imo) => {
              const isOccidental = imo.imoName.includes('OCCIDENTAL');
              const imoBg = isOccidental ? 'bg-[#dbeafe]' : 'bg-[#dcfce7]';
              const nisBg = isOccidental ? 'bg-[#eff6ff]' : 'bg-[#f0fdf4]';

              return (
                <React.Fragment key={imo.imoName}>
                  {/* IMO Title Row */}
                  <tr className={`${imoBg} text-black font-bold text-[10px] tracking-wide border-t border-b border-black`}>
                    <td colSpan={15} className="py-1 px-2 uppercase">
                      {imo.imoName}
                    </td>
                  </tr>

                  {/* Iterate RIS under IMO */}
                  {imo.systems.map((nis, nisIdx) => (
                    <React.Fragment key={`${imo.imoName}-${nis.nisName}-${nisIdx}`}>
                      {/* NIS Header Bar */}
                      <tr className={`${nisBg} text-black font-bold border-t border-b border-black`}>
                        <td colSpan={15} className="py-0.5 px-2 text-[9.5px] uppercase">
                          {nis.division ? `${nis.nisName} (${nis.division})` : nis.nisName}
                        </td>
                      </tr>

                      {/* Date Sub-header */}
                      <tr className="bg-white italic text-slate-700 border-b border-black text-[8.5px]">
                        <td colSpan={15} className="py-0.5 px-3">
                          {selectedWeekObj.label}
                        </td>
                      </tr>

                      {/* NIS Activities Rows */}
                      {nis.rows.length === 0 ? (
                        <tr className="border-b border-black text-center text-slate-600 italic">
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5"></td>
                          <td className="border border-black p-1.5 text-center font-semibold text-slate-500">
                            No maintenance activities for this week.
                          </td>
                        </tr>
                      ) : (
                        nis.rows.map((row, rIdx) => (
                          <tr key={row.id || rIdx} className="border-b border-black text-[9.5px] hover:bg-slate-50 transition">
                            {/* IMO/SYSTEM column (or Division) */}
                            <td className="border border-black p-1 text-center font-semibold text-slate-800">
                              {rIdx === 0 && nis.division ? nis.division : ''}
                            </td>

                            {/* NAME OF CANAL */}
                            <td className="border border-black p-1 font-bold text-slate-900">
                              {row.canalName}
                            </td>

                            {/* TOTAL LENGTH OF CANAL */}
                            <td className="border border-black p-1 text-center font-mono">
                              {row.lengthCanalKm}
                            </td>

                            {/* TOTAL NO. OF STRUCTURES */}
                            <td className="border border-black p-1 text-center font-mono">
                              {row.noOfStructures}
                            </td>

                            {/* MAINTAINED BY IA: YES */}
                            <td className="border border-black p-1 text-center font-bold">
                              {row.maintainedByIA === 'YES' ? '✓' : ''}
                            </td>

                            {/* MAINTAINED BY IA: NO */}
                            <td className="border border-black p-1 text-center font-bold">
                              {row.maintainedByIA === 'NO' ? '✓' : ''}
                            </td>

                            {/* CANAL STATION FROM */}
                            <td className="border border-black p-1 text-center font-mono">
                              {row.fromStation}
                            </td>

                            {/* CANAL STATION TO */}
                            <td className="border border-black p-1 text-center font-mono">
                              {row.toStation}
                            </td>

                            {/* CANAL LENGTH (KM) */}
                            <td className="border border-black p-1 text-center font-mono font-bold">
                              {row.lengthKm}
                            </td>

                            {/* CANAL CONDITION */}
                            <td className="border border-black p-1 text-left text-slate-800">
                              {row.canalCondition}
                            </td>

                            {/* STRUCTURE TYPE */}
                            <td className="border border-black p-1 text-left font-semibold">
                              {row.structureType}
                            </td>

                            {/* STRUCTURE STATION */}
                            <td className="border border-black p-1 text-center font-mono">
                              {row.structureStation}
                            </td>

                            {/* STRUCTURE NO. OF UNITS */}
                            <td className="border border-black p-1 text-center font-mono">
                              {row.structureUnits}
                            </td>

                            {/* STRUCTURE CONDITION */}
                            <td className="border border-black p-1 text-left text-slate-800">
                              {row.structureCondition}
                            </td>

                            {/* REMARKS */}
                            <td className="border border-black p-1.5 text-left text-[9px] leading-snug">
                              {row.remarks}
                            </td>
                          </tr>
                        ))
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Signatories Block */}
        <div className="grid grid-cols-3 gap-6 pt-6 pb-4 text-[11px] font-sans">
          {/* Prepared By */}
          <div className="space-y-4">
            <span className="text-slate-700 font-semibold block">Prepared by:</span>
            <div className="pt-6 border-b border-transparent">
              <div className="font-bold uppercase tracking-wide text-slate-950 font-heading">
                {preparedByName}
              </div>
              <div className="text-[10px] text-slate-600 font-medium">
                {preparedByTitle}
              </div>
            </div>
            <div className="text-[9px] font-mono text-slate-500 whitespace-pre-line pt-2">
              {initialsNote}
            </div>
          </div>

          {/* Reviewed By */}
          <div className="space-y-4">
            <span className="text-slate-700 font-semibold block">Reviewed by:</span>
            <div className="pt-6 border-b border-transparent">
              <div className="font-bold uppercase tracking-wide text-slate-950 font-heading">
                {reviewedByName}
              </div>
              <div className="text-[10px] text-slate-600 font-medium">
                {reviewedByTitle}
              </div>
            </div>
          </div>

          {/* Noted By */}
          <div className="space-y-4">
            <span className="text-slate-700 font-semibold block">Noted by:</span>
            <div className="pt-6 border-b border-transparent">
              <div className="font-bold uppercase tracking-wide text-slate-950 font-heading">
                {notedByName}
              </div>
              <div className="text-[10px] text-slate-600 font-medium">
                {notedByTitle}
              </div>
            </div>
          </div>
        </div>

        {/* Official NIA Institutional Footer (No background wave, no dividing border, 75% ISO logo) */}
        <div className="mt-8 pt-2 font-calibri bg-white select-none">
          <div className="flex items-end justify-between px-1 pb-1 text-[9px] text-slate-800">
            <div className="space-y-0.5 text-left">
              <div className="font-semibold text-slate-900">Brgy. Bayanan II, Calapan City, Oriental Mindoro, Philippines • Telefax No. : (043) 288-7267</div>
              <div className="text-slate-700">Email: r4b@nia.gov.ph • Website: www.region4b.nia.gov.ph • TIN: 000-916-415-166</div>
              <div className="font-bold text-slate-950 text-[10px] pt-1 tracking-wide font-calibri">NIA-RO4B-EOD-OPS-INT-Form691 Rev.01</div>
            </div>

            {/* Footer ISO Logo (QR Code + ISO 9001:2015 + PAB Accreditation - 75% Scale) */}
            <div className="flex items-center shrink-0 pr-1">
              <img src="/footer-iso-logo.png" alt="ISO 9001:2015 & PAB Certification" className="h-8 max-h-[30px] w-auto object-contain" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
