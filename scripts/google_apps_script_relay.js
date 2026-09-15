/**
 * ===================================================================
 * NATIONAL IRRIGATION ADMINISTRATION (NIA) REGION IV-B
 * O&M FIELD MAINTENANCE & OPERATIONAL REPORTS - GOOGLE DRIVE RELAY
 * ===================================================================
 * 
 * INSTRUCTIONS TO DEPLOY:
 * 1. Go to https://script.google.com while logged into your Google account (e.g. r4b.emu@gmail.com).
 * 2. Click "+ New project".
 * 3. Delete any default code in the editor, and paste this entire script.
 * 4. (Optional) Rename the project at the top to: "NIA O&M Drive Relay".
 * 5. Click the blue "Deploy" button (top right) -> Select "New deployment".
 * 6. Click the gear icon (⚙️) next to "Select type" and select "Web app".
 * 7. Configure:
 *    - Description: "NIA O&M Reports Uploader"
 *    - Execute as: "Me (r4b.emu@gmail.com)"
 *    - Who has access: "Anyone"
 * 8. Click "Deploy".
 * 9. Click "Authorize access", choose your Google account, click "Advanced" -> "Go to (unsafe)", and click "Allow".
 * 10. Copy the generated "Web app URL" (starts with https://script.google.com/macros/s/.../exec).
 * 11. Put it in your .env file:
 *     GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
 * ===================================================================
 */

// Designated Google Drive IMO Folder IDs
const IMO_FOLDERS = {
  'MOMARO': '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb',
  'Mindoro Oriental-Marinduque-Romblon IMO': '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb',
  'Occidental Mindoro': '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf',
  'Occidental Mindoro IMO': '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf',
  'Palawan': '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB',
  'Palawan IMO': '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB'
};

function getDesignatedFolder(imoOffice, targetFolderId) {
  if (targetFolderId) {
    try {
      return DriveApp.getFolderById(targetFolderId);
    } catch (e) {
      Logger.log('Could not open targetFolderId, falling back to IMO mapping: ' + e);
    }
  }

  var imo = (imoOffice || '').toLowerCase();
  var folderId = IMO_FOLDERS['MOMARO'];
  if (imo.indexOf('palawan') !== -1 || imo.indexOf('pimo') !== -1) {
    folderId = IMO_FOLDERS['Palawan'];
  } else if (imo.indexOf('occidental') !== -1 || imo.indexOf('mindoro occ') !== -1 || imo.indexOf('omimo') !== -1) {
    folderId = IMO_FOLDERS['Occidental Mindoro'];
  }

  return DriveApp.getFolderById(folderId);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: 'Empty request payload received' });
    }

    var payload = JSON.parse(e.postData.contents);
    if (payload.action === 'getReports' || payload.action === 'listReports') {
      return handleGetReports(payload.imo || payload.imoOffice);
    }
    var report = payload.report || payload;
    var imoOffice = report.imoOffice || payload.imoOffice || 'Mindoro Oriental-Marinduque-Romblon IMO';
    var targetFolderId = payload.targetFolderId || report.driveFolderId;

    var parentFolder = getDesignatedFolder(imoOffice, targetFolderId);
    var reportId = report.id || ('REP_' + Utilities.formatDate(new Date(), 'GMT+8', 'yyyyMMdd_HHmmss'));
    var safeTitle = (report.title || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    var folderName = reportId + '_' + safeTitle;

    // Find or create report subfolder in target IMO folder
    var subfolders = parentFolder.getFoldersByName(folderName);
    var reportFolder = subfolders.hasNext() ? subfolders.next() : parentFolder.createFolder(folderName);

    // Make report subfolder public read for seamless thumbnail display
    try {
      reportFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (_) {}

    var reportFolderId = reportFolder.getId();

    // 1. Process and upload inspection photos
    var updatedPhotos = [];
    var photosList = (report.photos && Array.isArray(report.photos)) ? report.photos : [];
    if (report.photoUrl && photosList.length === 0) {
      photosList = [{ id: 'p1', url: report.photoUrl, stage: 'Photo' }];
    }

    var uploadedPhotoCount = 0;
    for (var i = 0; i < photosList.length; i++) {
      var photo = photosList[i];
      if (!photo || !photo.url) {
        updatedPhotos.push(photo);
        continue;
      }

      var photoItem = {
        id: photo.id || ('p_' + (i + 1)),
        stage: photo.stage || 'During',
        locationName: photo.locationName || report.locationName || '',
        canalSegment: photo.canalSegment || report.canalSegment || '',
        parcelId: photo.parcelId || report.parcelId || '',
        lat: photo.lat !== undefined ? photo.lat : report.lat,
        lng: photo.lng !== undefined ? photo.lng : report.lng,
        capturedAt: photo.capturedAt || report.createdAt || new Date().toISOString()
      };

      if (photo.url.indexOf('data:image/') === 0) {
        try {
          var matches = photo.url.match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
          if (matches) {
            var mimeType = matches[1].toLowerCase();
            var base64Data = matches[2].replace(/[\r\n\s]/g, '');
            var ext = mimeType.indexOf('png') !== -1 ? '.png' : (mimeType.indexOf('webp') !== -1 ? '.webp' : '.jpg');
            var stageName = (photo.stage || ('Stage_' + (i + 1))).replace(/[^a-zA-Z0-9]/g, '');
            var fileName = reportId + '_' + (i + 1) + '_' + stageName + ext;

            var decodedBytes = Utilities.base64Decode(base64Data);
            var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
            var file = reportFolder.createFile(blob);

            try {
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (_) {}

            var fileId = file.getId();
            photoItem.id = fileId;
            photoItem.driveFileId = fileId;
            photoItem.url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
            photoItem.thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w600';
            uploadedPhotoCount++;
          }
        } catch (photoErr) {
          Logger.log('Error uploading photo ' + i + ': ' + photoErr);
          photoItem.url = photo.url;
        }
      } else {
        photoItem.url = photo.url;
        photoItem.driveFileId = photo.driveFileId;
      }
      updatedPhotos.push(photoItem);
    }

    report.photos = updatedPhotos;
    if (updatedPhotos.length > 0 && updatedPhotos[0].url) {
      report.photoUrl = updatedPhotos[0].url;
    }
    report.driveFolderId = reportFolderId;
    report.synced = true;

    // 2. Format Human-Readable Engineering Text Summary
    var summaryText = generateSummaryText(report, imoOffice);
    var summaryFileName = 'Summary_' + reportId + '.txt';
    var summaryFiles = reportFolder.getFilesByName(summaryFileName);
    if (summaryFiles.hasNext()) {
      summaryFiles.next().setContent(summaryText);
    } else {
      var sFile = reportFolder.createFile(summaryFileName, summaryText, MimeType.PLAIN_TEXT);
      try { sFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(_) {}
    }

    // 3. Save Structured Raw Data JSON File
    var jsonFileName = 'Data_' + reportId + '.json';
    var jsonContent = JSON.stringify(report, null, 2);
    var jsonFiles = reportFolder.getFilesByName(jsonFileName);
    if (jsonFiles.hasNext()) {
      jsonFiles.next().setContent(jsonContent);
    } else {
      var jFile = reportFolder.createFile(jsonFileName, jsonContent, MimeType.PLAIN_TEXT);
      try { jFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(_) {}
    }

    return createJsonResponse({
      success: true,
      reportFolderId: reportFolderId,
      photoCount: uploadedPhotoCount,
      updatedReport: report,
      folderUrl: 'https://drive.google.com/drive/folders/' + reportFolderId,
      message: 'Successfully archived report and ' + uploadedPhotoCount + ' photo(s) to ' + imoOffice + ' Google Drive folder.'
    });

  } catch (err) {
    Logger.log('doPost Error: ' + err);
    return createJsonResponse({
      success: false,
      error: err.toString(),
      message: 'Apps Script upload failed: ' + err.message
    });
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'getReports' || action === 'listReports') {
    return handleGetReports(e.parameter.imo);
  }
  return createJsonResponse({
    status: 'online',
    service: 'NIA Region IV-B O&M GIS Drive Relay',
    timestamp: new Date().toISOString()
  });
}

function handleGetReports(requestedImo) {
  try {
    var results = [];
    var foldersToScan = [];

    if (requestedImo && requestedImo !== 'All IMOs' && requestedImo !== 'Regional Office IV-B') {
      var folder = getDesignatedFolder(requestedImo);
      if (folder) {
        foldersToScan.push({ imo: requestedImo, folder: folder });
      }
    } else {
      var keys = ['MOMARO', 'Occidental Mindoro', 'Palawan'];
      for (var k = 0; k < keys.length; k++) {
        try {
          var fId = IMO_FOLDERS[keys[k]];
          var fol = DriveApp.getFolderById(fId);
          if (fol) {
            foldersToScan.push({ imo: keys[k], folder: fol });
          }
        } catch (_) {}
      }
    }

    for (var i = 0; i < foldersToScan.length; i++) {
      var item = foldersToScan[i];
      scanFolderForReports(item.folder, item.imo, results, 0);
    }

    // Deduplicate by report ID
    var reportMap = {};
    for (var r = 0; r < results.length; r++) {
      var rep = results[r];
      if (rep && rep.id) {
        if (!reportMap[rep.id]) {
          reportMap[rep.id] = rep;
        } else {
          var existingTime = new Date(reportMap[rep.id].createdAt || 0).getTime();
          var newTime = new Date(rep.createdAt || 0).getTime();
          if (newTime >= existingTime) {
            reportMap[rep.id] = rep;
          }
        }
      }
    }

    var finalReports = [];
    for (var id in reportMap) {
      finalReports.push(reportMap[id]);
    }

    return createJsonResponse({
      success: true,
      count: finalReports.length,
      reports: finalReports
    });
  } catch (err) {
    Logger.log('handleGetReports error: ' + err);
    return createJsonResponse({
      success: false,
      error: err.toString(),
      reports: []
    });
  }
}

function scanFolderForReports(parentFolder, imoName, results, depth) {
  if (depth > 2) return;

  var subfolders = parentFolder.getFolders();
  while (subfolders.hasNext()) {
    var sub = subfolders.next();
    var folderName = sub.getName();
    var lower = folderName.toLowerCase();

    // Skip trash/dev/mock
    if (lower.indexOf('mock-') === 0 || lower === 'mock' || lower === '__test__') continue;

    var files = sub.getFiles();
    var jsonFile = null;
    var summaryFile = null;
    var imageFiles = [];

    while (files.hasNext()) {
      var file = files.next();
      var fName = file.getName();
      var mime = file.getMimeType();
      if (fName.indexOf('Data_') === 0 && fName.indexOf('.json') !== -1) {
        jsonFile = file;
      } else if (fName.indexOf('Summary_') === 0 && fName.indexOf('.txt') !== -1) {
        summaryFile = file;
      } else if (mime.indexOf('image/') === 0 || /\.(jpe?g|png|webp|heic)$/i.test(fName)) {
        imageFiles.push({
          id: file.getId(),
          name: fName,
          url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200',
          thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600'
        });
      }
    }

    if (jsonFile) {
      try {
        var content = jsonFile.getBlob().getDataAsString();
        var report = JSON.parse(content);
        if (report && report.id) {
          if (imageFiles.length > 0) {
            report.photos = imageFiles.map(function(img, idx) {
              var stage = 'During';
              var lName = img.name.toLowerCase();
              if (lName.indexOf('before') !== -1) stage = 'Before';
              else if (lName.indexOf('after') !== -1) stage = 'After';
              return {
                id: img.id,
                driveFileId: img.id,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                stage: stage,
                caption: stage + ' Activity Documentation #' + (idx + 1),
                lat: report.lat,
                lng: report.lng
              };
            });
            report.photoUrl = report.photos[0] ? report.photos[0].url : report.photoUrl;
          }
          report.driveFolderId = sub.getId();
          report.synced = true;
          report.imoOffice = report.imoOffice || imoName;
          results.push(report);
          continue;
        }
      } catch (err) {
        Logger.log('Error parsing ' + jsonFile.getName() + ': ' + err);
      }
    }

    if (summaryFile) {
      try {
        var sumText = summaryFile.getBlob().getDataAsString();
        var sReport = parseSummaryToReportGas(sumText, folderName, imageFiles, imoName, sub.getId());
        if (sReport && sReport.id) {
          results.push(sReport);
          continue;
        }
      } catch (sumErr) {
        Logger.log('Error parsing ' + summaryFile.getName() + ': ' + sumErr);
      }
    }

    // Recurse into subfolders (e.g. week folders or category folders)
    scanFolderForReports(sub, imoName, results, depth + 1);
  }
}

function parseSummaryToReportGas(text, folderName, imageFiles, imoName, folderId) {
  var lines = text.split('\n');
  function getVal(prefix) {
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
        var parts = l.split(':');
        if (parts.length >= 2) {
          var val = parts.slice(1).join(':').trim();
          return (val === 'N/A' || val === 'Pending') ? undefined : val;
        }
      }
    }
    return undefined;
  }

  var extractedId = folderName.indexOf('Report_') === 0
    ? folderName.replace(/^Report_/, '').split('_')[0]
    : folderName.split('_')[0];
  var id = getVal('Report ID:') || extractedId || ('rep-' + new Date().getTime());
  var title = getVal('Report Title:') || folderName;

  var photos = imageFiles.map(function(img, idx) {
    var stage = 'During';
    var lName = img.name.toLowerCase();
    if (lName.indexOf('before') !== -1) stage = 'Before';
    else if (lName.indexOf('after') !== -1) stage = 'After';
    return {
      id: img.id,
      driveFileId: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      stage: stage,
      caption: stage + ' Activity Documentation #' + (idx + 1)
    };
  });

  return {
    id: id,
    title: title,
    categoryMode: (getVal('Report Category:') || '').toLowerCase().indexOf('oper') !== -1 ? 'operational' : 'maintenance',
    imoOffice: getVal('IMO Office:') || imoName,
    nisBinding: getVal('NIS Binding:'),
    status: getVal('Status:') || 'Completed',
    approvalStatus: getVal('Approval Status:') || 'Pending_PreApproval',
    createdAt: getVal('Created At:') || new Date().toISOString(),
    locationName: getVal('Location Name:'),
    canalSegment: getVal('Canal Segment:'),
    parcelId: getVal('Parcel ID:'),
    lat: parseFloat(getVal('Latitude (GPS):') || '0') || undefined,
    lng: parseFloat(getVal('Longitude (GPS):') || '0') || undefined,
    maintenanceActivity: getVal('Maintenance Activity:'),
    photos: photos,
    photoUrl: photos[0] ? photos[0].url : undefined,
    driveFolderId: folderId,
    synced: true
  };
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateSummaryText(report, imoOffice) {
  return [
    '===================================================================',
    'NATIONAL IRRIGATION ADMINISTRATION (NIA) REGION IV-B',
    'O&M FIELD MAINTENANCE & OPERATIONAL REPORT',
    '===================================================================',
    'Report ID:         ' + (report.id || 'N/A'),
    'Report Title:      ' + (report.title || 'N/A'),
    'Report Category:   ' + (report.categoryMode || report.reportType || 'Field Inspection'),
    'IMO Office:        ' + imoOffice,
    'NIS Binding:       ' + (report.nisBinding || 'N/A'),
    'Status:            ' + (report.status || 'Submitted'),
    'Approval Status:   ' + (report.approvalStatus || 'Pending_PreApproval'),
    'Created At:        ' + (report.createdAt || new Date().toISOString()),
    '',
    '-------------------------------------------------------------------',
    '1. LOCATION & SPATIAL DATA',
    '-------------------------------------------------------------------',
    'Location Name:     ' + (report.locationName || 'N/A'),
    'Canal Segment:     ' + (report.canalSegment || 'N/A'),
    'Parcel ID:         ' + (report.parcelId || 'N/A'),
    'Latitude (GPS):    ' + (report.lat !== undefined ? report.lat : 'N/A'),
    'Longitude (GPS):   ' + (report.lng !== undefined ? report.lng : 'N/A'),
    (report.secondLat !== undefined ? 'Second Latitude:   ' + report.secondLat + '\n' : '') +
    (report.secondLng !== undefined ? 'Second Longitude:  ' + report.secondLng + '\n' : ''),
    '-------------------------------------------------------------------',
    '2. FIELD PARTICULARS & MAINTENANCE METRICS',
    '-------------------------------------------------------------------',
    'Maintenance Activity:  ' + (report.maintenanceActivity || 'N/A'),
    'Accomplishment Dist:   ' + (report.segmentDistanceFormatted || (report.segmentDistanceMeters ? report.segmentDistanceMeters + ' m' : 'N/A')),
    'Estimated Depth:       ' + (report.depthMeters !== undefined ? report.depthMeters + ' m' : 'N/A'),
    'Estimated Width:       ' + (report.widthMeters !== undefined ? report.widthMeters + ' m' : 'N/A'),
    'Sand Pile Height (H):  ' + (report.sandPileHeightMeters !== undefined ? report.sandPileHeightMeters + ' m' : 'N/A'),
    'Painting Area:         ' + (report.paintedAreaSqm !== undefined ? report.paintedAreaSqm + ' m²' : 'N/A'),
    'Calculated Volume:     ' + (report.calculatedVolumeM3 !== undefined ? report.calculatedVolumeM3 + ' m³' : (report.desiltingVolumeM3 ? report.desiltingVolumeM3 + ' m³' : 'N/A')),
    'Completion Rate:       ' + (report.completionPercent !== undefined ? report.completionPercent + '%' : 'N/A'),
    '',
    '-------------------------------------------------------------------',
    '3. HYDROLOGICAL & OPERATIONAL VARIABLES',
    '-------------------------------------------------------------------',
    'Operational State:     ' + (report.operationalState || 'N/A'),
    'Water Level Gauge:     ' + (report.waterLevelMeters !== undefined ? report.waterLevelMeters + ' m' : 'N/A'),
    'Discharge Flow Rate:   ' + (report.dischargeFlowM3s !== undefined ? report.dischargeFlowM3s + ' m³/s' : 'N/A'),
    'Gate Opening:          ' + (report.gateOpeningCm !== undefined ? report.gateOpeningCm + ' cm' : 'N/A'),
    '',
    '-------------------------------------------------------------------',
    '4. INSPECTOR & SUBMISSION DETAILS',
    '-------------------------------------------------------------------',
    'Reporter Name:     ' + (report.reporterName || 'NIA Field Personnel'),
    'Reporter Role:     ' + (report.reporterRole || 'Field Personnel'),
    'Pre-Approved By:   ' + (report.preApprovedBy || 'Pending') + ' (' + (report.preApprovedAt || 'N/A') + ')',
    'Final Approved By: ' + (report.approvedBy || 'Pending') + ' (' + (report.approvedAt || 'N/A') + ')',
    '',
    '-------------------------------------------------------------------',
    '5. REMARKS & FIELD NOTES',
    '-------------------------------------------------------------------',
    (report.remarks || 'No additional remarks provided.'),
    '',
    '==================================================================='
  ].join('\n');
}
