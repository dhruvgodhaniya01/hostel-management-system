
(function () {
  "use strict";
  const { $, escapeHTML, money } = HMSApp;
  function render() {
    const s = HMSStorage.statistics();
    const a = HMSStorage.attendanceSummary();
    const ids = ["rTotal","rActive","rLeft","rAllocated","rUnallocated","rPaid","rAttendanceDays","rPresent","rAbsent","rLeave"];
    const vals = [s.total,s.active,s.left,s.allocated,s.unallocated,money(s.paid),a.dates,a.present,a.absent,a.leave];
    ids.forEach((id,i)=>{if($("#"+id)) $("#"+id).textContent=vals[i];});
    const body = $("#reportStudentsBody");
    if (body) {
      body.innerHTML = HMSStorage.activeStudents().sort((a,b)=>a.rollNumber-b.rollNumber).map(s=>{
        const attendance = HMSStorage.currentAttendanceStatus(s.permanentId);
        const label = attendance === "absent" ? "On Leave" : "Present";
        const cls = attendance === "absent" ? "red" : "green";
        return `<tr><td>${s.rollNumber}</td><td>${escapeHTML(s.name)}</td><td>${escapeHTML(s.permanentId)}</td><td>${escapeHTML(s.roomNumber||"—")}</td><td><span class="badge ${cls}">${label}</span></td></tr>`;
      }).join("") || `<tr><td colspan="5" class="empty-cell">No active students.</td></tr>`;
    }
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", render); else render();
  window.addEventListener("hms:data-changed", render);
})();
