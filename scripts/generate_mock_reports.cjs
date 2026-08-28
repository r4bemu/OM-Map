const fs = require('fs');
const path = require('path');

function createSvgDataUri(monthName, day, year, stage, location) {
  const cleanLoc = (location || 'Canal Segment').replace(/[<>&'"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="#1e293b"/>
  <rect x="20" y="20" width="600" height="440" fill="#0f172a" stroke="#334155" stroke-width="2" rx="12"/>
  <circle cx="320" cy="170" r="44" fill="#0284c7" opacity="0.25"/>
  <text x="320" y="165" fill="#38bdf8" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">NIA FIELD INSPECTION</text>
  <text x="320" y="195" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">[${stage.toUpperCase()} STAGE]</text>
  <text x="320" y="260" fill="#f8fafc" font-family="sans-serif" font-size="24" font-weight="bold" text-anchor="middle">${monthName} ${day}, ${year}</text>
  <text x="320" y="300" fill="#cbd5e1" font-family="sans-serif" font-size="15" text-anchor="middle">${cleanLoc}</text>
  <text x="320" y="340" fill="#64748b" font-family="monospace" font-size="12" text-anchor="middle">MOCK PHOTO EVIDENCE</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const SYSTEMS = [
  // MOMARO IMO
  {
    imo: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nis: 'Baco-Bucayao RIS',
    canals: [
      { name: 'Main Canal', baseLat: 13.355, baseLng: 121.168 },
      { name: 'Lateral A', baseLat: 13.362, baseLng: 121.175 },
      { name: 'Lateral B', baseLat: 13.348, baseLng: 121.162 },
      { name: 'Lateral C', baseLat: 13.351, baseLng: 121.180 }
    ],
    reporters: ['Engr. Juan Dela Cruz', 'Engr. Maria Santos', 'Engr. Arnel Garcia']
  },
  {
    imo: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nis: 'Mag-asawang Tubig RIS',
    canals: [
      { name: 'Main Canal', baseLat: 13.250, baseLng: 121.320 },
      { name: 'Lateral A', baseLat: 13.258, baseLng: 121.328 },
      { name: 'Lateral B', baseLat: 13.242, baseLng: 121.315 }
    ],
    reporters: ['Engr. Roberto Ramos', 'Engr. Elena Bautista']
  },
  {
    imo: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nis: 'Pula RIS',
    canals: [
      { name: 'Main Canal', baseLat: 13.120, baseLng: 121.450 },
      { name: 'Lateral A', baseLat: 13.125, baseLng: 121.458 }
    ],
    reporters: ['Engr. Carlo Mendoza', 'Engr. Teresa Reyes']
  },
  {
    imo: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nis: 'Bongabong RIS',
    canals: [
      { name: 'Main Canal', baseLat: 12.750, baseLng: 121.480 },
      { name: 'Lateral A', baseLat: 12.755, baseLng: 121.488 }
    ],
    reporters: ['Engr. Fernando Morales']
  },

  // OCCIDENTAL MINDORO IMO
  {
    imo: 'Occidental Mindoro IMO',
    nis: 'Mamburao RIS',
    canals: [
      { name: 'Main Canal', baseLat: 13.220, baseLng: 120.600 },
      { name: 'Lateral A', baseLat: 13.225, baseLng: 120.608 },
      { name: 'Lateral B', baseLat: 13.215, baseLng: 120.595 }
    ],
    reporters: ['Engr. Josefa Llanes', 'Engr. Danilo Aquino']
  },
  {
    imo: 'Occidental Mindoro IMO',
    nis: 'Amnay RIS',
    canals: [
      { name: 'Main Canal', baseLat: 13.050, baseLng: 120.720 },
      { name: 'Lateral A', baseLat: 13.058, baseLng: 120.728 }
    ],
    reporters: ['Engr. Ramon Magsaysay', 'Engr. Angela Cruz']
  },
  {
    imo: 'Occidental Mindoro IMO',
    nis: 'Patrick RIS',
    canals: [
      { name: 'Main Canal', baseLat: 12.850, baseLng: 120.850 }
    ],
    reporters: ['Engr. Benigno Aquino']
  },
  {
    imo: 'Occidental Mindoro IMO',
    nis: 'Bugsanga RIS',
    canals: [
      { name: 'Main Canal', baseLat: 12.350, baseLng: 121.050 },
      { name: 'Lateral A', baseLat: 12.358, baseLng: 121.058 }
    ],
    reporters: ['Engr. Corazon Aquino', 'Engr. Fidel Ramos']
  },

  // PALAWAN IMO
  {
    imo: 'Palawan IMO',
    nis: 'Malatgao RIS',
    canals: [
      { name: 'Main Canal', baseLat: 9.320, baseLng: 118.250 },
      { name: 'Lateral A', baseLat: 9.328, baseLng: 118.258 },
      { name: 'Lateral B', baseLat: 9.315, baseLng: 118.245 }
    ],
    reporters: ['Engr. Manuel Roxas', 'Engr. Gloria Macapagal']
  },
  {
    imo: 'Palawan IMO',
    nis: 'Daalam RIS',
    canals: [
      { name: 'Main Canal', baseLat: 9.450, baseLng: 118.380 }
    ],
    reporters: ['Engr. Diosdado Macapagal']
  },
  {
    imo: 'Palawan IMO',
    nis: 'Batang-Batang RIS',
    canals: [
      { name: 'Main Canal', baseLat: 9.150, baseLng: 118.050 }
    ],
    reporters: ['Engr. Joseph Estrada']
  }
];

const ACTIVITIES = [
  'Desilting / Clearing of Canal (Mechanical)',
  'Desilting / Clearing of Canal (Manual)',
  'Gate Lubrication',
  'Canal Repair / Construction',
  'Service Road Maintenance',
  'Painting',
  'Brass dam / dredging at water source',
  'Temporary Fix'
];

const MONTHS = [
  { name: 'January', days: 31, monthIdx: 0, weeks: [3, 10, 17, 24, 29] },
  { name: 'February', days: 28, monthIdx: 1, weeks: [5, 12, 19, 26] },
  { name: 'March', days: 31, monthIdx: 2, weeks: [5, 12, 19, 26] },
  { name: 'April', days: 30, monthIdx: 3, weeks: [2, 9, 16, 23, 29] },
  { name: 'May', days: 31, monthIdx: 4, weeks: [7, 14, 21, 28] },
  { name: 'June', days: 30, monthIdx: 5, weeks: [4, 11, 18, 25] },
  { name: 'July', days: 31, monthIdx: 6, weeks: [2, 9, 16, 23, 30] },
  { name: 'August', days: 16, monthIdx: 7, weeks: [3, 7, 12, 15] }
];

const reports = [];
let reportCounter = 100;

MONTHS.forEach(m => {
  m.weeks.forEach((day, wIdx) => {
    // Generate 3-5 reports per week across various IMOs
    SYSTEMS.forEach((sys, sysIdx) => {
      // Pick 1-2 canals per system for this date
      const canal = sys.canals[wIdx % sys.canals.length];
      reportCounter++;
      
      const isMaint = (reportCounter % 4 !== 0); // 75% maintenance, 25% operational
      const dateObj = new Date(2026, m.monthIdx, day, 8 + (reportCounter % 8), (reportCounter * 7) % 60);
      const isoDate = dateObj.toISOString();
      const repId = `mock-rep-2026-${String(m.monthIdx + 1).padStart(2, '0')}-${String(reportCounter).padStart(3, '0')}`;
      
      const startStaM = (reportCounter * 120) % 4500;
      const lengthM = 150 + ((reportCounter * 35) % 400);
      const endStaM = startStaM + lengthM;
      const startStaFmt = `Sta. ${Math.floor(startStaM / 1000)}+${String(startStaM % 1000).padStart(3, '0')}`;
      const endStaFmt = `Sta. ${Math.floor(endStaM / 1000)}+${String(endStaM % 1000).padStart(3, '0')}`;
      const locName = `${sys.nis} - ${canal.name} (${startStaFmt} to ${endStaFmt})`;

      const latOffset = ((reportCounter % 20) - 10) * 0.001;
      const lngOffset = (((reportCounter * 3) % 20) - 10) * 0.001;
      const lat1 = canal.baseLat + latOffset;
      const lng1 = canal.baseLng + lngOffset;
      const lat2 = lat1 + 0.002 + ((reportCounter % 5) * 0.0005);
      const lng2 = lng1 + 0.0015 + ((reportCounter % 5) * 0.0005);

      const reporter = sys.reporters[reportCounter % sys.reporters.length];
      const isIA = (reportCounter % 3 === 0);
      const act = ACTIVITIES[reportCounter % ACTIVITIES.length];

      const photos = [
        {
          id: `p-${repId}-1`,
          url: createSvgDataUri(m.name, day, 2026, 'Before', locName),
          stage: 'Before',
          caption: `Before ${act} at ${startStaFmt}`,
          capturedAt: isoDate,
          imoOffice: sys.imo,
          locationName: locName,
          canalSegment: canal.name,
          lat: lat1,
          lng: lng1
        },
        {
          id: `p-${repId}-2`,
          url: createSvgDataUri(m.name, day, 2026, 'During', locName),
          stage: 'During',
          caption: `During execution along ${canal.name}`,
          capturedAt: isoDate,
          imoOffice: sys.imo,
          locationName: locName,
          canalSegment: canal.name,
          lat: (lat1 + lat2) / 2,
          lng: (lng1 + lng2) / 2
        },
        {
          id: `p-${repId}-3`,
          url: createSvgDataUri(m.name, day, 2026, 'After', locName),
          stage: 'After',
          caption: `Completed maintenance section at ${endStaFmt}`,
          capturedAt: isoDate,
          imoOffice: sys.imo,
          locationName: locName,
          canalSegment: canal.name,
          lat: lat2,
          lng: lng2
        }
      ];

      const depth = 0.6 + ((reportCounter % 6) * 0.15);
      const width = 1.8 + ((reportCounter % 5) * 0.3);
      const distKm = lengthM / 1000;
      const vol = Math.round(lengthM * depth * width * 10) / 10;

      const reportObj = {
        id: repId,
        title: isMaint ? `${act} at ${canal.name}` : `Operational Flow Status at ${canal.name}`,
        reportType: isMaint ? 'maintenance' : 'operational',
        categoryMode: isMaint ? 'maintenance' : 'operational',
        imoOffice: sys.imo,
        nisBinding: sys.nis,
        lat: lat1,
        lng: lng1,
        secondLat: lat2,
        secondLng: lng2,
        locationName: locName,
        pathCoords: [
          [lat1, lng1],
          [(lat1 * 2 + lat2) / 3, (lng1 * 2 + lng2) / 3],
          [(lat1 + lat2 * 2) / 3, (lng1 + lng2 * 2) / 3],
          [lat2, lng2]
        ],
        canalSegment: canal.name,
        maintenanceActivity: isMaint ? act : undefined,
        operationalState: !isMaint ? 'Fully Operational' : undefined,
        waterLevelMeters: !isMaint ? (0.8 + (reportCounter % 5) * 0.2) : undefined,
        dischargeFlowM3s: !isMaint ? (2.4 + (reportCounter % 8) * 0.3) : undefined,
        gateOpeningCm: !isMaint ? (45 + (reportCounter % 6) * 10) : undefined,
        waterQuality: !isMaint ? 'Clear / Optimal' : undefined,
        status: (reportCounter % 7 === 0) ? 'In Progress' : 'Completed',
        performedBy: isIA ? 'IA' : 'IMO',
        performedByDetails: isIA ? 'Maintained by Irrigators Association under IMT' : 'Direct NIA Maintenance Force',
        performedByIA: isIA ? 'Samahang Magsasaka IA' : undefined,
        remarks: isMaint 
          ? `${act} along ${locName}. Flow velocity restored to normal design gradient.`
          : `Discharge monitoring and water level calibration conducted at ${locName}.`,
        reporterName: reporter,
        reporterRole: 'O&M Engineer',
        createdAt: isoDate,
        synced: true,
        approvalStatus: 'Approved',
        approvedBy: 'Regional O&M Chief',
        approvedAt: isoDate,
        photos: photos,
        photoUrl: photos[0].url,
        segmentDistanceMeters: lengthM,
        segmentDistanceFormatted: `${(lengthM / 1000).toFixed(3)} km (${lengthM} m)`,
        depthMeters: depth,
        widthMeters: width,
        calculatedVolumeM3: vol,
        desiltingVolumeM3: vol,
        completionPercent: (reportCounter % 7 === 0) ? 65 : 100
      };

      reports.push(reportObj);
    });
  });
});

console.log(`Generated ${reports.length} mock field reports spanning Jan-Aug 2026!`);

const outputCode = `import { FieldReport } from '../types';

/**
 * Isolated Local Mock Field Reports (January 2026 - August 2026)
 * - Safe for debugging and demonstration.
 * - Bypassed from Google Drive sync.
 * - Isolated in this file for one-click destruction.
 */
export const MOCK_FIELD_REPORTS_2026: FieldReport[] = ${JSON.stringify(reports, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '../src/data/mockFieldReports2026.ts'), outputCode, 'utf-8');
console.log('Successfully written to src/data/mockFieldReports2026.ts!');
