(function () {
  "use strict";
  const { $, $$, escapeHTML, toast } = HMSApp;
  let activeFilter = "all";

  function statusFor(room) {
    if (room.free <= 0) return { label: "Full", cls: "red" };
    if (room.count === 0) return { label: "Empty", cls: "gray" };
    return { label: `${room.free} space${room.free === 1 ? "" : "s"} left`, cls: "green" };
  }

  function renderRanges() {
    const box = $("#roomRangesList");
    if (!box) return;
    const ranges = HMSStorage.roomRanges();
    box.innerHTML = ranges.length ? ranges.map(r => `<div class="range-pill"><span><strong>${escapeHTML(r.start)}–${escapeHTML(r.end)}</strong> • Floor ${escapeHTML(r.floor)}</span><button type="button" class="table-action range-remove" data-id="${escapeHTML(r.id)}">Remove</button></div>`).join("") : `<div class="empty-inline">No room ranges configured yet.</div>`;
    $$(".range-remove", box).forEach(btn => btn.onclick = () => {
      if (!confirm("Remove this room range from the available room list? Existing student allocations are not deleted.")) return;
      try { HMSStorage.removeRoomRange(btn.dataset.id); toast("Room range removed."); render(); } catch (err) { toast(err.message, "error"); }
    });
  }

  function matchesFilter(room) {
    if (activeFilter === "all") return true;
    if (activeFilter === "empty") return room.count === 0;
    return String(room.free) === activeFilter;
  }

  function renderRooms() {
    const body = $("#roomsBody");
    if (!body) return;
    const rooms = HMSStorage.roomOccupancy().filter(matchesFilter);
    body.innerHTML = rooms.length ? rooms.map(room => {
      const st = statusFor(room);
      const names = room.students.length ? room.students.slice().sort((a,b)=>a.rollNumber-b.rollNumber).map(s => `<span class="room-student-tag">${escapeHTML(s.rollNumber)} ${escapeHTML(s.name)}</span>`).join("") : `<span class="muted">Empty</span>`;
      return `<tr><td><strong>${escapeHTML(room.number)}</strong></td><td>Floor ${escapeHTML(room.floor || "—")}</td><td>${room.count} / ${room.capacity}</td><td><strong>${room.free}</strong></td><td><span class="badge ${st.cls}">${st.label}</span></td><td>${names}</td></tr>`;
    }).join("") : `<tr><td colspan="6" class="empty-cell">No rooms match this filter.</td></tr>`;
  }

  function renderStudents() {
    const body = $("#hostelBody");
    if (!body) return;
    const students = HMSStorage.activeStudents().sort((a,b)=>a.rollNumber-b.rollNumber);
    body.innerHTML = students.length ? students.map(s => `<tr>
      <td><strong>${escapeHTML(s.rollNumber)}</strong></td>
      <td><div class="student-cell"><span class="mini-avatar">${escapeHTML(s.name.slice(0,1).toUpperCase())}</span><div><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.permanentId)}</small></div></div></td>
      <td>${escapeHTML(s.roomNumber || "Not allocated")}</td>
      <td>${escapeHTML(s.floorNumber ? "Floor " + s.floorNumber : "—")}</td>
      <td><button class="table-action shift-btn" data-id="${escapeHTML(s.permanentId)}">${s.roomNumber ? "Shift Room" : "Allocate Room"}</button>${s.roomNumber ? ` <button class="table-action unallocate-btn" data-id="${escapeHTML(s.permanentId)}">Clear</button>` : ""}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-cell">No active students.</td></tr>`;
    $$(".shift-btn", body).forEach(btn => btn.onclick = () => openRoomModal(btn.dataset.id));
    $$(".unallocate-btn", body).forEach(btn => btn.onclick = () => {
      if (!confirm("Remove this student's current room allocation?")) return;
      try { HMSStorage.unallocateRoom(btn.dataset.id); toast("Room allocation cleared."); render(); } catch (err) { toast(err.message, "error"); }
    });
  }

  function openRoomModal(id) {
    const s = HMSStorage.findById(id);
    if (!s) return;
    const rooms = HMSStorage.roomOccupancy();
    const capacity = HMSStorage.getRoomCapacity();
    const available = rooms.filter(r => r.number === String(s.roomNumber) || r.free > 0);
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `<div class="modal room-modal">
      <div class="modal-head"><div><span class="eyebrow">Room Allocation</span><h2>${escapeHTML(s.name)}</h2><small>Roll ${escapeHTML(s.rollNumber)}</small></div><button class="modal-close">×</button></div>
      <div class="profile-grid"><div><span>Current Room</span><strong>${escapeHTML(s.roomNumber || "Not allocated")}</strong></div><div><span>Current Floor</span><strong>${escapeHTML(s.floorNumber || "—")}</strong></div></div>
      <form id="roomShiftForm" class="room-shift-form">
        <label>Choose room</label>
        <select id="targetRoom" required><option value="">Select a room</option>${available.map(r => `<option value="${escapeHTML(r.number)}" data-floor="${escapeHTML(r.floor)}" ${String(s.roomNumber)===r.number ? "selected" : ""}>Room ${escapeHTML(r.number)} • Floor ${escapeHTML(r.floor || "—")} • ${r.count}/${capacity} occupied • ${r.free} free</option>`).join("")}</select>
        <p class="modal-help">A full room cannot be selected. Capacity is common for every room.</p>
        <div class="modal-actions"><button type="button" class="secondary-button modal-cancel">Cancel</button><button type="submit" class="primary-button">Save Room</button></div>
      </form>
    </div>`;
    document.body.appendChild(modal);
    $(".modal-close", modal).onclick = () => modal.remove();
    $(".modal-cancel", modal).onclick = () => modal.remove();
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
    $("#roomShiftForm", modal).onsubmit = e => {
      e.preventDefault();
      const select = $("#targetRoom", modal);
      const option = select.options[select.selectedIndex];
      try {
        HMSStorage.allocateRoom(id, select.value, option?.dataset.floor || "");
        modal.remove(); toast(`Room ${select.value} allocated to ${s.name}.`); render();
      } catch (err) { toast(err.message, "error"); }
    };
  }

  function renderFilters() {
    const box = $("#roomFilters");
    if (!box) return;
    const cap = HMSStorage.getRoomCapacity();
    const options = [
      { key: "all", label: "All Rooms" },
      { key: "empty", label: "Fully Empty" },
      ...Array.from({ length: Math.max(cap - 1, 0) }, (_, i) => { const free = cap - 1 - i; return { key: String(free), label: `${free} Space${free === 1 ? "" : "s"}` }; }),
      { key: "0", label: "No Space / Full" }
    ];
    box.innerHTML = options.map(o => `<button type="button" class="filter-chip ${activeFilter === o.key ? "active" : ""}" data-filter="${o.key}">${o.label}</button>`).join("");
    $$(".filter-chip", box).forEach(btn => btn.onclick = () => { activeFilter = btn.dataset.filter; renderFilters(); renderRooms(); });
  }

  function renderStats() {
    const rooms = HMSStorage.roomOccupancy();
    const empty = rooms.filter(r=>r.count===0).length;
    const full = rooms.filter(r=>r.free<=0).length;
    const partial = rooms.filter(r=>r.count>0 && r.free>0).length;
    if ($("#roomTotal")) $("#roomTotal").textContent = rooms.length;
    if ($("#roomEmpty")) $("#roomEmpty").textContent = empty;
    if ($("#roomPartial")) $("#roomPartial").textContent = partial;
    if ($("#roomFull")) $("#roomFull").textContent = full;
    const cap = HMSStorage.getRoomCapacity();
    if ($("#roomCapacity")) $("#roomCapacity").value = cap;
    if ($("#capacityLabel")) $("#capacityLabel").textContent = cap;
  }

  function render() { renderStats(); renderFilters(); renderRanges(); renderRooms(); renderStudents(); }

  function setup() {
    const capForm = $("#capacityForm");
    if (capForm) capForm.onsubmit = e => { e.preventDefault(); try { HMSStorage.setRoomCapacity($("#roomCapacity").value); toast("Room capacity saved."); render(); } catch (err) { toast(err.message, "error"); } };
    const rangeForm = $("#rangeForm");
    if (rangeForm) rangeForm.onsubmit = e => { e.preventDefault(); try { HMSStorage.addRoomRange($("#rangeStart").value, $("#rangeEnd").value, $("#rangeFloor").value); rangeForm.reset(); toast("Room range added."); render(); } catch (err) { toast(err.message, "error"); } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { setup(); render(); }); else { setup(); render(); }
  window.addEventListener("hms:data-changed", render);
})();
