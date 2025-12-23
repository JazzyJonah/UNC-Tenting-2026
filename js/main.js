/**
 * Main app controller.
 * - Loads schedule.csv
 * - “Logs in” user by name
 * - Builds shifts for that user
 * - Shows weekly view with pagination
 * - Allows verifying attendance in the 15-min pre-start window
 * - Records missed shifts once they have started (best-effort; see note below)
 */

import { ADMIN_NAME, APP_TITLE } from "./config.js";
import { getSavedName, saveName, clearName } from "./auth.js";
import {
  loadScheduleCSV,
  buildShiftsForPerson,
  getWeekBounds,
  filterShiftsInRange,
  formatDate,
} from "./schedule.js";
import { fetchAttendanceForPerson, upsertAttendance } from "./db.js";
import { isCloseEnoughToTarget } from "./geo.js";
import {
  setVisible,
  setText,
  showToast,
  renderShiftList,
  renderVerifyPanel,
} from "./ui.js";
import { renderAdminList } from "./admin.js";

document.title = APP_TITLE;

let schedule = null;
let anchorDate = null;
let weekIndex = 0;

let currentName = null;
let shiftsForUser = [];
let attendanceMap = new Map(); // key -> record

function keyFor(person, startISO, endISO) {
  return `${person}__${startISO}__${endISO}`;
}

function buildAttendanceMap(records) {
  const map = new Map();
  for (const r of records) {
    map.set(keyFor(r.person, r.shift_start, r.shift_end), r);
  }
  return map;
}

/**
 * Best-effort missed shift recording:
 * If a shift has started and there is no record, we write "missed".
 *
 * Note: A purely static site can’t run in the background. This will be triggered
 * when the user (or admin) opens the site. (Optional GitHub Action below can
 * sweep automatically.)
 */
async function recordMissedShiftsIfNeeded() {
  const now = new Date();

  const toMarkMissed = shiftsForUser.filter((s) => {
    const started = s.start <= now;
    const startISO = s.start.toISOString();
    const endISO = s.end.toISOString();
    const exists = attendanceMap.has(keyFor(s.person, startISO, endISO));
    return started && !exists;
  });

  if (!toMarkMissed.length) return;

  for (const s of toMarkMissed) {
    try {
      const startISO = s.start.toISOString();
      const endISO = s.end.toISOString();
      const rec = await upsertAttendance({
        person: s.person,
        shiftStartISO: startISO,
        shiftEndISO: endISO,
        status: "missed",
      });
      attendanceMap.set(keyFor(s.person, startISO, endISO), rec);
    } catch (e) {
      console.warn("Failed to mark missed:", e);
    }
  }
}

function computeVerifiableShifts() {
  const now = new Date();
  const fifteenMin = 15 * 60 * 1000;

  // Verifiable if: start - 15min <= now < start
  // Also: not already verified.
  return shiftsForUser.filter((s) => {
    const startISO = s.start.toISOString();
    const endISO = s.end.toISOString();
    const rec = attendanceMap.get(keyFor(s.person, startISO, endISO));
    if (rec?.status === "verified") return false;

    const msToStart = s.start.getTime() - now.getTime();
    return msToStart <= fifteenMin && msToStart > 0;
  });
}

async function onVerifyClick(shift) {
  try {
    showToast("Requesting location permission…", "info");

    const { ok, distMeters } = await isCloseEnoughToTarget();
    if (!ok) {
      showToast(`You're not close enough to Krzyzewskiville. (~${Math.round(distMeters)}m away)`, "danger");
      return;
    }

    const startISO = shift.start.toISOString();
    const endISO = shift.end.toISOString();
    const nowISO = new Date().toISOString();

    const rec = await upsertAttendance({
      person: shift.person,
      shiftStartISO: startISO,
      shiftEndISO: endISO,
      status: "verified",
      verifiedAtISO: nowISO,
    });

    attendanceMap.set(keyFor(shift.person, startISO, endISO), rec);
    showToast("Verification successful. You're checked in ✅", "success");

    await renderCurrentWeek();
  } catch (e) {
    console.error(e);
    showToast(`Verification failed: ${e.message ?? e}`, "danger");
  }
}

async function renderCurrentWeek() {
  const { start, end } = getWeekBounds(anchorDate, weekIndex);

  setText("weekLabel", `${formatDate(start)} → ${formatDate(new Date(end.getTime() - 1))}`);

  // Record missed shifts (best-effort) before rendering
  await recordMissedShiftsIfNeeded();

  // Recompute verify options
  const verifiable = computeVerifiableShifts();
  renderVerifyPanel({ upcomingVerifiableShifts: verifiable, onVerifyClick });

  const weekShifts = filterShiftsInRange(shiftsForUser, start, end);
  renderShiftList({ shifts: weekShifts, attendanceMap });
}

function wireWeekButtons() {
  document.getElementById("prevWeekBtn").addEventListener("click", async () => {
    weekIndex = Math.max(0, weekIndex - 1);
    await renderCurrentWeek();
  });

  document.getElementById("nextWeekBtn").addEventListener("click", async () => {
    weekIndex = weekIndex + 1;
    await renderCurrentWeek();
  });
}

function wireLogout() {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearName();
    location.reload();
  });
}

async function loginAs(name) {
  currentName = name.trim();
  saveName(currentName);

  document.getElementById("logoutBtn").classList.remove("d-none");
  setText("whoami", `Logged in as: ${currentName}`);

  if (currentName === ADMIN_NAME) {
    setVisible("loginSection", false);
    setVisible("userSection", false);
    setVisible("adminSection", true);
    setVisible("loadingCard", false);

    const refreshBtn = document.getElementById("refreshAdminBtn");
    refreshBtn.addEventListener("click", async () => {
      try {
        refreshBtn.disabled = true;
        await renderAdminList(currentName);
      } finally {
        refreshBtn.disabled = false;
      }
    });

    await renderAdminList(currentName);
    return;
  }

  // Validate name exists
  if (!schedule.people.includes(currentName)) {
    showToast(`Name "${currentName}" not found in schedule.csv header.`, "danger");
    clearName();
    setText("whoami", "");
    return;
  }

  // Build shifts
  shiftsForUser = buildShiftsForPerson(schedule.timeline, currentName);

  // Load attendance
  const records = await fetchAttendanceForPerson(currentName);
  attendanceMap = buildAttendanceMap(records);

  // Determine anchor date (first timestamp in CSV)
  anchorDate = new Date(schedule.timeline[0].time);

  setVisible("loginSection", false);
  setVisible("adminSection", false);
  setVisible("userSection", true);
  setVisible("loadingCard", false);

  wireWeekButtons();
  await renderCurrentWeek();

  // Update verifiable buttons every 30 seconds
  setInterval(async () => {
    try {
      await renderCurrentWeek();
    } catch {
      // quiet
    }
  }, 30000);
}

async function init() {
  try {
    wireLogout();

    schedule = await loadScheduleCSV();

    setVisible("loadingCard", false);
    setVisible("loginSection", true);

    const saved = getSavedName();
    if (saved) {
      // Auto-login if previously saved
      await loginAs(saved);
      return;
    }

    const form = document.getElementById("loginForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("nameInput").value;
      await loginAs(name);
    });
  } catch (e) {
    console.error(e);
    showToast(`Startup error: ${e.message ?? e}`, "danger");
    setVisible("loadingCard", false);
    setVisible("loginSection", true);
  }
}

init();
