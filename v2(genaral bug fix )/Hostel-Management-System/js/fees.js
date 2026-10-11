(function () {
  "use strict";
  const { $, escapeHTML, money, toast, formatDate } = HMSApp;

  function today() { return new Date().toISOString().slice(0, 10); }
  function selectedStudent() { return HMSStorage.findById($("#feeStudent")?.value || ""); }

  function addMonths(dateString, months) {
    if (!dateString) return "";
    const parts = dateString.split("-").map(Number);
    if (parts.length !== 3 || !parts.every(Number.isFinite)) return "";
    const [y,m,d] = parts;
    const target = new Date(y, m - 1 + Number(months), 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(d, last);
    return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  function renderStudents(keepSelection = true) {
    const select = $("#feeStudent");
    if (!select) return;
    const current = keepSelection ? select.value : "";
    const students = HMSStorage.activeStudents().sort((a,b)=>Number(a.rollNumber)-Number(b.rollNumber));
    select.innerHTML = `<option value="">Select student</option>` + students.map(s =>
      `<option value="${escapeHTML(s.permanentId)}">Roll ${escapeHTML(s.rollNumber)} — ${escapeHTML(s.name)}</option>`
    ).join("");
    if (current && [...select.options].some(o=>o.value===current)) select.value=current;
  }

  function renderFeePeriod() {
    const s = selectedStudent();
    const start = $("#feeStartDate"), duration = $("#feeDurationMonths"), end = $("#feeEndDate"), status = $("#feePeriodStatus");
    const deadline = $("#selectedFeeDeadline");
    if (!s) {
      if (start) start.value = "";
      if (duration) duration.value = HMSStorage.getDatabase().settings.defaultFeeDurationMonths || 6;
      if (end) end.value = "";
      if (status) { status.textContent = "Select student"; status.className = "badge gray"; }
      if (deadline) deadline.innerHTML = `<span class="deadline-empty">Select a student to see the fee deadline.</span>`;
      return;
    }
    if (start) start.value = s.feesStartDate || today();
    if (duration) duration.value = Number(s.feeDurationMonths) || 6;
    calculateEnd();
    const expired = HMSStorage.isFeeExpired(s);
    if (status) { status.textContent = expired ? "EXPIRED" : "ACTIVE"; status.className = `badge ${expired ? "red" : "green"}`; }
    if (deadline) deadline.innerHTML = `<div><small>Current fee period</small><strong>${formatDate(s.feesStartDate)} → ${formatDate(s.feesEndDate)}</strong></div><span class="badge ${expired ? "red" : "green"}">${expired ? "EXPIRED" : "ACTIVE"}</span>`;
  }

  function calculateEnd() {
    const start=$("#feeStartDate"), duration=$("#feeDurationMonths"), end=$("#feeEndDate");
    if (start && duration && end) end.value = addMonths(start.value, Number(duration.value));
  }

  function renderHistory(id) {
    const body=$("#feeHistoryBody"); if(!body) return;
    const rows=HMSStorage.feesFor(id).slice().sort((a,b)=>String(b.paymentDate||b.at||"").localeCompare(String(a.paymentDate||a.at||"")));
    body.innerHTML=rows.length ? rows.map(p=>`<tr><td>${escapeHTML(p.id)}</td><td>${escapeHTML(formatDate(p.paymentDate||p.at))}</td><td>${money(p.amount)}</td><td>${escapeHTML(p.paymentMethod||"Cash")}</td><td>${escapeHTML(p.note||"—")}</td></tr>`).join("") : `<tr><td colspan="5" class="empty-cell">No payments recorded.</td></tr>`;
  }

  function renderAccount(id) {
    const balance=$("#accountBalance"), body=$("#accountHistoryBody"); if(!balance||!body)return;
    if(!id){balance.textContent=money(0);body.innerHTML=`<tr><td colspan="5" class="empty-cell">Select a student.</td></tr>`;return;}
    const account=HMSStorage.accountFor(id); balance.textContent=money(account.balance);
    const rows=account.transactions||[];
    body.innerHTML=rows.length?rows.map(t=>`<tr><td>${escapeHTML(t.id)}</td><td>${escapeHTML(formatDate(t.at))}</td><td><span class="status-badge ${t.type==="withdrawal"?"status-absent":"status-present"}">${escapeHTML(t.type)}</span></td><td>${money(t.amount)}</td><td>${escapeHTML(t.note||"—")}</td></tr>`).join(""):`<tr><td colspan="5" class="empty-cell">No account transactions recorded.</td></tr>`;
  }

  function expiredMessage(student) {
    return `Fee alert: ${student.name} (Roll ${student.rollNumber}) — hostel fees expired on ${formatDate(student.feesEndDate)}. Please contact the hostel office to renew the fees.`;
  }

  function selectStudentForFee(id, renewal=false) {
    const select=$("#feeStudent");
    if(!select)return;
    renderStudents(true);
    select.value=id;
    renderFeePeriod();
    renderHistory(id);
    renderAccount(id);
    if(renewal){
      $("#feeStartDate").value=today();
      $("#feeDurationMonths").value=Number(HMSStorage.getDatabase().settings.defaultFeeDurationMonths)||6;
      calculateEnd();
      $("#feeNote").value="Fee renewal";
    }
    document.getElementById("feeForm")?.scrollIntoView({behavior:"smooth",block:"start"});
    setTimeout(()=>$("#feeAmount")?.focus(),250);
  }

  function renderExpiredStudents() {
    const body=$("#expiredFeesBody"), count=$("#expiredFeeCount"), copyBtn=$("#copyExpiredFeeStudentsBtnV19");
    if(!body)return;
    const list=HMSStorage.expiredFeeStudents();
    if(count)count.textContent=list.length;

    if(!list.length){
      body.innerHTML=`<tr><td colspan="8" class="empty-cell">🎉 No active students have expired fees.</td></tr>`;
    } else {
      body.innerHTML=list.map(s=>{
        const phone=String(s.parentMobile||s.mobile||"").replace(/\D/g,"");
        const message=expiredMessage(s);
        const wa=phone?`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`:"";
        return `<tr class="expired-row">
          <td><strong>${escapeHTML(s.rollNumber)}</strong></td>
          <td><strong>${escapeHTML(s.name)}</strong><small class="table-sub">${escapeHTML(s.mobile||"No mobile")}</small></td>
          <td>${escapeHTML(s.parentMobile||"—")}</td>
          <td>${escapeHTML(formatDate(s.feesStartDate))}</td>
          <td><strong>${escapeHTML(formatDate(s.feesEndDate))}</strong></td>
          <td><span class="badge red">EXPIRED</span></td>
          <td><button class="primary-button small-button expired-action" type="button" data-add-fee="${escapeHTML(s.permanentId)}">＋ Add Fee</button></td>
          <td>${wa?`<a class="secondary-button small-button" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:`<span class="hint">No mobile</span>`}</td>
        </tr>`;
      }).join("");
    }

    $$(".expired-action",body).forEach(btn=>{
      btn.addEventListener("click",()=>selectStudentForFee(btn.dataset.addFee,true));
    });

    if(copyBtn){
      copyBtn.disabled=!list.length;
      copyBtn.onclick = copyExpiredStudentList;
    }
  }

  // Global, synchronous copy handler. It is intentionally independent of the
  // async Clipboard API so it works when this app is opened directly from a
  // local file (file://) or when Clipboard permissions are unavailable.
  function copyExpiredStudentList(event){
    if(event){ event.preventDefault(); event.stopPropagation(); }

    const students = HMSStorage.expiredFeeStudents();
    if(!students.length){
      toast("There are no expired fee students to copy.","error");
      return false;
    }

    const text = students.map((s,index)=>{
      const name = String(s.name || "Unnamed Student").trim();
      const roll = String(s.rollNumber ?? "—").trim() || "—";
      const expired = formatDate(s.feesEndDate) || "—";
      const mobile = String(s.mobile || "").trim() || "—";
      const parent = String(s.parentMobile || "").trim() || "—";
      return `${index + 1}. ${name} (Roll ${roll}) — Fees expired: ${expired} — Mobile: ${mobile} — Parent: ${parent}`;
    }).join("\n");

    // Keep the exact text available for the fallback and for debugging.
    window.__HMS_EXPIRED_FEE_COPY_TEXT__ = text;

    // Synchronous legacy copy is the most reliable option for this static app.
    try{
      const ta=document.createElement("textarea");
      ta.value=text;
      ta.readOnly=true;
      ta.setAttribute("aria-hidden","true");
      ta.style.position="fixed";
      ta.style.left="0";
      ta.style.top="0";
      ta.style.width="1px";
      ta.style.height="1px";
      ta.style.padding="0";
      ta.style.border="0";
      ta.style.opacity="0.01";
      ta.style.pointerEvents="none";
      document.body.appendChild(ta);
      ta.focus({preventScroll:true});
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok=document.execCommand("copy");
      ta.remove();
      if(ok){
        toast(`${students.length} expired student${students.length===1?"":"s"} copied successfully.`);
        return true;
      }
    }catch(err){
      console.warn("Synchronous copy failed:", err);
    }

    // Try the modern API only after the synchronous path. Do not report success
    // unless the promise actually resolves.
    if(navigator.clipboard && typeof navigator.clipboard.writeText === "function"){
      navigator.clipboard.writeText(text).then(()=>{
        toast(`${students.length} expired student${students.length===1?"":"s"} copied successfully.`);
      }).catch(err=>{
        console.warn("Clipboard API failed:", err);
        showCopyFallback(text);
      });
      return true;
    }

    showCopyFallback(text);
    return false;
  }

  window.HMSCopyExpiredFeeStudents = copyExpiredStudentList;

  function showCopyFallback(text){
    const old=document.getElementById("hmsCopyFallback");
    if(old) old.remove();
    const box=document.createElement("div");
    box.id="hmsCopyFallback";
    box.style.cssText="position:fixed;z-index:2147483647;left:20px;right:20px;bottom:20px;background:#fff;padding:16px;border:2px solid #ef4444;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);";
    box.innerHTML=`<strong>Automatic copy was blocked.</strong><div style="margin:8px 0;font-size:13px;">Click inside the box, press Ctrl+A, then Ctrl+C.</div><textarea style="width:100%;min-height:150px;box-sizing:border-box;"></textarea><div style="margin-top:8px;text-align:right;"><button type="button" id="hmsCopyFallbackClose" class="secondary-button">Close</button></div>`;
    document.body.appendChild(box);
    const area=box.querySelector("textarea");
    area.value=text;
    area.focus();
    area.select();
    box.querySelector("#hmsCopyFallbackClose").onclick=()=>box.remove();
    toast("Automatic copy was blocked. The complete list is ready to copy.","error");
  }


  function setup() {
    renderStudents(false);
    if($("#feeDate")&&!$("#feeDate").value)$("#feeDate").value=today();

    $("#feeStudent")?.addEventListener("change",e=>{
      const id=e.target.value; renderFeePeriod(); renderHistory(id); renderAccount(id);
    });
    $("#feeStartDate")?.addEventListener("change",calculateEnd);
    $("#feeDurationMonths")?.addEventListener("input",calculateEnd);

    $("#feeForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      try{
        const id=$("#feeStudent").value; if(!id)throw new Error("Select a student first.");
        const start=$("#feeStartDate").value, duration=$("#feeDurationMonths").value, end=$("#feeEndDate").value;
        if(!start||!duration||!end)throw new Error("Enter a valid fee starting date and duration.");
        HMSStorage.updateFeePeriod(id,start,duration,end);
        HMSStorage.addPayment(id,$("#feeAmount").value,$("#feeNote").value,$("#feeDate").value,$("#feeMethod").value);
        renderStudents(true); renderFeePeriod(); renderHistory(id); renderAccount(id);
        $("#feeAmount").value="";$("#feeNote").value="";$("#feeDate").value=today();$("#feeMethod").value="Cash";
        toast("Fee payment and fee period saved successfully.");renderExpiredStudents();
      }catch(err){toast(err.message||"Could not save fee payment.","error");}
    });

    $("#updateFeePeriodBtn")?.addEventListener("click",()=>{
      try{
        const id=$("#feeStudent").value;if(!id)throw new Error("Select a student first.");
        HMSStorage.updateFeePeriod(id,$("#feeStartDate").value,$("#feeDurationMonths").value,$("#feeEndDate").value);
        renderStudents(true);renderFeePeriod();renderExpiredStudents();toast("Fee period updated successfully.");
      }catch(err){toast(err.message||"Could not update fee period.","error");}
    });

    $("#accountForm")?.addEventListener("submit",e=>{
      e.preventDefault();
      try{const id=$("#feeStudent").value;if(!id)throw new Error("Select a student first.");HMSStorage.addAccountTransaction(id,$("#accountAmount").value,$("#accountType").value,$("#accountNote").value);$("#accountAmount").value="";$("#accountNote").value="";renderAccount(id);toast("Student account updated.");}
      catch(err){toast(err.message,"error");}
    });

    const queryId=new URLSearchParams(location.search).get("student");
    if(queryId && HMSStorage.findById(queryId)) selectStudentForFee(queryId,false);
    else {renderFeePeriod();renderHistory("");renderAccount("");}
    renderExpiredStudents();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
  window.addEventListener("hms:data-changed",()=>{
    const id=$("#feeStudent")?.value||"";renderStudents(true);if(id){renderFeePeriod();renderHistory(id);renderAccount(id);}renderExpiredStudents();
  });
})();