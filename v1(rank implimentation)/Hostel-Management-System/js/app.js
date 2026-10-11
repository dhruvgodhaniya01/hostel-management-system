
(function () {
  "use strict";

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", {
      day:"2-digit", month:"short", year:"numeric"
    });
  }

  function money(n) {
    return new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(Number(n)||0);
  }

  function toast(message, type = "success") {
    const box = $("#toastContainer");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === "success" ? "✓" : "!"}</span><div>${escapeHTML(message)}</div>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateGlobalStats() {
    const s = HMSStorage.statistics();
    setText("currentStudentCount", s.active);
    setText("nextRollPreview", HMSStorage.nextRoll());
    setText("statTotal", s.total);
    setText("statActive", s.active);
    setText("statLeft", s.left);
    setText("statAllocated", s.allocated);
    setText("statUnallocated", s.unallocated);
    setText("statPaid", money(s.paid));
  }

  function setupMobileMenu() {
    const btn = $("#mobileMenu");
    const side = $("#sidebar");
    if (btn && side) btn.addEventListener("click", () => side.classList.toggle("open"));
  }

  function setupDataTransfer() {
    const exportBtn = $("#exportDataBtn");
    const importBtn = $("#importDataBtn");
    const input = $("#importFileInput");
    if (exportBtn) exportBtn.addEventListener("click", () => {
      const data = HMSStorage.exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `hostel-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Complete database backup downloaded.");
    });
    if (importBtn && input) importBtn.addEventListener("click", () => input.click());
    if (input) input.addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!confirm("Replace this device's current hostel data with the selected backup?")) return;
        HMSStorage.importDatabase(data, "replace");
        toast("Backup imported successfully.");
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        toast(err.message || "Could not import backup.", "error");
      } finally {
        input.value = "";
      }
    });
  }

  function setupGlobal() {
    setupMobileMenu();
    setupDataTransfer();
    updateGlobalStats();
    window.addEventListener("hms:data-changed", updateGlobalStats);
  }

  window.HMSApp = { $, $$, escapeHTML, formatDate, money, toast, setText, updateGlobalStats };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupGlobal);
  else setupGlobal();
})();
