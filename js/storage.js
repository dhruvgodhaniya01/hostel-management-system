
/* ============================================================
   HOSTEL MANAGEMENT SYSTEM - CENTRAL STORAGE
   One database for the complete application.
   ============================================================ */
(function () {
  "use strict";

  const KEY = "dhruv_hms_database_v1";
  const VERSION = 1;

  const defaultDB = () => ({
    meta: {
      app: "Hostel Management System",
      version: VERSION,
      owner: "Dhruv Godhaniya",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    counters: {
      nextStudentSequence: 1,
      nextRoomSequence: 1,
      nextPaymentSequence: 1
    },
    students: [],
    formerStudents: [],
    attendance: {},
    fees: [],
    rooms: [],
    history: [],
    settings: {
      hostelName: "Hostel Manager",
      defaultFee: 0,
      attendanceThreshold: 75,
      defaultFeeDurationMonths: 6,
      defaultCaste: "Maher",
      roomCapacity: 3,
      roomRanges: []
    }
  });

  let db = null;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeAttendanceStorage(source) {
    // Attendance is intentionally a single, current snapshot. Older versions
    // stored one record per date; migrate the most recently saved date so no
    // existing attendance is lost when the new system loads for the first time.
    if (!source || typeof source !== "object") return { current: {}, lastSavedDate: null, lastSavedAt: null };
    if (Object.prototype.hasOwnProperty.call(source, "current")) {
      return {
        current: source.current && typeof source.current === "object" ? source.current : {},
        lastSavedDate: source.lastSavedDate || null,
        lastSavedAt: source.lastSavedAt || null
      };
    }
    const dates = Object.keys(source).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    const lastDate = dates.length ? dates[dates.length - 1] : null;
    return {
      current: lastDate ? (source[lastDate] || {}) : {},
      lastSavedDate: lastDate,
      lastSavedAt: null
    };
  }

  function ensureShape(data) {
    const base = defaultDB();
    const source = data && typeof data === "object" ? data : {};
    const merged = {
      ...base,
      ...source,
      meta: { ...base.meta, ...(source.meta || {}) },
      counters: { ...base.counters, ...(source.counters || {}) },
      settings: { ...base.settings, ...(source.settings || {}),
        roomCapacity: Number((source.settings || {}).roomCapacity) > 0 ? Number((source.settings || {}).roomCapacity) : base.settings.roomCapacity,
        roomRanges: Array.isArray((source.settings || {}).roomRanges) ? (source.settings || {}).roomRanges : base.settings.roomRanges,
        defaultFeeDurationMonths: Number((source.settings || {}).defaultFeeDurationMonths) > 0 ? Number((source.settings || {}).defaultFeeDurationMonths) : base.settings.defaultFeeDurationMonths,
        defaultCaste: String((source.settings || {}).defaultCaste || base.settings.defaultCaste)
      },
      students: Array.isArray(source.students) ? source.students : [],
      formerStudents: Array.isArray(source.formerStudents) ? source.formerStudents : [],
      attendance: normalizeAttendanceStorage(source.attendance),
      fees: Array.isArray(source.fees) ? source.fees : [],
      accounts: source.accounts && typeof source.accounts === "object" ? source.accounts : {},
      rooms: Array.isArray(source.rooms) ? source.rooms : [],
      history: Array.isArray(source.history) ? source.history : []
    };

    // Backward compatibility for older backups/local data.
    // Old guardian/father fields are no longer used by the UI.
    const defaultCaste = merged.settings.defaultCaste || "Maher";
    const defaultDuration = Number(merged.settings.defaultFeeDurationMonths) || 6;
    [...merged.students, ...merged.formerStudents].forEach(s => {
      if (!s.caste) s.caste = defaultCaste;
      if (!s.parentMobile) s.parentMobile = "";
      if (!s.admissionDate) s.admissionDate = s.joinedAt ? String(s.joinedAt).slice(0,10) : new Date().toISOString().slice(0,10);
      if (!s.feesStartDate) s.feesStartDate = s.admissionDate;
      if (!Number.isInteger(Number(s.feeDurationMonths)) || Number(s.feeDurationMonths) < 1) s.feeDurationMonths = defaultDuration;
      if (!s.feesEndDate) s.feesEndDate = addMonthsToDate(s.feesStartDate, Number(s.feeDurationMonths));
    });
    return merged;
  }

  function persist() {
    db.meta.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(db));
    window.dispatchEvent(new CustomEvent("hms:data-changed"));
  }

  function init() {
    try {
      const raw = localStorage.getItem(KEY);
      db = raw ? ensureShape(JSON.parse(raw)) : defaultDB();
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (err) {
      console.error("HMS storage initialization failed:", err);
      db = defaultDB();
    }
    return db;
  }

  function getDatabase() {
    if (!db) init();
    return db;
  }

  function updateDatabase(mutator) {
    if (!db) init();
    const result = mutator(db);
    persist();
    return result;
  }

  function makeStudentId() {
    const n = Number(db.counters.nextStudentSequence) || 1;
    db.counters.nextStudentSequence = n + 1; // never decreases/reuses
    return `HMS-STU-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`;
  }

  function activeStudents() {
    return db.students.filter(s => s.status === "active");
  }

  function normalizeRoll(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function nextRoll() {
    const used = new Set(activeStudents().map(s => s.rollNumber));
    let roll = 1;
    while (used.has(roll)) roll++;
    return roll;
  }

  function addHistory(type, studentId, details = {}) {
    db.history.unshift({
      id: `HMS-H-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      studentId: studentId || null,
      details,
      at: new Date().toISOString()
    });
    if (db.history.length > 2000) db.history.length = 2000;
  }

  function normalizeDateInput(value, fallback = "") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return "";
    const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
    const test = new Date(y, m - 1, d);
    if (test.getFullYear() !== y || test.getMonth() !== m - 1 || test.getDate() !== d) return "";
    return raw;
  }

  function addMonthsToDate(dateString, months) {
    const date = normalizeDateInput(dateString);
    const count = Number(months);
    if (!date || !Number.isInteger(count) || count < 1) return "";
    const [y, m, d] = date.split("-").map(Number);
    const target = new Date(y, (m - 1) + count, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(d, lastDay);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  function validMobile(value) {
    const raw = String(value || "").trim();
    return /^\d{10}$/.test(raw) ? raw : "";
  }

  function addStudent(input) {
    const name = String(input.name || "").trim();
    const village = String(input.village || "").trim();
    const mobile = validMobile(input.mobile);
    const parentMobile = validMobile(input.parentMobile);
    const casteInput = String(input.caste || "").trim();
    const customCaste = String(input.customCaste || "").trim();
    const caste = casteInput === "__custom__" ? customCaste : casteInput;
    const today = new Date().toISOString().slice(0,10);
    const admissionDate = normalizeDateInput(input.admissionDate, today);
    const feesStartDate = normalizeDateInput(input.feesStartDate, admissionDate);
    const feeDurationMonths = Number(input.feeDurationMonths || db.settings.defaultFeeDurationMonths || 6);
    const suggestedFeesEndDate = addMonthsToDate(feesStartDate, feeDurationMonths);
    const suppliedFeesEndDate = normalizeDateInput(input.feesEndDate);
    const feesEndDate = suppliedFeesEndDate || suggestedFeesEndDate;

    if (!name || !village) throw new Error("Student full name and village/city are required.");
    if (!mobile) throw new Error("Student mobile number must be exactly 10 digits.");
    if (!parentMobile) throw new Error("Parent mobile number must be exactly 10 digits.");
    if (!caste) throw new Error("Please select or enter a caste.");
    if (!admissionDate || !feesStartDate || !feesEndDate) throw new Error("Please enter valid admission and fee dates.");
    if (!Number.isInteger(feeDurationMonths) || feeDurationMonths < 1 || feeDurationMonths > 60) throw new Error("Fee duration must be between 1 and 60 months.");
    if (feesEndDate < feesStartDate) throw new Error("Fees ending date cannot be before the fees starting date.");

    const student = {
      permanentId: makeStudentId(),
      rollNumber: nextRoll(),
      name,
      village,
      mobile,
      parentMobile,
      caste,
      admissionDate,
      feesStartDate,
      feeDurationMonths,
      feesEndDate,
      status: "active",
      joinedAt: new Date(`${admissionDate}T00:00:00`).toISOString(),
      leftAt: null,
      roomNumber: "",
      floorNumber: "",
      bedNumber: "",
      notes: ""
    };
    db.students.push(student);
    addHistory("student_added", student.permanentId, { rollNumber: student.rollNumber });
    persist();
    return deepClone(student);
  }

  function updateStudent(permanentId, patch) {
    const s = db.students.find(x => x.permanentId === permanentId);
    if (!s) throw new Error("Student not found.");
    const allowed = ["name", "village", "mobile", "parentMobile", "caste", "admissionDate", "feesStartDate", "feeDurationMonths", "feesEndDate", "notes"];
    allowed.forEach(k => {
      if (patch[k] !== undefined) s[k] = typeof patch[k] === "number" ? patch[k] : String(patch[k]).trim();
    });
    addHistory("student_updated", permanentId);
    persist();
    return deepClone(s);
  }

  function findByRoll(roll) {
    const n = normalizeRoll(roll);
    if (!n) return null;
    return activeStudents().find(s => s.rollNumber === n) || null;
  }

  function findById(id) {
    return db.students.find(s => s.permanentId === id) || null;
  }

  function searchStudents(query) {
    const raw = String(query || "").trim();
    if (!raw) return activeStudents();

    // The Students page is the CURRENT student list. Former/left students
    // must never appear here. If the query is a number, treat it as an
    // exact current roll-number search instead of matching IDs/other fields.
    if (/^\d+$/.test(raw)) {
      const roll = Number(raw);
      return activeStudents().filter(s => Number(s.rollNumber) === roll);
    }

    const q = raw.toLowerCase();
    return activeStudents().filter(s =>
      [s.name, s.village, s.mobile, s.parentMobile, s.caste, s.permanentId]
        .some(v => String(v || "").toLowerCase().includes(q))
    );
  }

  function formerStudents() {
    // Prefer the saved historical snapshots. Also include any older left
    // records from backups that predate the formerStudents array.
    const snapshots = Array.isArray(db.formerStudents) ? db.formerStudents : [];
    const snapshotIds = new Set(snapshots.map(s => s.permanentId));
    const legacy = db.students.filter(s => s.status === "left" && !snapshotIds.has(s.permanentId));
    return deepClone([...snapshots, ...legacy].sort((a, b) =>
      new Date(b.leftAt || 0) - new Date(a.leftAt || 0)
    ));
  }

  function renumberActiveStudents() {
    // Keep active roll numbers continuous: 1, 2, 3, ... with no gaps.
    // Students keep their relative order, so when a student leaves,
    // everyone after that student moves down by one.
    const active = activeStudents().sort((a, b) => {
      const ar = Number(a.rollNumber) || Number.MAX_SAFE_INTEGER;
      const br = Number(b.rollNumber) || Number.MAX_SAFE_INTEGER;
      return ar - br;
    });

    active.forEach((student, index) => {
      const newRoll = index + 1;
      const oldRoll = student.rollNumber;
      if (oldRoll !== newRoll) {
        student.rollNumber = newRoll;
        addHistory("student_roll_changed", student.permanentId, {
          previousRollNumber: oldRoll,
          newRollNumber: newRoll,
          reason: "active_rolls_compacted_after_student_left"
        });
      }
    });

    return active;
  }

  function markLeft(permanentId) {
    const s = findById(permanentId);
    if (!s || s.status !== "active") throw new Error("Active student not found.");

    const previousRollNumber = s.rollNumber;

    s.status = "left";
    s.leftAt = new Date().toISOString();
    s.previousRollNumber = previousRollNumber;
    s.rollNumber = null;
    s.roomNumber = "";
    s.floorNumber = "";
    s.bedNumber = "";

    // Save a historical snapshot with the roll number the student had when leaving.
    db.formerStudents.push(deepClone(s));

    // Compact active roll numbers immediately. Example:
    // 1,2,3,4,5 -> remove 2 -> 1,2,3,4.
    renumberActiveStudents();

    addHistory("student_left", permanentId, { previousRollNumber });
    persist();
    return deepClone(s);
  }

  function restoreStudent(permanentId) {
    const s = findById(permanentId);
    if (!s || s.status !== "left") throw new Error("Former student not found.");
    s.status = "active";
    s.leftAt = null;
    s.rollNumber = nextRoll();
    db.formerStudents = db.formerStudents.filter(x => x.permanentId !== permanentId);
    addHistory("student_restored", permanentId, { newRollNumber: s.rollNumber });
    persist();
    return deepClone(s);
  }

  function deleteStudent(permanentId) {
    const s = findById(permanentId);
    if (!s) throw new Error("Student not found.");
    db.students = db.students.filter(x => x.permanentId !== permanentId);
    db.formerStudents = db.formerStudents.filter(x => x.permanentId !== permanentId);
    addHistory("student_deleted", permanentId);
    persist();
  }

  function getRoomCapacity() {
    const n = Number(db.settings.roomCapacity);
    return Number.isInteger(n) && n > 0 ? n : 3;
  }

  function roomRanges() {
    return deepClone(Array.isArray(db.settings.roomRanges) ? db.settings.roomRanges : []);
  }

  function roomList() {
    const seen = new Set();
    const rooms = [];
    roomRanges().forEach(range => {
      const start = Number(range.start);
      const end = Number(range.end);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) return;
      for (let n = start; n <= end; n++) {
        const key = String(n);
        if (seen.has(key)) continue;
        seen.add(key);
        rooms.push({ number: key, floor: String(range.floor || "") });
      }
    });
    return rooms;
  }

  function setRoomCapacity(capacity) {
    const n = Number(capacity);
    if (!Number.isInteger(n) || n <= 0) throw new Error("Room capacity must be a positive whole number.");
    db.settings.roomCapacity = n;
    addHistory("room_capacity_changed", null, { capacity: n });
    persist();
    return n;
  }

  function addRoomRange(start, end, floor) {
    const a = Number(start), b = Number(end);
    const f = String(floor ?? "").trim();
    if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b < a) throw new Error("Enter a valid room range.");
    if (!f) throw new Error("Floor is required.");
    const existing = roomList().map(r => Number(r.number));
    for (let n = a; n <= b; n++) {
      if (existing.includes(n)) throw new Error(`Room ${n} already exists in another range.`);
    }
    db.settings.roomRanges.push({ id: `HMS-RANGE-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, start: a, end: b, floor: f });
    addHistory("room_range_added", null, { start: a, end: b, floor: f });
    persist();
  }

  function removeRoomRange(id) {
    const before = db.settings.roomRanges.length;
    db.settings.roomRanges = db.settings.roomRanges.filter(r => r.id !== id);
    if (db.settings.roomRanges.length === before) throw new Error("Room range not found.");
    addHistory("room_range_removed", null, { id });
    persist();
  }

  function roomOccupancy() {
    const active = activeStudents();
    const capacity = getRoomCapacity();
    const configured = roomList();
    const byRoom = new Map(configured.map(r => [r.number, { ...r, capacity, students: [] }]));
    active.filter(s => s.roomNumber).forEach(s => {
      const key = String(s.roomNumber);
      if (!byRoom.has(key)) byRoom.set(key, { number: key, floor: String(s.floorNumber || "Unregistered"), capacity, students: [] });
      byRoom.get(key).students.push(s);
    });
    return Array.from(byRoom.values()).map(r => ({
      ...r,
      count: r.students.length,
      free: Math.max(r.capacity - r.students.length, 0),
      full: r.students.length >= r.capacity
    })).sort((a,b) => Number(a.number)-Number(b.number));
  }

  function allocateRoom(permanentId, roomNumber, floorNumber) {
    const s = findById(permanentId);
    if (!s || s.status !== "active") throw new Error("Active student not found.");
    const room = String(roomNumber || "").trim();
    if (!room) throw new Error("Room number is required.");
    const configured = roomList().find(r => r.number === room);
    if (!configured) throw new Error("That room is not in the configured available room ranges.");
    const targetFloor = String(floorNumber || configured.floor || "").trim();
    const occupancy = activeStudents().filter(x => x.permanentId !== permanentId && String(x.roomNumber || "") === room).length;
    if (occupancy >= getRoomCapacity()) throw new Error(`Room ${room} is full (${getRoomCapacity()} students).`);
    const previousRoom = s.roomNumber || "";
    s.roomNumber = room;
    s.floorNumber = targetFloor;
    s.bedNumber = "";
    addHistory("room_allocated", permanentId, { room, floor: targetFloor, previousRoom });
    persist();
    return deepClone(s);
  }

  function unallocateRoom(permanentId) {
    const s = findById(permanentId);
    if (!s || s.status !== "active") throw new Error("Active student not found.");
    const previousRoom = s.roomNumber || "";
    s.roomNumber = "";
    s.floorNumber = "";
    s.bedNumber = "";
    addHistory("room_unallocated", permanentId, { previousRoom });
    persist();
    return deepClone(s);
  }

  function updateFeePeriod(permanentId, feesStartDate, feeDurationMonths, feesEndDate = "") {
    const student = findById(permanentId);
    if (!student) throw new Error("Student not found.");
    const start = normalizeDateInput(feesStartDate);
    const months = Number(feeDurationMonths);
    const suppliedEnd = normalizeDateInput(feesEndDate);
    if (!start) throw new Error("Please enter a valid fee starting date.");
    if (!Number.isInteger(months) || months < 1 || months > 60) throw new Error("Fee duration must be between 1 and 60 months.");
    const calculatedEnd = addMonthsToDate(start, months);
    const end = suppliedEnd || calculatedEnd;
    if (!end || end < start) throw new Error("Fees ending date cannot be before the starting date.");
    const previous = { feesStartDate: student.feesStartDate, feeDurationMonths: student.feeDurationMonths, feesEndDate: student.feesEndDate };
    student.feesStartDate = start;
    student.feeDurationMonths = months;
    student.feesEndDate = end;
    addHistory("fee_period_updated", permanentId, { previous, next: { feesStartDate: start, feeDurationMonths: months, feesEndDate: end } });
    persist();
    return deepClone(student);
  }

  function addPayment(permanentId, amount, note = "", paymentDate = "", paymentMethod = "Cash") {
    const student = findById(permanentId);
    const value = Number(amount);
    const cleanDate = normalizeDateInput(paymentDate, new Date().toISOString().slice(0, 10));
    const cleanMethod = String(paymentMethod || "Cash").trim() || "Cash";

    if (!student || !Number.isFinite(value) || value <= 0) throw new Error("Invalid student or payment amount.");
    if (!cleanDate) throw new Error("Please enter a valid fee payment date.");

    const payment = {
      id: `HMS-PAY-${String(db.counters.nextPaymentSequence++).padStart(6, "0")}`,
      permanentId,
      amount: Math.round(value * 100) / 100,
      paymentDate: cleanDate,
      paymentMethod: cleanMethod,
      note: String(note || "").trim(),
      at: new Date().toISOString()
    };
    db.fees.push(payment);
    addHistory("fee_paid", permanentId, {
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod
    });
    persist();
    return deepClone(payment);
  }


  function feesFor(permanentId) {
    return db.fees.filter(p => p.permanentId === permanentId);
  }

  function accountFor(permanentId) {
    const account = db.accounts[permanentId];
    if (!account) return { permanentId, balance: 0, transactions: [] };
    return {
      permanentId,
      balance: Number(account.balance || 0),
      transactions: Array.isArray(account.transactions) ? account.transactions : []
    };
  }

  function addAccountTransaction(permanentId, amount, type = "deposit", note = "") {
    const s = findById(permanentId);
    const value = Number(amount);
    if (!s || !Number.isFinite(value) || value <= 0) throw new Error("Invalid student or account amount.");
    const normalizedType = type === "withdrawal" ? "withdrawal" : "deposit";
    if (!db.accounts[permanentId]) db.accounts[permanentId] = { balance: 0, transactions: [] };
    const current = Number(db.accounts[permanentId].balance || 0);
    if (normalizedType === "withdrawal" && value > current) throw new Error("Withdrawal cannot be greater than the current balance.");
    const transaction = {
      id: `HMS-ACC-${String(db.counters.nextPaymentSequence++).padStart(6, "0")}`,
      permanentId,
      type: normalizedType,
      amount: Math.round(value * 100) / 100,
      note: String(note || "").trim(),
      at: new Date().toISOString()
    };
    const nextBalance = normalizedType === "withdrawal" ? current - transaction.amount : current + transaction.amount;
    db.accounts[permanentId].balance = Math.round(nextBalance * 100) / 100;
    db.accounts[permanentId].transactions.unshift(transaction);
    addHistory(normalizedType === "withdrawal" ? "account_withdrawal" : "account_deposit", permanentId, { amount: transaction.amount, type: normalizedType });
    persist();
    return deepClone(transaction);
  }

  function attendanceFor(date) {
    // The selected date is intentionally ignored: the application keeps only
    // the latest/current attendance snapshot and overwrites it on every save.
    return db.attendance.current || {};
  }

  function currentAttendanceStatus(permanentId) {
    const value = (db.attendance.current || {})[permanentId];
    return value === "absent" ? "absent" : "present";
  }

  function saveAttendance(date, records) {
    const clean = {};
    Object.entries(records || {}).forEach(([id, value]) => {
      clean[id] = value === "absent" ? "absent" : "present";
    });
    db.attendance = {
      current: clean,
      lastSavedDate: date || new Date().toISOString().slice(0, 10),
      lastSavedAt: new Date().toISOString()
    };
    addHistory("attendance_saved", null, {
      date: db.attendance.lastSavedDate,
      mode: "overwrite_current_attendance"
    });
    persist();
  }

  function attendanceSummary() {
    const values = Object.values(db.attendance.current || {});
    let present = 0, absent = 0;
    values.forEach(v => {
      if (v === "absent") absent++;
      else present++;
    });
    return { dates: values.length ? 1 : 0, present, absent, leave: 0 };
  }

  function isFeeExpired(student, referenceDate = new Date().toISOString().slice(0, 10)) {
    return !!(student && student.feesEndDate && String(student.feesEndDate) < String(referenceDate));
  }

  function expiredFeeStudents(referenceDate = new Date().toISOString().slice(0, 10)) {
    return activeStudents().filter(student => isFeeExpired(student, referenceDate));
  }

  function statistics() {
    const active = activeStudents();
    const left = db.students.filter(s => s.status === "left");
    const paid = db.fees.reduce((a, p) => a + Number(p.amount || 0), 0);
    const rooms = new Set(active.filter(s => s.roomNumber).map(s => s.roomNumber));
    return {
      total: db.students.length,
      active: active.length,
      left: left.length,
      allocated: active.filter(s => s.roomNumber).length,
      unallocated: active.filter(s => !s.roomNumber).length,
      paid,
      rooms: rooms.size
    };
  }

  function exportDatabase() {
    return deepClone(db);
  }

  function validateBackup(data) {
    return !!(data && typeof data === "object" &&
      Array.isArray(data.students) &&
      data.counters &&
      typeof data.counters.nextStudentSequence === "number");
  }

  function importDatabase(data, mode = "replace") {
    if (!validateBackup(data)) throw new Error("Invalid Hostel Management backup file.");
    const incoming = ensureShape(data);
    if (mode === "merge") {
      const existingIds = new Set(db.students.map(s => s.permanentId));
      incoming.students.forEach(s => { if (!existingIds.has(s.permanentId)) db.students.push(s); });
      if (incoming.attendance && incoming.attendance.current) {
        db.attendance = deepClone(incoming.attendance);
      }
      db.fees.push(...incoming.fees.filter(p => !db.fees.some(x => x.id === p.id)));
      db.history.push(...incoming.history.filter(h => !db.history.some(x => x.id === h.id)));
      db.counters.nextStudentSequence = Math.max(db.counters.nextStudentSequence, incoming.counters.nextStudentSequence);
      persist();
    } else {
      db = incoming;
      persist();
    }
  }

  function clearDatabase() {
    db = defaultDB();
    persist();
  }

  window.HMSStorage = {
    KEY,
    init, getDatabase, updateDatabase,
    addStudent, updateStudent, findByRoll, findById, searchStudents,
    markLeft, restoreStudent, deleteStudent, updateFeePeriod,
    allocateRoom, unallocateRoom, getRoomCapacity, setRoomCapacity, roomRanges, addRoomRange, removeRoomRange, roomList, roomOccupancy, addPayment, feesFor, accountFor, addAccountTransaction,
    attendanceFor, saveAttendance, attendanceSummary, currentAttendanceStatus,
    activeStudents, formerStudents, nextRoll, isFeeExpired, expiredFeeStudents, statistics,
    getDefaultFeeDurationMonths: () => Number(db.settings.defaultFeeDurationMonths) || 6,
    calculateFeeEndDate: addMonthsToDate,
    exportDatabase, validateBackup, importDatabase, clearDatabase
  };

  init();
})();
