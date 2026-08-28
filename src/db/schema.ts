import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  role: text('role').default('Viewer'),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const fieldReports = pgTable('field_reports', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  reportType: text('report_type').notNull(),
  categoryMode: text('category_mode'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  secondLat: doublePrecision('second_lat'),
  secondLng: doublePrecision('second_lng'),
  locationName: text('location_name'),
  pathCoords: jsonb('path_coords'),
  canalSegment: text('canal_segment'),
  parcelId: text('parcel_id'),
  structureName: text('structure_name'),
  maintenanceActivity: text('maintenance_activity'),
  operationalState: text('operational_state'),
  waterLevelMeters: doublePrecision('water_level_meters'),
  dischargeFlowM3s: doublePrecision('discharge_flow_m3s'),
  gateOpeningCm: doublePrecision('gate_opening_cm'),
  waterQuality: text('water_quality'),
  beneficiaryServiceArea: text('beneficiary_service_area'),
  operationalIncident: text('operational_incident'),
  status: text('status').notNull().default('In Progress'),
  remarks: text('remarks'),
  reporterName: text('reporter_name'),
  reporterRole: text('reporter_role'),
  createdAt: text('created_at'),
  synced: boolean('synced').default(true),
  photoUrl: text('photo_url'),
  photos: jsonb('photos'),
  completionPercent: doublePrecision('completion_percent'),
  desiltingVolumeM3: doublePrecision('desilting_volume_m3'),
  hazardSeverity: text('hazard_severity'),
  userId: text('user_id').references(() => users.uid),
});

export const gisLayers = pgTable('gis_layers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  visible: boolean('visible').default(true),
  color: text('color').default('#3b82f6'),
  opacity: doublePrecision('opacity').default(0.8),
  data: jsonb('data'),
  featureCount: integer('feature_count').default(0),
  geometryType: text('geometry_type').default('Mixed'),
  sizeBytes: integer('size_bytes'),
  uploadedAt: text('uploaded_at'),
  isDefault: boolean('is_default').default(false),
  userId: text('user_id').references(() => users.uid),
});

export const usersRelations = relations(users, ({ many }) => ({
  fieldReports: many(fieldReports),
  gisLayers: many(gisLayers),
}));

export const fieldReportsRelations = relations(fieldReports, ({ one }) => ({
  user: one(users, {
    fields: [fieldReports.userId],
    references: [users.uid],
  }),
}));

export const gisLayersRelations = relations(gisLayers, ({ one }) => ({
  user: one(users, {
    fields: [gisLayers.userId],
    references: [users.uid],
  }),
}));
