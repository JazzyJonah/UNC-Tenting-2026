/**
 * Loads and interprets schedule.csv.
 *
 * CSV format:
 * Time,Alex,Cole,...,Vincent
 * 1/18/2026 12:00:00,FALSE,TRUE,...
 *
 * Interpretation:
 * - Each row is a timestamp.
 * - For each person, TRUE means they are “on” starting at that row time
 *   until the next row time (irregular spacing allowed).
 * - We convert TRUE runs into shifts: [start, end).
 */

import { SCHEDULE_CSV_PATH, DAYS_PER_WEEK } from "./config.js";

function parseLocalTimeToDate(timeStr) {
  if (!timeStr || typeof timeStr !== "string") {
    return null;
  }

  const trimmed = timeStr.trim();
  if (!trimmed) {
    return null;
  }

  const [datePart, timePart] = trimmed.split(" ");
  if (!datePart || !timePart) {
    return null;
  }

  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  if (
    [month, day, year, hour, minute].some((n) => Number.isNaN(n))
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute);
}



export async function loadScheduleCSV() {
  const res = await fetch(SCHEDULE_CSV_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${SCHEDULE_CSV_PATH}: ${res.status}`);
  const text = await res.text();

  const parsed = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    console.warn("CSV parse warnings:", parsed.errors);
  }

  const rows = parsed.data;
  if (!rows.length) throw new Error("schedule.csv appears empty.");

  // Determine people from headers (all columns except Time)
  const headers = Object.keys(rows[0]);
  const people = headers.filter((h) => h && h.trim() !== "Time");

  // Convert to timeline array with sorted time
  const timeline = rows
    .map((r) => {
      const t = parseLocalTimeToDate(r.Time);

      if (!t) {
        console.warn("Skipping row with invalid Time:", r);
        return null;
      }
      if (isNaN(t.getTime())) {
        console.error("Invalid date parsed from CSV:", r.Time);
      }

      const flags = {};
      for (const p of people) {
        const v = String(r[p] ?? "").trim().toUpperCase();
        flags[p] = v === "TRUE";
      }
      return { time: t, flags };
    })
    .sort((a, b) => a.time - b.time);

  return { people, timeline };
}

export function buildShiftsForPerson(timeline, person) {
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

    // Shift ends when it becomes FALSE at the next row OR we reach last segment
    const nextIsOn = !!next.flags[person];
    if (inShift && !nextIsOn) {
      shifts.push({
        person,
        start: start,
        end: next.time,
      });
      inShift = false;
      start = null;
    }
  }

  // If it ends still "on", close at last known time (best-effort)
  if (inShift) {
    shifts.push({
      person,
      start,
      end: timeline[timeline.length - 1].time,
    });
  }

  return shifts;
}

export function getWeekBounds(anchorDate, weekIndex) {
  const start = new Date(anchorDate);
  start.setDate(start.getDate() + weekIndex * DAYS_PER_WEEK);

  const end = new Date(start);
  end.setDate(end.getDate() + DAYS_PER_WEEK);

  return { start, end };
}

export function filterShiftsInRange(shifts, rangeStart, rangeEnd) {
  return shifts.filter((s) => s.end > rangeStart && s.start < rangeEnd);
}

export function formatDateTime(dt) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
}

export function formatDate(dt) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dt);
}

export function shiftId(person, startISO) {
  return `${person}__${startISO}`;
}
