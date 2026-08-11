
(function () {
  "use strict";
  const { $, $$, escapeHTML, formatDate, toast } = HMSApp;

  function row(student) {
    return `<tr>
      <td><strong>${escapeHTML(student.rollNumber ?? "—")}</strong></td>
      <td><div class="student-cell"><span class="mini-avatar">${escapeHTML(student.name.slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(student.name)}</strong><small>${escapeHTML(student.permanentId)}</small></div></div></td>
      <td>${escapeHTML(student.guardian)}</td>
      <td>${escapeHTML(student.village)}</td>
      <td>${escapeHTML(student.mobile || "—")}</td>
      <td>${student.status === "active"
        ? (() => { const a = HMSStorage.currentAttendanceStatus(student.permanentId); return `<span class="badge ${a === "absent" ? "red" : "green"}">${a === "absent" ? "On Leave" : "Present"}</span>`; })()
        : `<span class="badge gray">Left</span>`}</td>
      <td><button class="table-action" data-view="${escapeHTML(student.permanentId)}">View</button></td>
    </tr>`;
  }

  function renderStudents(list = HMSStorage.searchStudents("")) {
    const body = $("#studentsTableBody");
    if (!body) return;

    // Always display active students in current roll-number order.
    // Left/former students keep their historical record but are not part
    // of the active roll-number sequence.
    list = [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const ar = Number(a.rollNumber);
      const br = Number(b.rollNumber);
      if (Number.isFinite(ar) && Number.isFinite(br)) return ar - br;
      if (Number.isFinite(ar)) return -1;
      if (Number.isFinite(br)) return 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    body.innerHTML = list.length ? list.map(row).join("") :
      `<tr><td colspan="7" class="empty-cell">No students found.</td></tr>`;
    $$(".table-action", body).forEach(btn => btn.addEventListener("click", () => showStudent(btn.dataset.view)));
    const active = HMSStorage.activeStudents();
    if ($("#currentStudentCount")) $("#currentStudentCount").textContent = active.length;
    if ($("#nextRollPreview")) $("#nextRollPreview").textContent = HMSStorage.nextRoll();
  }

  function showStudent(id) {
    const s = HMSStorage.findById(id);
    if (!s) return;
    const payments = HMSStorage.feesFor(id).reduce((a,p)=>a+Number(p.amount||0),0);
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `<div class="modal">
      <div class="modal-head"><div><span class="eyebrow">Permanent Student ID</span><h2>${escapeHTML(s.permanentId)}</h2></div><button class="modal-close">×</button></div>
      <div class="profile-grid">
        <div><span>Name</span><strong>${escapeHTML(s.name)}</strong></div>
        <div><span>Current Roll</span><strong>${escapeHTML(s.rollNumber ?? "—")}</strong></div>
        <div><span>Guardian</span><strong>${escapeHTML(s.guardian)}</strong></div>
        <div><span>Village / City</span><strong>${escapeHTML(s.village)}</strong></div>
        <div><span>Mobile</span><strong>${escapeHTML(s.mobile || "—")}</strong></div>
        <div><span>Joined</span><strong>${formatDate(s.joinedAt)}</strong></div>
        <div><span>Room / Floor</span><strong>${escapeHTML(s.roomNumber || "Not allocated")} ${s.floorNumber ? "/ Floor " + escapeHTML(s.floorNumber) : ""}</strong></div>
        <div><span>Fees Paid</span><strong>${HMSApp.money(payments)}</strong></div>
      </div>
      <div class="modal-actions">
        ${s.status==="active" ? `<button class="danger-button" id="markLeftBtn">Mark Student Left</button>` : `<button class="secondary-button" id="restoreBtn">Restore Student</button>`}
      </div>
    </div>`;
    document.body.appendChild(modal);
    $(".modal-close", modal).onclick = () => modal.remove();
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
    const left = $("#markLeftBtn", modal);
    if (left) left.onclick = () => {
      if (confirm(`Mark ${s.name} as left? Their permanent ID and history will be preserved.`)) {
        HMSStorage.markLeft(id); modal.remove(); renderStudents(); renderFormerStudents(); toast("Student marked as left. It is now available in Former Students.");
      }
    };
    const restore = $("#restoreBtn", modal);
    if (restore) restore.onclick = () => {
      HMSStorage.restoreStudent(id); modal.remove(); renderStudents(); toast("Student restored with a new available roll number.");
    };
  }

  function formerRow(student) {
    const oldRoll = student.previousRollNumber ?? student.rollNumber ?? "—";
    return `<tr>
      <td><strong>${escapeHTML(oldRoll)}</strong></td>
      <td><div class="student-cell"><span class="mini-avatar">${escapeHTML(student.name.slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(student.name)}</strong><small>${escapeHTML(student.permanentId)}</small></div></div></td>
      <td>${escapeHTML(student.guardian)}</td>
      <td>${escapeHTML(student.village)}</td>
      <td>${formatDate(student.leftAt)}</td>
      <td><span class="badge gray">Left</span></td>
      <td><button class="secondary-button former-restore" data-view="${escapeHTML(student.permanentId)}">Restore</button></td>
    </tr>`;
  }

  function renderFormerStudents() {
    const body = $("#formerStudentsTableBody");
    const count = $("#formerStudentCount");
    if (!body) return;
    const list = HMSStorage.formerStudents();
    if (count) count.textContent = list.length;
    body.innerHTML = list.length ? list.map(formerRow).join("") :
      `<tr><td colspan="7" class="empty-cell">No lefted students.</td></tr>`;

    $$(".former-restore", body).forEach(btn => btn.addEventListener("click", () => {
      const s = HMSStorage.findById(btn.dataset.view);
      if (!s) return;
      showStudent(s.permanentId);
    }));
  }

  function setupAdmission() {
    const form = $("#admissionForm");
    if (!form) return;
    const updatePreview = () => {
      if ($("#nextRollPreview")) $("#nextRollPreview").textContent = HMSStorage.nextRoll();
      if ($("#newPermanentId")) $("#newPermanentId").textContent = "Generated automatically";
    };
    updatePreview();
    form.addEventListener("submit", e => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        const s = HMSStorage.addStudent({
          name: fd.get("name"),
          guardian: fd.get("guardian"),
          village: fd.get("village"),
          mobile: fd.get("mobile")
        });
        form.reset();
        updatePreview();
        renderStudents();
        renderFormerStudents();
        toast(`${s.name} added successfully. Roll ${s.rollNumber} • ${s.permanentId}`);
      } catch (err) {
        toast(err.message || "Could not save student data.", "error");
      }
    });
  }

  function setupSearch() {
    const form = $("#studentSearchForm");
    if (!form) return;
    form.addEventListener("submit", e => {
      e.preventDefault();
      const roll = $("#searchRollNumber")?.value.trim();
      if (!roll || !Number.isInteger(Number(roll)) || Number(roll) <= 0) {
        toast("Please enter a valid roll number.", "error");
        return;
      }
      const s = HMSStorage.findByRoll(roll);
      const box = $("#searchResult");
      if (!box) return;
      if (!s) {
        box.innerHTML = `<div class="search-empty"><span>🔎</span><strong>No student found</strong><small>No active student has roll number ${escapeHTML(roll)}.</small></div>`;
        return;
      }
      box.innerHTML = `<div class="search-result">
        <div class="result-avatar">${escapeHTML(s.name.slice(0,1).toUpperCase())}</div>
        <div class="result-main"><h3>${escapeHTML(s.name)}</h3><p>Roll ${s.rollNumber} • ${escapeHTML(s.permanentId)}</p><small>${escapeHTML(s.guardian)} • ${escapeHTML(s.village)}</small></div>
        <button class="secondary-button" id="resultViewBtn">View</button>
      </div>`;
      $("#resultViewBtn").onclick = () => showStudent(s.permanentId);
    });
  }

  function setupStudentPage() {
    const search = $("#studentListSearch");
    if (search) {
      const doSearch = () => renderStudents(HMSStorage.searchStudents(search.value));
      search.addEventListener("input", doSearch);
      renderStudents();
      renderFormerStudents();
    }
  }

  function refresh() {
    renderStudents();
    renderFormerStudents();
    if ($("#nextRollPreview")) $("#nextRollPreview").textContent = HMSStorage.nextRoll();
    if ($("#currentStudentCount")) $("#currentStudentCount").textContent = HMSStorage.activeStudents().length;
  }

  window.HMSStudents = { refresh, renderStudents, renderFormerStudents, showStudent };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => {
    setupAdmission(); setupSearch(); setupStudentPage(); refresh();
  });
  else { setupAdmission(); setupSearch(); setupStudentPage(); refresh(); }
  window.addEventListener("hms:data-changed", refresh);
})();
