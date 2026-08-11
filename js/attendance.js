
(function () {
  "use strict";
  const { $, escapeHTML, toast } = HMSApp;
  function today() { return new Date().toISOString().slice(0,10); }

  function render() {
    const body = $("#attendanceBody"), date = $("#attendanceDate")?.value || today();
    if (!body) return;
    const records = HMSStorage.attendanceFor(date);
    const students = HMSStorage.activeStudents().sort((a,b)=>a.rollNumber-b.rollNumber);
    body.innerHTML = students.length ? students.map(s => {
      const state = records[s.permanentId] || "present";
      return `<tr><td><strong>${s.rollNumber}</strong></td><td>${escapeHTML(s.name)}<small class="subline">${escapeHTML(s.permanentId)}</small></td>
      <td><select class="attendance-select" data-id="${escapeHTML(s.permanentId)}">
        <option value="present" ${state==="present"?"selected":""}>Present</option>
        <option value="absent" ${state==="absent"?"selected":""}>Absent</option>
      </select></td></tr>`;
    }).join("") : `<tr><td colspan="3" class="empty-cell">No active students.</td></tr>`;
    if ($("#attendanceCount")) $("#attendanceCount").textContent = students.length;
  }

  function setup() {
    const d = $("#attendanceDate");
    if (d) { d.value = today(); d.addEventListener("change", render); }
    const save = $("#saveAttendanceBtn");
    if (save) save.onclick = () => {
      const date = d.value || today();
      const records = {};
      document.querySelectorAll(".attendance-select").forEach(x => records[x.dataset.id] = x.value);
      HMSStorage.saveAttendance(date, records);
      render();
      toast("Attendance saved. Current attendance updated.");
    };
    const allPresent = $("#markAllPresent");
    if (allPresent) allPresent.onclick = () => document.querySelectorAll(".attendance-select").forEach(x => x.value = "present");
    render();
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", setup); else setup();
  window.addEventListener("hms:data-changed", render);
})();
