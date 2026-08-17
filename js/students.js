(function () {
  "use strict";
  const { $, $$, escapeHTML, formatDate, toast } = HMSApp;

  function row(student) {
    return `<tr>
      <td><strong>${escapeHTML(student.rollNumber ?? "—")}</strong></td>
      <td><div class="student-cell"><span class="mini-avatar">${escapeHTML((student.name || "?").slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(student.name)}</strong><small>${escapeHTML(student.permanentId)}</small></div></div></td>
      <td>${escapeHTML(student.village)}</td>
      <td>${escapeHTML(student.mobile || "—")}</td>
      <td>${escapeHTML(student.parentMobile || "—")}</td>
      <td>${escapeHTML(student.caste || "—")}</td>
      <td>${student.status === "active"
        ? (() => {
            const expired = HMSStorage.isFeeExpired(student);
            return `<div><strong>${formatDate(student.feesEndDate)}</strong><small class="table-sub"><span class="badge ${expired ? "red" : "green"}">${expired ? "Expired" : "Active"}</span></small></div>`;
          })()
        : "—"}</td>
      <td>${student.status === "active"
        ? (() => { const a = HMSStorage.currentAttendanceStatus(student.permanentId); return `<span class="badge ${a === "absent" ? "red" : "green"}">${a === "absent" ? "On Leave" : "Present"}</span>`; })()
        : `<span class="badge gray">Left</span>`}</td>
      <td><button class="table-action" data-view="${escapeHTML(student.permanentId)}">View</button></td>
    </tr>`;
  }

  function renderStudents(list = HMSStorage.searchStudents("")) {
    const body = $("#studentsTableBody");
    if (!body) return;
    list = [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const ar = Number(a.rollNumber), br = Number(b.rollNumber);
      if (Number.isFinite(ar) && Number.isFinite(br)) return ar - br;
      if (Number.isFinite(ar)) return -1;
      if (Number.isFinite(br)) return 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    body.innerHTML = list.length ? list.map(row).join("") :
      `<tr><td colspan="9" class="empty-cell">No students found.</td></tr>`;
    $$(".table-action", body).forEach(btn => btn.addEventListener("click", () => showStudent(btn.dataset.view)));
    if ($("#currentStudentCount")) $("#currentStudentCount").textContent = HMSStorage.activeStudents().length;
    if ($("#nextRollPreview")) $("#nextRollPreview").textContent = HMSStorage.nextRoll();
  }

  function showStudent(id) {
    const s = HMSStorage.findById(id);
    if (!s) return;

    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    const rooms = HMSStorage.roomList();
    const attendance = HMSStorage.currentAttendanceStatus(id);
    const payments = HMSStorage.feesFor(id).reduce((a,p)=>a+Number(p.amount||0),0);
    const isActive = s.status === "active";

    modal.innerHTML = `<div class="modal student-edit-modal">
      <div class="modal-head">
        <div><span class="eyebrow">Student Management</span><h2>Edit Student</h2><small>${escapeHTML(s.permanentId)}</small></div>
        <button class="modal-close" type="button">×</button>
      </div>

      <form id="studentEditForm">
        <div class="profile-grid">
          <div class="field"><label>Full Name</label><input name="name" value="${escapeHTML(s.name)}" required></div>
          <div class="field"><label>Village / City</label><input name="village" value="${escapeHTML(s.village)}" required></div>
          <div class="field"><label>Student Mobile</label><input name="mobile" inputmode="numeric" maxlength="10" value="${escapeHTML(s.mobile||"")}" required></div>
          <div class="field"><label>Parent Mobile</label><input name="parentMobile" inputmode="numeric" maxlength="10" value="${escapeHTML(s.parentMobile||"")}" required></div>
          <div class="field"><label>Caste</label><input name="caste" value="${escapeHTML(s.caste||"")}" required></div>
          <div class="field"><label>Admission Date</label><input name="admissionDate" type="date" value="${escapeHTML(s.admissionDate||"")}"></div>
          <div class="field"><label>Fees Starting Date</label><input id="editFeesStart" name="feesStartDate" type="date" value="${escapeHTML(s.feesStartDate||"")}"></div>
          <div class="field"><label>Fee Duration (Months)</label><input id="editFeeDuration" name="feeDurationMonths" type="number" min="1" max="60" value="${escapeHTML(s.feeDurationMonths||6)}"></div>
          <div class="field"><label>Fees Ending Date</label><input id="editFeesEnd" name="feesEndDate" type="date" value="${escapeHTML(s.feesEndDate||"")}"></div>
          <div class="field"><label>Room</label><select name="roomNumber" id="editRoom"><option value="">Not allocated</option>${rooms.map(r=>`<option value="${escapeHTML(r.number)}" data-floor="${escapeHTML(r.floor)}" ${String(s.roomNumber||"")===String(r.number)?"selected":""}>Room ${escapeHTML(r.number)}${r.floor?` — Floor ${escapeHTML(r.floor)}`:""}</option>`).join("")}</select></div>
          <div class="field"><label>Floor</label><input name="floorNumber" id="editFloor" value="${escapeHTML(s.floorNumber||"")}" readonly></div>
          <div class="field"><label>Attendance</label><select id="editAttendance"><option value="present" ${attendance==="present"?"selected":""}>Present</option><option value="absent" ${attendance==="absent"?"selected":""}>Absent</option></select></div>
        </div>
        <div class="field page-gap"><label>Notes</label><textarea name="notes" rows="3" placeholder="Optional student notes">${escapeHTML(s.notes||"")}</textarea></div>
        <div class="edit-summary">
          <span><strong>Roll:</strong> ${escapeHTML(s.rollNumber ?? "—")}</span>
          <span><strong>Fee paid:</strong> ${HMSApp.money(payments)}</span>
          <span><strong>Room:</strong> ${escapeHTML(s.roomNumber||"Not allocated")}</span>
        </div>
        <div class="modal-actions">
          <button class="primary-button" type="submit">Save All Changes</button>
          <button class="secondary-button" type="button" id="openFeesBtn">Open Fees</button>
          <button class="secondary-button" type="button" id="openAttendanceBtn">Open Attendance</button>
          ${isActive ? `<button class="danger-button" type="button" id="leaveStudentBtn">Leave Student</button>` : `<button class="secondary-button" type="button" id="restoreStudentBtn">Restore Student</button>`}
          <button class="danger-button" type="button" id="deleteStudentBtn">Delete Student</button>
        </div>
      </form>
    </div>`;

    document.body.appendChild(modal);
    const close=()=>modal.remove();
    $(".modal-close",modal).onclick=close;
    modal.addEventListener("click",e=>{if(e.target===modal)close();});

    const room=$("#editRoom",modal), floor=$("#editFloor",modal);
    room?.addEventListener("change",()=>{
      const opt=room.options[room.selectedIndex];
      if(floor)floor.value=opt?.dataset.floor||"";
    });

    function calcEditEnd(){
      const start=$("#editFeesStart",modal), dur=$("#editFeeDuration",modal), end=$("#editFeesEnd",modal);
      if(!start||!dur||!end||!start.value)return;
      const [y,m,d]=start.value.split("-").map(Number), months=Number(dur.value);
      if(!Number.isInteger(months)||months<1)return;
      const target=new Date(y,m-1+months,1), last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
      end.value=`${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(Math.min(d,last)).padStart(2,"0")}`;
    }
    $("#editFeesStart",modal)?.addEventListener("change",calcEditEnd);
    $("#editFeeDuration",modal)?.addEventListener("input",calcEditEnd);

    $("#studentEditForm",modal).addEventListener("submit",e=>{
      e.preventDefault();
      try{
        const fd=new FormData(e.target);
        const patch={name:fd.get("name"),village:fd.get("village"),mobile:fd.get("mobile"),parentMobile:fd.get("parentMobile"),caste:fd.get("caste"),admissionDate:fd.get("admissionDate"),feesStartDate:fd.get("feesStartDate"),feeDurationMonths:Number(fd.get("feeDurationMonths")),feesEndDate:fd.get("feesEndDate"),notes:fd.get("notes")};
        HMSStorage.updateStudent(id,patch);
        const chosenRoom=fd.get("roomNumber");
        if(chosenRoom && chosenRoom!==String(s.roomNumber||"")) HMSStorage.allocateRoom(id,chosenRoom,fd.get("floorNumber"));
        else if(!chosenRoom && s.roomNumber) HMSStorage.unallocateRoom(id);
        const record={...HMSStorage.attendanceFor(),[id]:$("#editAttendance",modal).value};
        HMSStorage.saveAttendance(new Date().toISOString().slice(0,10),record);
        close();renderStudents();renderFormerStudents();toast("Student data, room, fee period and attendance updated.");
      }catch(err){toast(err.message||"Could not update student.","error");}
    });

    $("#openFeesBtn",modal)?.addEventListener("click",()=>{ location.href=`fees.html?student=${encodeURIComponent(id)}`; });
    $("#openAttendanceBtn",modal)?.addEventListener("click",()=>{ location.href=`attendance.html?student=${encodeURIComponent(id)}`; });

    $("#leaveStudentBtn",modal)?.addEventListener("click",()=>{
      if(confirm(`Move ${s.name} to Former / Lefted Students? Their history will be preserved.`)){
        HMSStorage.markLeft(id);close();renderStudents();renderFormerStudents();toast("Student moved to Former / Lefted Students.");
      }
    });
    $("#restoreStudentBtn",modal)?.addEventListener("click",()=>{
      try{HMSStorage.restoreStudent(id);close();renderStudents();renderFormerStudents();toast("Student restored successfully.");}
      catch(err){toast(err.message,"error");}
    });
    $("#deleteStudentBtn",modal)?.addEventListener("click",()=>{
      if(confirm(`Permanently delete ${s.name} and all student records from this device? This cannot be undone unless you have a backup.`)){
        HMSStorage.deleteStudent(id);close();renderStudents();renderFormerStudents();toast("Student permanently deleted.","error");
      }
    });
  }

  function formerRow(student) {
    const oldRoll = student.previousRollNumber ?? student.rollNumber ?? "—";
    return `<tr>
      <td><strong>${escapeHTML(oldRoll)}</strong></td>
      <td><div class="student-cell"><span class="mini-avatar">${escapeHTML((student.name || "?").slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(student.name)}</strong><small>${escapeHTML(student.permanentId)}</small></div></div></td>
      <td>${escapeHTML(student.village)}</td>
      <td>${escapeHTML(student.mobile || "—")}</td>
      <td>${escapeHTML(student.parentMobile || "—")}</td>
      <td>${escapeHTML(student.caste || "—")}</td>
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
      `<tr><td colspan="9" class="empty-cell">No lefted students.</td></tr>`;
    $$(".former-restore", body).forEach(btn => btn.addEventListener("click", () => {
      const s = HMSStorage.findById(btn.dataset.view);
      if (s) showStudent(s.permanentId);
    }));
  }

  function setupAdmission() {
    const form = $("#admissionForm");
    if (!form) return;

    const today = new Date().toISOString().slice(0,10);
    const admissionDate = $("#admissionDate");
    const feesStartDate = $("#feesStartDate");
    const duration = $("#feeDurationMonths");
    const endDate = $("#feesEndDate");
    const casteSelect = $("#casteSelect");
    const customCasteField = $("#customCasteField");
    const customCaste = $("#customCaste");

    if (admissionDate && !admissionDate.value) admissionDate.value = today;
    if (feesStartDate && !feesStartDate.value) feesStartDate.value = today;
    if (duration) duration.value = HMSStorage.getDefaultFeeDurationMonths();

    function syncCaste() {
      const custom = casteSelect?.value === "__custom__";
      if (customCasteField) customCasteField.style.display = custom ? "" : "none";
      if (customCaste) {
        customCaste.required = custom;
        if (!custom) customCaste.value = "";
      }
    }

    function syncEndDate() {
      if (!feesStartDate || !duration || !endDate) return;
      const start = feesStartDate.value;
      const months = Number(duration.value);
      endDate.value = HMSStorage.calculateFeeEndDate(start, months);
    }

    casteSelect?.addEventListener("change", syncCaste);
    feesStartDate?.addEventListener("change", syncEndDate);
    duration?.addEventListener("input", syncEndDate);
    syncCaste();
    syncEndDate();

    const updatePreview = () => {
      if ($("#nextRollPreview")) $("#nextRollPreview").textContent = HMSStorage.nextRoll();
      if ($("#newPermanentId")) $("#newPermanentId").textContent = "Generated automatically";
    };
    updatePreview();

    form.addEventListener("submit", e => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        const casteValue = fd.get("caste");
        const s = HMSStorage.addStudent({
          name: fd.get("name"),
          village: fd.get("village"),
          mobile: fd.get("mobile"),
          parentMobile: fd.get("parentMobile"),
          caste: casteValue,
          customCaste: fd.get("customCaste"),
          admissionDate: fd.get("admissionDate"),
          feesStartDate: fd.get("feesStartDate"),
          feeDurationMonths: fd.get("feeDurationMonths"),
          feesEndDate: fd.get("feesEndDate")
        });
        form.reset();
        if (admissionDate) admissionDate.value = today;
        if (feesStartDate) feesStartDate.value = today;
        if (duration) duration.value = HMSStorage.getDefaultFeeDurationMonths();
        if (casteSelect) casteSelect.value = "Maher";
        syncCaste();
        syncEndDate();
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
        <div class="result-avatar">${escapeHTML((s.name || "?").slice(0,1).toUpperCase())}</div>
        <div class="result-main"><h3>${escapeHTML(s.name)}</h3><p>Roll ${s.rollNumber} • ${escapeHTML(s.permanentId)}</p><small>${escapeHTML(s.village)} • ${escapeHTML(s.caste || "—")}</small></div>
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
