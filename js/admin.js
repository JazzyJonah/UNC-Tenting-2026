/**
 * Admin panel rendering and behavior.
 */

import { fetchMissedShiftsNewestFirst, overrideMissedToVerified } from "./db.js";
import { formatDateTime } from "./schedule.js";
import { clearChildren, showToast } from "./ui.js";

export async function renderAdminList(adminName) {
  clearChildren("adminList");

  const list = document.getElementById("adminList");
  const missed = await fetchMissedShiftsNewestFirst(300);

  if (!missed.length) {
    const el = document.createElement("div");
    el.className = "text-muted";
    el.textContent = "No missed shifts recorded.";
    list.appendChild(el);
    return;
  }

  for (const rec of missed) {
    const item = document.createElement("div");
    item.className = "list-group-item shadow-sm";

    const start = new Date(rec.shift_start);
    const end = new Date(rec.shift_end);

    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div class="fw-semibold">${rec.person}</div>
          <div class="text-muted small">${formatDateTime(start)} → ${formatDateTime(end)}</div>
          ${
            rec.overridden
              ? `<div class="small text-success mt-1">Overridden by ${rec.override_by ?? "admin"}</div>`
              : ""
          }
        </div>
        <div class="d-flex flex-column gap-2 align-items-end">
          <span class="badge text-bg-danger">Missed</span>
          <button class="btn btn-sm btn-outline-success">Override → Verified</button>
        </div>
      </div>
    `;

    const btn = item.querySelector("button");
    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        await overrideMissedToVerified({
          shiftId: rec.shift_id,
          person: rec.person,
          shiftStartISO: rec.shift_start,
          shiftEndISO: rec.shift_end,
          adminName,
        });
        showToast(`Overrode ${rec.person} shift to verified.`, "success");
        await renderAdminList(adminName);
      } catch (e) {
        console.error(e);
        showToast(`Override failed: ${e.message ?? e}`, "danger");
        btn.disabled = false;
      }
    });

    list.appendChild(item);
  }
}
