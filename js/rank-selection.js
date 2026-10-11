(function () {
  "use strict";
  const KEY = "hms_rank_selection_v1";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
  if (!db || !Array.isArray(db.applicants)) db = { cutoff: "", applicants: [] };

  function toast(msg, error = false) {
    const c = $("#toastContainer"), d = document.createElement("div");
    d.className = "toast " + (error ? "error" : "success"); d.textContent = msg; c.appendChild(d);
    setTimeout(() => d.remove(), 3000);
  }
  function eligible(a) { return db.cutoff !== "" && Number(a.rank) <= Number(db.cutoff); }
  function selected() { return db.applicants.filter(a => a.status === "selected").sort((a,b) => a.rank-b.rank || a.name.localeCompare(b.name)); }
  function waiting() { return db.applicants.filter(a => a.status === "waiting").sort((a,b) => a.rank-b.rank || a.name.localeCompare(b.name)); }
  function approved() { return db.applicants.filter(a => a.status === "approved").sort((a,b) => a.rank-b.rank || a.name.localeCompare(b.name)); }
  function refreshSelection() {
    db.applicants.forEach(a => {
      if (a.status === "selected" && !eligible(a) && !a.manualOverride) a.status = "waiting";
      else if (a.status === "waiting" && eligible(a) && (a.heldAtCutoff === undefined || String(a.heldAtCutoff) !== String(db.cutoff))) {
        a.status = "selected"; a.manualOverride = false; delete a.heldAtCutoff;
      }
    });
  }
  function save() { refreshSelection(); localStorage.setItem(KEY, JSON.stringify(db)); render(); }
  function render() {
    refreshSelection(); localStorage.setItem(KEY, JSON.stringify(db));
    const sel = selected(), wait = waiting(), ap = approved();
    $("#waitingCount").textContent = wait.length; $("#eligibleCount").textContent = sel.filter(eligible).length;
    $("#selectionCount").textContent = sel.length; $("#approvedCount").textContent = ap.length;
    $("#selectionBadge").textContent = sel.length + " candidates"; $("#waitingBadge").textContent = wait.length + " applicants";
    $("#cutoffRank").value = db.cutoff;
    $("#selectionBody").innerHTML = sel.length ? sel.map((a,i) => `<tr><td><strong>#${i+1}</strong></td><td>${esc(a.name)}<small class="subline">${esc(a.id)}</small></td><td><strong>${Number(a.rank).toLocaleString("en-IN")}</strong></td><td>${esc(a.mobile||"—")}</td><td><span class="badge ${a.manualOverride ? "gray" : "green"}">${a.manualOverride ? "Manual selection" : "Eligible"}</span></td><td><button class="primary-button" data-approve="${esc(a.id)}">Approve & Open Admission</button> <button class="danger-button" data-remove="${esc(a.id)}">Remove</button></td></tr>`).join("") : '<tr><td colspan="6" class="empty-cell">No selected candidates. Add applicants, set a cutoff, or manually select a candidate from the Waiting List.</td></tr>';
    $("#waitingBody").innerHTML = wait.length ? wait.map(a => `<tr><td>${esc(a.name)}<small class="subline">${esc(a.id)}</small></td><td>${Number(a.rank).toLocaleString("en-IN")}</td><td>${esc(a.mobile||"—")}</td><td><span class="badge ${eligible(a)?"green":(db.cutoff!==""?"red":"gray")}">${db.cutoff===""?"Cutoff not set":(eligible(a)?"Eligible":"Outside cutoff")}</span></td><td>${!eligible(a) ? `<button class="primary-button" data-force-select="${esc(a.id)}">Select Anyway</button> ` : ""}<button class="danger-button" data-delete="${esc(a.id)}">Delete</button></td></tr>`).join("") : '<tr><td colspan="5" class="empty-cell">Waiting list is empty.</td></tr>';
    $("#approvedBody").innerHTML = ap.length ? ap.map(a => `<tr><td>${esc(a.name)}</td><td>${Number(a.rank).toLocaleString("en-IN")}</td><td>${esc(a.approvedAt||"—")}</td><td><button class="primary-button" data-admit="${esc(a.id)}">Continue Admission</button> <button class="secondary-button" data-return="${esc(a.id)}">Return to Waiting</button></td></tr>`).join("") : '<tr><td colspan="4" class="empty-cell">No approved candidates waiting for admission.</td></tr>';
  }
  $("#applicantForm").addEventListener("submit", e => {
    e.preventDefault(); const f = new FormData(e.target), name = String(f.get("name")).trim(), rank = Number(f.get("rank")), mobile = String(f.get("mobile")||"").trim();
    if (!name || !Number.isSafeInteger(rank) || rank < 1) return toast("Enter a valid name and positive whole-number rank.", true);
    if (mobile && !/^\d{10}$/.test(mobile)) return toast("Mobile must contain exactly 10 digits or be left blank.", true);
    if (db.applicants.some(a => a.name.toLowerCase() === name.toLowerCase() && Number(a.rank) === rank && a.status !== "deleted")) return toast("This name and rank already exist in the ranking list.", true);
    db.applicants.push({id:"RANK-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6).toUpperCase(),name,rank,mobile,status:"waiting",createdAt:new Date().toISOString().slice(0,10)});
    e.target.reset(); save(); toast("Applicant added to Waiting List.");
  });
  $("#cutoffForm").addEventListener("submit", e => { e.preventDefault(); const n=Number($("#cutoffRank").value); if(!Number.isSafeInteger(n)||n<1)return toast("Enter a valid positive whole-number cutoff.",true); db.cutoff=n; save(); toast("Selection list recalculated using cutoff "+n.toLocaleString("en-IN")+"."); });
  $("#clearCutoff").onclick=()=>{db.cutoff="";db.applicants.forEach(a=>{if(a.status==="selected"&&!a.manualOverride)a.status="waiting";});save();toast("Cutoff cleared; manually selected applicants remain selected.");};
  document.body.addEventListener("click", e => {
    const b=e.target.closest("button"); if(!b)return;
    const id=b.dataset.approve||b.dataset.remove||b.dataset.delete||b.dataset.admit||b.dataset.return||b.dataset.forceSelect;
    const a=db.applicants.find(x=>x.id===id); if(!a)return;
    if(b.dataset.forceSelect){a.status="selected";a.manualOverride=true;delete a.heldAtCutoff;save();toast("Candidate manually added to Selection List despite cutoff.");}
    else if(b.dataset.remove){a.status="waiting";a.manualOverride=false;a.heldAtCutoff=db.cutoff;save();toast("Returned to Waiting List. They can qualify again after the cutoff changes.");}
    else if(b.dataset.delete){if(confirm("Delete this applicant from the ranking system?")){db.applicants=db.applicants.filter(x=>x.id!==a.id);save();toast("Applicant deleted.");}}
    else if(b.dataset.approve){a.status="approved";a.approvedAt=new Date().toISOString().slice(0,10);save();location.href="../index.html?rankApplicant="+encodeURIComponent(a.id);}
    else if(b.dataset.admit){location.href="../index.html?rankApplicant="+encodeURIComponent(a.id);}
    else if(b.dataset.return){a.status="waiting";a.manualOverride=false;delete a.approvedAt;save();toast("Candidate returned to Waiting List.");}
  });
  $("#exportApplicants").onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="hms-rank-selection-backup.json";a.click();URL.revokeObjectURL(url);toast("Ranking data exported.");};
  $("#importApplicants").onclick=()=>$("#importFile").click();
  $("#importFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d||!Array.isArray(d.applicants))throw Error();db={cutoff:d.cutoff??"",applicants:d.applicants};save();toast("Ranking data imported.");}catch{toast("Invalid ranking backup file.",true);}e.target.value="";});
  render();
})();
