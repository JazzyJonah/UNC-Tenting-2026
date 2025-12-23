/**
 * UI helpers: toasts, DOM utilities, rendering shift lists.
 */

import { formatDateTime, formatDate } from "./schedule.js";

export function showToast(message, type = "info") {
  const area = document.getElementById("toastArea");
  const el = document.createElement("div");
  el.className = `alert alert-${type} shadow-sm`;
  el.role = "alert";
  el.textContent = message;
  area.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 5000);
}

export function setVisible(id, visible) {
  const el = document.getElementById(id);
  el.classList.toggle("d-none", !visible);
}

export function setText(id, text) {
  const el = document.getElementById(id);
  el.textContent = text;
}

export function clearChildren(id) {
  const el = document.getElementById(id);
  el.innerHTML = "";
}

export function badgeForStatus(status) {
  if (status === "verified") return `<span class="badge text-bg-success">Verified</span>`;
  if (status === "missed") return `<span class="badge text-bg-danger">Missed</span>`;
  return `<span class="badge text-bg-secondary">Unrecorded</span>`;
}

export function renderShiftList({ shifts, attendanceMap }) {
  const list = document.getElementById("shiftList");
  list.innerHTML = "";

  if (!shifts.length) {
    const empty = document.createElement("div");
    empty.className = "text-muted";
    empty.textContent = "No shifts this week.";
    list.appendChild(empty);
    return;
  }

  for (const s of shifts.sort((a, b) => a.start - b.start)) {
    const key = `${s.person}__${s.start.toISOString()}__${s.end.toISOString()}`;
    const rec = attendanceMap.get(key);
    const status = rec?.status ?? "unrecorded";

    const item = document.createElement("div");
    item.className = "list-group-item shadow-sm";

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div class="fw-semibold">${formatDateTime(s.start)} → ${formatDateTime(s.end)}</div>
          <div class="text-muted small">${formatDate(s.start)}</div>
        </div>
        <div>${badgeForStatus(status)}</div>
      </div>
    `;

    list.appendChild(item);
  }
}

/**
 * Show verify buttons for shifts that are within the 15-min pre-start window.
 */
export function renderVerifyPanel({ upcomingVerifiableShifts, onVerifyClick }) {
  const panel = document.getElementById("verifyPanel");
  const list = document.getElementById("verifyList");
  list.innerHTML = "";

  if (!upcomingVerifiableShifts.length) {
    panel.classList.add("d-none");
    return;
  }

  panel.classList.remove("d-none");

  for (const s of upcomingVerifiableShifts.sort((a, b) => a.start - b.start)) {
    const btn = document.createElement("button");
    btn.className = "btn btn-warning";
    btn.innerHTML = `Verify: <b>${formatDateTime(s.start)}</b>`;

    btn.addEventListener("click", () => onVerifyClick(s));
    list.appendChild(btn);
  }
}
