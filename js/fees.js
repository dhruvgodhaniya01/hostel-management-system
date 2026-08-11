(function () {
  "use strict";
  const { $, escapeHTML, money, toast } = HMSApp;

  function renderStudents() {
    const select = $("#feeStudent");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Select student</option>` + HMSStorage.activeStudents().sort((a,b)=>a.rollNumber-b.rollNumber)
      .map(s => `<option value="${escapeHTML(s.permanentId)}">Roll ${s.rollNumber} — ${escapeHTML(s.name)}</option>`).join("");
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function renderHistory(id) {
    const body = $("#feeHistoryBody");
    if (!body) return;
    const rows = HMSStorage.feesFor(id);
    body.innerHTML = rows.length ? rows.map(p => `<tr><td>${escapeHTML(p.id)}</td><td>${new Date(p.at).toLocaleDateString("en-IN")}</td><td>${money(p.amount)}</td><td>${escapeHTML(p.note||"—")}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty-cell">No payments recorded.</td></tr>`;
  }

  function renderAccount(id) {
    const balance = $("#accountBalance");
    const body = $("#accountHistoryBody");
    if (!balance || !body) return;
    if (!id) {
      balance.textContent = money(0);
      body.innerHTML = `<tr><td colspan="5" class="empty-cell">Select a student.</td></tr>`;
      return;
    }
    const account = HMSStorage.accountFor(id);
    balance.textContent = money(account.balance);
    const rows = account.transactions || [];
    body.innerHTML = rows.length ? rows.map(t => `<tr><td>${escapeHTML(t.id)}</td><td>${new Date(t.at).toLocaleDateString("en-IN")}</td><td><span class="status-badge ${t.type === "withdrawal" ? "status-absent" : "status-present"}">${escapeHTML(t.type)}</span></td><td>${money(t.amount)}</td><td>${escapeHTML(t.note || "—")}</td></tr>`).join("")
      : `<tr><td colspan="5" class="empty-cell">No account transactions recorded.</td></tr>`;
  }

  function setup() {
    renderStudents();
    $("#feeStudent")?.addEventListener("change", e => {
      renderHistory(e.target.value);
      renderAccount(e.target.value);
    });

    $("#feeForm")?.addEventListener("submit", e => {
      e.preventDefault();
      try {
        HMSStorage.addPayment($("#feeStudent").value, $("#feeAmount").value, $("#feeNote").value);
        $("#feeForm").reset();
        renderStudents(); renderHistory(""); renderAccount("");
        toast("Fee payment saved.");
      } catch(err) { toast(err.message, "error"); }
    });

    $("#accountForm")?.addEventListener("submit", e => {
      e.preventDefault();
      try {
        const id = $("#feeStudent").value;
        if (!id) throw new Error("Select a student first.");
        HMSStorage.addAccountTransaction(id, $("#accountAmount").value, $("#accountType").value, $("#accountNote").value);
        $("#accountAmount").value = "";
        $("#accountNote").value = "";
        renderAccount(id);
        toast("Student account updated.");
      } catch(err) { toast(err.message, "error"); }
    });

    renderHistory("");
    renderAccount("");
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", setup); else setup();
  window.addEventListener("hms:data-changed", () => { renderStudents(); renderAccount($("#feeStudent")?.value || ""); });
})();
