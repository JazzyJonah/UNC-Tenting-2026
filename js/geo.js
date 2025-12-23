/**
 * Geolocation + distance math.
 */

import { MAX_DISTANCE_METERS, TARGET_COORD } from "./config.js";

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

export async function isCloseEnoughToTarget() {
  const pos = await getCurrentPosition();
  const { latitude, longitude } = pos.coords;

  const dist = haversineMeters(latitude, longitude, TARGET_COORD.lat, TARGET_COORD.lon);
  return { ok: dist <= MAX_DISTANCE_METERS, distMeters: dist };
}
