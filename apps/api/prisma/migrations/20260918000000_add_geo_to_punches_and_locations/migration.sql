-- Add geofence config to locations
ALTER TABLE "locations" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "locations" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "locations" ADD COLUMN "radius_meters" INTEGER NOT NULL DEFAULT 200;

-- Add recorded coordinates to time_punches
ALTER TABLE "time_punches" ADD COLUMN "punch_in_lat" DOUBLE PRECISION;
ALTER TABLE "time_punches" ADD COLUMN "punch_in_lng" DOUBLE PRECISION;
ALTER TABLE "time_punches" ADD COLUMN "punch_out_lat" DOUBLE PRECISION;
ALTER TABLE "time_punches" ADD COLUMN "punch_out_lng" DOUBLE PRECISION;
