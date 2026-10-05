const fs = require('fs');
const path = require('path');

const srcBase = 'C:\\Users\\r4bem\\OneDrive\\EMU-PC1 (Desktop)\\NIA FOLDER\\OPERATIONS\\O&M Web App\\Auditing of New GIS Data\\Audited Web GeoJson';
const destBase = path.join(process.cwd(), 'data', 'gis_network');
const persistentLayersPath = path.join(process.cwd(), 'data', 'persistent_layers.json');

const systemConfig = [
  { name: 'Amnay RIS', imoDir: 'OMIMO', imo: 'Occidental Mindoro IMO', prefix: 'OMIMO' },
  { name: 'Baco Bucayao RIS', imoDir: 'MOMARO', imo: 'Mindoro Oriental-Marinduque-Romblon IMO', prefix: 'MOMARO IMO', abbr: 'BBRIS' },
  { name: 'Bansud RIS', imoDir: 'MOMARO', imo: 'Mindoro Oriental-Marinduque-Romblon IMO', prefix: 'MOMARO IMO' },
  { name: 'Batang Batang RIS', imoDir: 'PIMO', imo: 'Palawan IMO', prefix: 'Palawan IMO' },
  { name: 'Caguray RIS', imoDir: 'OMIMO', imo: 'Occidental Mindoro IMO', prefix: 'OMIMO' },
  { name: 'Cantingas RIS', imoDir: 'MOMARO', imo: 'Mindoro Oriental-Marinduque-Romblon IMO', prefix: 'MOMARO IMO' },
  { name: 'Lumintao RIS', imoDir: 'OMIMO', imo: 'Occidental Mindoro IMO', prefix: 'OMIMO' },
  { name: 'Mag Asawang Tubig RIS', imoDir: 'MOMARO', imo: 'Mindoro Oriental-Marinduque-Romblon IMO', prefix: 'MOMARO IMO', abbr: 'MATRIS' },
  { name: 'Malatgao RIS', imoDir: 'PIMO', imo: 'Palawan IMO', prefix: 'Palawan IMO' },
  { name: 'Mongpong RIS', imoDir: 'OMIMO', imo: 'Occidental Mindoro IMO', prefix: 'OMIMO' },
  { name: 'Pagbahan RIS', imoDir: 'OMIMO', imo: 'Occidental Mindoro IMO', prefix: 'OMIMO' },
  { name: 'Pula RIS', imoDir: 'MOMARO', imo: 'Mindoro Oriental-Marinduque-Romblon IMO', prefix: 'MOMARO IMO' }
];

function formatStationingNumber(meters) {
  if (isNaN(meters) || meters < 0) meters = 0;
  const rounded = Math.round(meters * 10) / 10;
  const km = Math.floor(rounded / 1000);
  const rem = rounded % 1000;
  const intPart = Math.floor(rem).toString().padStart(3, '0');
  const decVal = Math.round((rounded % 1) * 10);
  const decPart = decVal > 0 ? `.${decVal}` : '.0';
  return `${km}+${intPart}${decPart}`;
}

function parseStationingFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/(\d+)\+(\d+(?:\.\d+)?)/);
  if (match) {
    const km = parseInt(match[1], 10);
    const meters = parseFloat(match[2]);
    return km * 1000 + meters;
  }
  return null;
}

function normalizeBBRISStructures(structuresData, canalsData) {
  const canalNames = [...new Set(canalsData.features.map(f => f.properties.canal))].sort((a,b) => b.length - a.length);

  function getCanal(name) {
    let u = (name || '').toUpperCase().trim();
    u = u.replace(/^BBRIS\s+/, '');
    u = u.replace('BAYOG LATERAL', 'BAYOG SUB LATERAL');
    u = u.replace('CALAPAN DAM MC LEFT', 'CALAPAN DAM MAIN CANAL LEFT');
    u = u.replace('CALAPAN DAM MC RIGHT', 'CALAPAN DAM MAIN CANAL RIGHT');
    u = u.replace('CALAPAN DAM HEADGATE LEFT', 'CALAPAN DAM MAIN CANAL LEFT');
    u = u.replace('CALAPAN DAM RIGHT', 'CALAPAN DAM MAIN CANAL RIGHT');
    u = u.replace('KILO-KILO DAM MC', 'KILO-KILO DAM MAIN CANAL');
    u = u.replace(/^KILO-KILO DAM\s/, 'KILO-KILO DAM MAIN CANAL ');
    const match = canalNames.find(c => u.startsWith(c.toUpperCase()));
    return match || 'MAIN CANAL';
  }

  structuresData.features.forEach(f => {
    const p = f.properties;
    if (!p.canal_name) {
      p.canal_name = getCanal(p.name);
    }
    if (p.station_m === undefined || p.station_m === null) {
      const stM = parseStationingFromText(p.station || p.name || '');
      if (stM !== null) {
        p.station_m = stM;
        p.station = `STA ${formatStationingNumber(stM)}`;
      } else {
        p.station_m = 0;
        p.station = 'STA 0+000.0';
      }
    }
    if (p.elevation_m === undefined && p.ele !== undefined) {
      p.elevation_m = p.ele;
    }
    if (!p.Structure_Category && p.type) {
      p.Structure_Category = p.type;
    }
  });

  return structuresData;
}

async function run() {
  console.log('🚀 Starting ingestion of audited NIA Region IV-B GIS datasets...');

  // Ensure directories exist
  ['MOMARO', 'OMIMO', 'PIMO'].forEach(dir => {
    const p = path.join(destBase, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  const persistentLayers = [];
  let totalCanalFeatures = 0;
  let totalStructureFeatures = 0;

  for (const sys of systemConfig) {
    const sysSrcDir = path.join(srcBase, sys.name);
    const files = fs.readdirSync(sysSrcDir).filter(f => f.endsWith('.geojson'));

    const canalsFile = files.find(f => f.includes('canals') && !f.includes('overview') && !f.includes('reversals'));
    const structuresFile = files.find(f => f.includes('structures'));

    if (!canalsFile || !structuresFile) {
      console.error(`❌ Missing core layers for ${sys.name}: canals=${canalsFile}, structures=${structuresFile}`);
      continue;
    }

    // 1. Process Canals
    const canalsRaw = fs.readFileSync(path.join(sysSrcDir, canalsFile), 'utf8');
    const canalsJson = JSON.parse(canalsRaw);
    totalCanalFeatures += canalsJson.features.length;

    // Save canals file to destination
    const canalDestImo = path.join(destBase, sys.imoDir, canalsFile);
    const canalDestRoot = path.join(destBase, canalsFile);
    fs.writeFileSync(canalDestImo, JSON.stringify(canalsJson, null, 2), 'utf8');
    fs.writeFileSync(canalDestRoot, JSON.stringify(canalsJson, null, 2), 'utf8');

    const canalFileId = `local-${sys.imoDir.toLowerCase()}-${canalsFile.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const canalLayer = {
      id: `drive-${canalFileId}`,
      driveFileId: canalFileId,
      name: `${sys.prefix} - ${sys.name} Canals`,
      fileName: canalsFile,
      category: 'Canals',
      subCategory: 'Canal Network',
      geometryType: 'LineString',
      visible: true,
      color: '#38bdf8',
      opacity: 0.85,
      featureCount: canalsJson.features.length,
      imoOffice: sys.imo,
      source: 'Google Drive',
      uploadedAt: new Date().toISOString(),
      data: canalsJson
    };
    persistentLayers.push(canalLayer);

    // 2. Process Structures
    const structuresRaw = fs.readFileSync(path.join(sysSrcDir, structuresFile), 'utf8');
    let structuresJson = JSON.parse(structuresRaw);

    if (sys.name === 'Baco Bucayao RIS') {
      structuresJson = normalizeBBRISStructures(structuresJson, canalsJson);
    }
    totalStructureFeatures += structuresJson.features.length;

    // Save structures file to destination
    const structDestImo = path.join(destBase, sys.imoDir, structuresFile);
    const structDestRoot = path.join(destBase, structuresFile);
    fs.writeFileSync(structDestImo, JSON.stringify(structuresJson, null, 2), 'utf8');
    fs.writeFileSync(structDestRoot, JSON.stringify(structuresJson, null, 2), 'utf8');

    const structFileId = `local-${sys.imoDir.toLowerCase()}-${structuresFile.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const structLayer = {
      id: `drive-${structFileId}`,
      driveFileId: structFileId,
      name: `${sys.prefix} - ${sys.name} Structures`,
      fileName: structuresFile,
      category: 'Structures',
      subCategory: 'Structures',
      geometryType: 'Point',
      visible: true,
      color: '#0284c7',
      opacity: 0.85,
      featureCount: structuresJson.features.length,
      imoOffice: sys.imo,
      source: 'Google Drive',
      uploadedAt: new Date().toISOString(),
      data: structuresJson
    };
    persistentLayers.push(structLayer);

    console.log(`✅ Processed ${sys.name}: ${canalsJson.features.length} canals, ${structuresJson.features.length} structures`);
  }

  // Remove old obsolete combined and auxiliary audit files from data/gis_network
  const oldFilesToRemove = [
    'Batang_Batang_RIS_canals_full_length_overview.geojson',
    'Batang_Batang_RIS_suggested_reversals.geojson',
    'Baco_Bucayao_RIS_corrected.geojson',
    'Batang_Batang_RIS.geojson',
    'Amnay_RIS.geojson',
    'Bansud_RIS.geojson',
    'Caguray_RIS.geojson',
    'Cantingas_RIS.geojson',
    'Lumintao_RIS.geojson',
    'Mag_Asawang_Tubig_RIS.geojson',
    'Malatgao_RIS.geojson',
    'Mongpong_RIS.geojson',
    'Pagbahan_RIS.geojson',
    'Pula_RIS.geojson'
  ];

  oldFilesToRemove.forEach(f => {
    ['MOMARO', 'OMIMO', 'PIMO', ''].forEach(dir => {
      const p = path.join(destBase, dir, f);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
          console.log(`🗑️ Removed legacy file: ${path.relative(process.cwd(), p)}`);
        } catch (_) {}
      }
    });
  });

  // Write new persistent_layers.json
  fs.writeFileSync(persistentLayersPath, JSON.stringify(persistentLayers, null, 2), 'utf8');
  console.log(`\n🎉 Successfully saved ${persistentLayers.length} persistent layers into persistent_layers.json!`);
  console.log(`📊 Summary:`);
  console.log(`   - Systems: ${systemConfig.length}`);
  console.log(`   - Canal Layers: 12 (${totalCanalFeatures} total linestrings)`);
  console.log(`   - Structure Layers: 12 (${totalStructureFeatures} total point features)`);
  console.log(`   - Total Features: ${totalCanalFeatures + totalStructureFeatures}`);
}

run().catch(err => {
  console.error('Fatal error during GIS ingestion:', err);
  process.exit(1);
});
