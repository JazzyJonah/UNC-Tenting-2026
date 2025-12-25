/**
 * Supabase database helpers.
 * Stores shift attendance results in the `attendance` table.
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TABLE } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Upsert an attendance record (unique per person+shift_start+shift_end).
 */
export async function upsertAttendance({
  person,
  shiftStartISO,
  shiftEndISO,
  status,
  verifiedAtISO = null,
  overridden = false,
  overrideBy = null,
  overrideAtISO = null,
}) {
  const payload = {
    person,
    shift_start: shiftStartISO,
    shift_end: shiftEndISO,
    status,
    verified_at: verifiedAtISO,
    overridden,
    override_by: overrideBy,
    override_at: overrideAtISO,
  };

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .upsert(payload, { onConflict: "person,shift_start,shift_end" })
    .select();

  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Fetch all attendance records for a person (used to label verified/missed in UI).
 */
export async function fetchAttendanceForPerson(person) {
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("*")
    .eq("person", person);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch newest-first missed shifts (admin view).
 */
export async function fetchMissedShiftsNewestFirst(limit = 200) {
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("*")
    .eq("status", "missed")
    .order("shift_start", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Override a missed shift to verified.
 */
export async function overrideMissedToVerified({ person, shiftStartISO, shiftEndISO, adminName }) {
  const now = new Date().toISOString();

  // Update existing record (should exist as missed), but upsert for safety.
  return upsertAttendance({
    person,
    shiftStartISO,
    shiftEndISO,
    status: "verified",
    verifiedAtISO: now,
    overridden: true,
    overrideBy: adminName,
    overrideAtISO: now,
  });
}

export async function fetchLastSweepTime() {
  const { data, error } = await supabase
    .from("sweep_metadata")
    .select("last_run")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return new Date(data.last_run);
}
