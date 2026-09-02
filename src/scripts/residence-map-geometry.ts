export type Coordinate = [longitude: number, latitude: number];

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function assertCoordinate([longitude, latitude]: Coordinate) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new TypeError('Coordinate values must be finite numbers');
  }
}

export function haversineDistanceKm(from: Coordinate, to: Coordinate) {
  assertCoordinate(from);
  assertCoordinate(to);
  const deltaLatitude = toRadians(to[1] - from[1]);
  const deltaLongitude = toRadians(to[0] - from[0]);
  const latitudeFrom = toRadians(from[1]);
  const latitudeTo = toRadians(to[1]);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeFrom) * Math.cos(latitudeTo) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * The thresholds mirror the reference's progressively wider world view while
 * keeping the result inside MapLibre's useful globe range.
 */
export function globeFitZoomForDistance(distanceKm: number) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 12.5;
  if (distanceKm < 0.05) return 12.5;
  if (distanceKm < 0.2) return 11.5;
  if (distanceKm < 0.8) return 10.7;
  if (distanceKm < 2) return 9.8;
  if (distanceKm < 6) return 8.7;
  if (distanceKm < 20) return 7.4;
  if (distanceKm < 60) return 6.4;
  if (distanceKm < 180) return 5.3;
  if (distanceKm < 500) return 4.4;
  if (distanceKm < 1500) return 3.8;
  return 3.2;
}

export function globeFitPaddingForDistance(distanceKm: number) {
  return distanceKm < 50 ? 72 : 120;
}

export function globeFlyDuration(currentZoom: number, targetZoom: number) {
  const safeCurrentZoom = Number.isFinite(currentZoom) ? currentZoom : 1.2;
  const safeTargetZoom = Number.isFinite(targetZoom) ? targetZoom : 1.2;
  return Math.round(700 + 360 * Math.abs(safeCurrentZoom - safeTargetZoom));
}

export function shortestLongitudeFrom(fromLongitude: number, toLongitude: number) {
  if (!Number.isFinite(fromLongitude) || !Number.isFinite(toLongitude)) {
    throw new TypeError('Longitude values must be finite numbers');
  }
  const delta = ((toLongitude - fromLongitude + 540) % 360) - 180;
  return fromLongitude + delta;
}
