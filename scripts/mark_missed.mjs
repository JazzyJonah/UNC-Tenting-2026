/**
 * GitHub Action script:
 * - Reads data/schedule.csv
 * - Computes shifts for all people
 * - For any shift that has started and has no attendance record, inserts "missed"
 *
 * Requires env vars:
 *  SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: Service role key must be kept secret (GitHub Actions secret).
 */

import fs from "node:fs";
import Papa from "papaparse";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const TABLE = "attendance";

function parseLocalTimeToDate(timeStr) {
  // For CI, this parses in UTC-ish depending on runtime.
  // Using Date(timeStr) is “best effort”. If you want strict timezone, we can adjust later.
  return new Date(timeStr);
}

function buildShiftsForPerson(timeline, person) {
  const shifts = [];
  if (timeline.length < 2) return shifts;

  let inShift = false;
  let start = null;

  for (let i = 0; i < timeline.length - 1; i++) {
    const cur = timeline[i];
    const next = timeline[i + 1];

    const isOn = !!cur.flags[person];

    if (!inShift && isOn) {
      inShift = true;
      start = cur.time;
    }

    const nextIsOn = !!next.flags[person];
    if (inShift && !nextIsOn) {
      shifts.push({ person, start, end: next.time });
      inShift = false;
      start = null;
    }
  }

  if (inShift) {
    shifts.push({ person, start, end: timeline[timeline.length - 1].time });
  }

  return shifts;
}

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

async function main() {
  const csv = fs.readFileSync("data/schedule.csv", "utf8").trim();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  const headers = Object.keys(rows[0]);
  const people = headers.filter((h) => h && h.trim() !== "Time");

  const timeline = rows
    .map((r) => {
      const t = parseLocalTimeToDate(r.Time);
      const flags = {};
      for (const p of people) {
        const v = String(r[p] ?? "").trim().toUpperCase();
        flags[p] = v === "TRUE";
      }
      return { time: t, flags };
    })
    .sort((a, b) => a.time - b.time);

  const allShifts = [];
  for (const p of people) {
    allShifts.push(...buildShiftsForPerson(timeline, p));
  }

  const now = new Date();

  // Mark any started shifts as missed if absent
  const started = allShifts.filter((s) => s.start <= now);

  // Upsert in chunks
  const payload = started.map((s) => ({
    person: s.person,
    shift_start: s.start.toISOString(),
    shift_end: s.end.toISOString(),
    status: "missed",
  }));

  const chunkSize = 500;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    // Upsert uses unique index on (person, shift_start, shift_end)
    await supaFetch(`${TABLE}?on_conflict=person,shift_start,shift_end`, {
      method: "POST",
      body: JSON.stringify(chunk),
    });
  }

  console.log(`Swept ${payload.length} started shifts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});