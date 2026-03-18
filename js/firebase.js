// ─── FIRESTORE HELPERS (per-user) ───
function userCol(uid, col) { return window.db.collection("users").doc(uid).collection(col); }

async function loadClassesFromDB(uid) {
  try {
    const snap = await userCol(uid, "classes").orderBy("order").get();
    if (snap.empty) return loadClasses();
    return snap.docs.map(d => d.data());
  } catch(e) {
    console.warn("Firestore read failed:", e);
    return loadClasses();
  }
}

async function saveClassesToDB(uid, classes) {
  try {
    const col = userCol(uid, "classes");

    // Lấy tất cả doc hiện có trên Firestore
    const existing = await col.get();
    const existingIds = new Set(existing.docs.map(d => d.id));
    const newIds = new Set(classes.map(c => c.id));

    const batch = window.db.batch();

    // Xóa document không còn trong danh sách mới
    existing.docs.forEach(d => {
      if (!newIds.has(d.id)) {
        batch.delete(col.doc(d.id));
      }
    });

    // Ghi/cập nhật các document mới
    classes.forEach((cls, idx) => {
      batch.set(col.doc(cls.id), { ...cls, order: idx });
    });

    await batch.commit();
    saveClasses(classes);
  } catch(e) {
    console.warn("Firestore write failed:", e);
    saveClasses(classes);
  }
}

async function loadPaidFromDB(uid, classId, year, month) {
  try {
    const docId = `${classId}_${year}_${month}`;
    const doc = await userCol(uid, "paid").doc(docId).get();
    if (doc.exists) return doc.data();
    return loadPaid(classId, year, month);
  } catch(e) { return loadPaid(classId, year, month); }
}

async function savePaidToDB(uid, classId, year, month, map) {
  try {
    const docId = `${classId}_${year}_${month}`;
    // Chỉ lưu các id có giá trị true — Firestore không xử lý tốt boolean false
    const cleanMap = {};
    Object.entries(map).forEach(([k, v]) => { if (v === true) cleanMap[k] = true; });
    await userCol(uid, "paid").doc(docId).set(cleanMap);
    savePaid(classId, year, month, map);
  } catch(e) {
    console.warn("savePaidToDB error:", e);
    savePaid(classId, year, month, map);
  }
}

async function loadProfileFromDB(uid) {
  try {
    const doc = await userCol(uid, "settings").doc("profile").get();
    if (doc.exists) return { ...DEFAULT_PROFILE, ...doc.data() };
    return loadProfile();
  } catch(e) { return loadProfile(); }
}

async function saveProfileToDB(uid, profile) {
  await userCol(uid, "settings").doc("profile").set(profile);
  saveProfile(profile);
}

function loadClasses() {
  try { return JSON.parse(localStorage.getItem(LS_CLASS)) || []; } catch { return []; }
}
function saveClasses(cls) {
  try { localStorage.setItem(LS_CLASS, JSON.stringify(cls)); } catch {}
}
function loadPaid(classId, year, month) {
  const key = `${LS_PAID_PREFIX}${classId}_${year}_${month}`;
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function savePaid(classId, year, month, map) {
  const key = `${LS_PAID_PREFIX}${classId}_${year}_${month}`;
  try { localStorage.setItem(key, JSON.stringify(map)); } catch {}
}

const LS_PROFILE = "diemdanh_profile_v1";
const DEFAULT_PROFILE = { teacherName: "", phone: "", bank: "", account: "", owner: "", qrDataUrl: "", logoDataUrl: "", passcode: "" };
function loadProfile() { try { return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(LS_PROFILE)) }; } catch { return DEFAULT_PROFILE; } }
function saveProfile(p) { try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch {} }

// ─────────────────────────────────────────────────────────────────

// ─── ALLOWED EMAILS (whitelist) ───
const SUPER_ADMIN = "edumanagement68@gmail.com";

async function loadAllowedEmails() {
  try {
    const snap = await window.db.collection("allowedEmails").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

async function addAllowedEmail(email, addedBy) {
  try {
    const id = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    await window.db.collection("allowedEmails").doc(id).set({
      email: email.toLowerCase(),
      addedBy,
      addedAt: new Date().toISOString()
    });
    return true;
  } catch(e) { return false; }
}

async function removeAllowedEmail(email) {
  try {
    const id = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
    await window.db.collection("allowedEmails").doc(id).delete();
    return true;
  } catch(e) { return false; }
}

async function isEmailAllowed(email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (lower === SUPER_ADMIN) return true;
  try {
    const id = lower.replace(/[^a-z0-9]/g, "_");
    const doc = await window.db.collection("allowedEmails").doc(id).get();
    return doc.exists;
  } catch(e) { return false; }
}

// ─── CREATE / DELETE USER (Admin) ───
async function adminCreateUser(email, password) {
  const apiKey = "AIzaSyApsLv_N7Je30jz6CRxKX8PmsHyEY5Z4h0";
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data; // contains localId (uid) and idToken
}

async function adminDeleteUser(uid, adminIdToken) {
  // Dùng idToken của admin để xóa user bằng uid
  const apiKey = "AIzaSyApsLv_N7Je30jz6CRxKX8PmsHyEY5Z4h0";
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`;
  // Firebase REST API chỉ cho user tự xóa mình — cần dùng cách khác:
  // Lưu idToken của user mới tạo ngay lúc tạo, dùng nó để xóa
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: adminIdToken })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return true;
}

// Lưu thông tin user vào allowedEmails kèm password hint (encrypted nhẹ)
function obfuscate(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function deobfuscate(str) {
  try { return decodeURIComponent(escape(atob(str))); } catch { return ""; }
}

async function addUserAccount(email, password, addedBy, uid, idToken) {
  const id = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
  await window.db.collection("allowedEmails").doc(id).set({
    email: email.toLowerCase(),
    pwd: obfuscate(password),
    uid: uid || "",
    idToken: idToken || "", // lưu để xóa sau (token ngắn hạn — chỉ dùng ngay)
    addedBy,
    addedAt: new Date().toISOString()
  });
}

// ─── TIMETABLE ───
async function loadTimetableFromDB(uid) {
  try {
    const doc = await userCol(uid, "settings").doc("timetable").get();
    if (doc.exists) return doc.data().entries || [];
    return [];
  } catch(e) { return []; }
}

async function saveTimetableToDB(uid, entries) {
  try {
    await userCol(uid, "settings").doc("timetable").set({ entries });
  } catch(e) { console.warn("Timetable save failed:", e); }
}