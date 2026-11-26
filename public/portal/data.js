// Data layer for the DEED staff portal.
// Uses Firebase (Auth + Firestore) when public/firebase-config.js is filled in,
// otherwise a demo mode with sample data so the portal can be previewed.

const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
const cfg = window.DEED_FIREBASE || {};
export const DEMO = !cfg.projectId || !cfg.apiKey;

export const ROLES = {
  admin: "Admin",
  manager: "Marketing Manager",
  officer: "Credit Officer"
};

export const STATUSES = [
  "New Lead", "Contact Attempted", "Contacted", "Interested", "Documents Pending",
  "Application Started", "Submitted for Assessment", "Approved",
  "Awaiting Customer Contribution", "Completed", "Not Eligible", "Lost", "Follow-Up Later"
];
export const OUTCOMES = ["Open", "Financed", "Not Eligible", "Lost", "Withdrawn"];
export const LOST_REASONS = ["Could not raise contribution", "Bought elsewhere", "Not reachable", "Changed mind", "Did not qualify", "Other"];

/* ================================================================== */
/* Firebase implementation                                             */
/* ================================================================== */
async function firebaseBackend() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js")
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  let me = null;

  const toDate = (v) => (v && typeof v.toDate === "function" ? v.toDate() : v || null);
  const norm = (snap) => {
    const d = snap.data();
    return { id: snap.id, ...d, createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt),
      assignedAt: toDate(d.assignedAt), lastContactAt: toDate(d.lastContactAt), nextFollowUp: toDate(d.nextFollowUp) };
  };

  async function loadMe(user) {
    const email = user.email.toLowerCase();
    const ref = F.doc(db, "staff", email);
    let snap;
    try { snap = await F.getDoc(ref); } catch (e) { snap = null; }
    if (!snap || !snap.exists()) {
      // First sign-in by the owner creates the first admin (allowed only for ownerEmails in the rules).
      try {
        await F.setDoc(ref, { name: user.displayName || email, role: "admin", active: true, addedBy: email, addedAt: F.serverTimestamp() });
        snap = await F.getDoc(ref);
      } catch (e) {
        return { email, name: user.displayName || email, photo: user.photoURL, authorised: false };
      }
    }
    const s = snap.data();
    return { email, name: s.name || user.displayName || email, photo: user.photoURL, role: s.role,
      authorised: s.active === true };
  }

  return {
    demo: false,
    onAuth(cb) {
      return A.onAuthStateChanged(auth, async (user) => {
        if (!user) { me = null; cb(null); return; }
        me = await loadMe(user);
        cb(me);
      });
    },
    async signIn() {
      const p = new A.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      try { await A.signInWithPopup(auth, p); }
      catch (e) {
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return A.signInWithRedirect(auth, p);
        throw e;
      }
    },
    signOut() { return A.signOut(auth); },
    watchLeads(cb, onErr) {
      const col = F.collection(db, "leads");
      const q = me.role === "officer" ? F.query(col, F.where("assignedTo", "==", me.email)) : col;
      return F.onSnapshot(q, (s) => cb(s.docs.map(norm)), onErr);
    },
    watchStaff(cb, onErr) {
      return F.onSnapshot(F.collection(db, "staff"), (s) => cb(s.docs.map((d) => ({ email: d.id, ...d.data() }))), onErr);
    },
    watchActivity(leadId, cb) {
      const q = F.query(F.collection(db, "leads", leadId, "activity"), F.orderBy("at", "desc"));
      return F.onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data(), at: toDate(d.data().at) }))), () => cb([]));
    },
    async updateLead(id, patch, activity) {
      const data = { ...patch, updatedAt: F.serverTimestamp(), updatedBy: me.email };
      if ("assignedTo" in patch) { data.assignedAt = F.serverTimestamp(); data.assignedBy = me.email; }
      for (const k of ["lastContactAt", "nextFollowUp"]) if (patch[k] instanceof Date) data[k] = F.Timestamp.fromDate(patch[k]);
      const batch = F.writeBatch(db);
      batch.update(F.doc(db, "leads", id), data);
      if (activity) batch.set(F.doc(F.collection(db, "leads", id, "activity")), { ...activity, by: me.email, byName: me.name, at: F.serverTimestamp() });
      await batch.commit();
    },
    addActivity(id, activity) {
      return F.addDoc(F.collection(db, "leads", id, "activity"), { ...activity, by: me.email, byName: me.name, at: F.serverTimestamp() });
    },
    saveStaff(email, data, isNew) {
      const payload = { name: data.name, role: data.role, active: data.active !== false, phone: data.phone || "" };
      if (isNew) { payload.addedBy = me.email; payload.addedAt = F.serverTimestamp(); }
      return F.setDoc(F.doc(db, "staff", email.toLowerCase()), payload, { merge: true });
    },
    removeStaff(email) { return F.deleteDoc(F.doc(db, "staff", email)); },
    watchPartners(cb, onErr) {
      return F.onSnapshot(F.collection(db, "partners"), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    },
    savePartner(id, data, isNew) {
      const payload = { name: data.name, location: data.location || "", contactName: data.contactName || "", contactPhone: data.contactPhone || "", active: data.active !== false };
      if (isNew) { payload.addedBy = me.email; payload.addedAt = F.serverTimestamp(); }
      return F.setDoc(F.doc(db, "partners", id), payload, { merge: true });
    },
    deleteLead(id) { return F.deleteDoc(F.doc(db, "leads", id)); }
  };
}

/* ================================================================== */
/* Demo implementation (no Firebase yet)                               */
/* ================================================================== */
function demoBackend() {
  const listeners = { leads: new Set(), staff: new Set(), act: new Map() };
  let me = null;
  const staff = [
    { email: "arnold@deed.example", name: "Arnold (you)", role: "admin", active: true },
    { email: "grace@deed.example", name: "Grace Namutebi", role: "manager", active: true },
    { email: "peter@deed.example", name: "Peter Okello", role: "officer", active: true },
    { email: "sarah@deed.example", name: "Sarah Achieng", role: "officer", active: true },
    { email: "david@deed.example", name: "David Mugisha", role: "officer", active: true }
  ];
  const names = ["John Ssempa", "Mary Nakato", "Brian Tumusiime", "Esther Akello", "Joseph Kato", "Ruth Nansubuga",
    "Moses Okot", "Agnes Babirye", "Isaac Mwesigwa", "Florence Atim", "Samuel Lubega", "Harriet Namuli",
    "Ronald Byaruhanga", "Juliet Auma", "Patrick Wasswa", "Doreen Kyomugisha", "Allan Opio", "Christine Nabirye",
    "Emmanuel Ochieng", "Winnie Nalwoga", "Denis Kiggundu", "Sharon Ainembabazi", "Henry Ojok", "Lydia Nankya"];
  const cars = [["Toyota Harrier", 48e6], ["Toyota Prado", 95e6], ["Subaru Forester", 38e6], ["Toyota Wish", 26e6],
    ["Toyota Premio", 32e6], ["Toyota Noah", 35e6], ["Mitsubishi RVR", 30e6], ["Toyota RAV4", 55e6], ["Nissan X-Trail", 42e6]];
  const sources = ["vehicle_sticker", "vehicle_sticker", "main_entrance", "showroom", "salesperson_01", "facebook", "deed_banner", "shared", "direct"];
  const areas = ["Kampala, Nakawa", "Wakiso, Kira", "Mukono", "Entebbe", "Kampala, Ntinda", "Jinja", "Kampala, Rubaga", "Wakiso, Nansana"];
  const flow = ["New Lead", "New Lead", "New Lead", "Contact Attempted", "Contacted", "Interested", "Documents Pending",
    "Application Started", "Submitted for Assessment", "Approved", "Completed", "Completed", "Lost", "Follow-Up Later", "Not Eligible"];
  const officers = staff.filter((s) => s.role === "officer");
  const partners = [
    { id: "banda_bond", name: "Banda Bond", location: "Banda, Kampala", contactName: "", contactPhone: "", active: true },
    { id: "example_bond", name: "Example Bond (demo)", location: "Kampala", contactName: "", contactPhone: "", active: true }
  ];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const now = Date.now();
  const leads = names.map((n, i) => {
    const [vehicle, price] = pick(cars);
    const status = i < 4 ? "New Lead" : pick(flow);
    const assigned = status === "New Lead" && i < 4 ? null : pick(officers);
    const created = new Date(now - (i * 0.6 + rnd() * 1.5) * 86400000);
    const outcome = status === "Completed" ? "Financed" : status === "Lost" ? "Lost" : status === "Not Eligible" ? "Not Eligible" : "Open";
    const attempts = status === "New Lead" ? 0 : 1 + Math.floor(rnd() * 3);
    return {
      partnerId: i % 4 === 1 ? "example_bond" : "banda_bond", partnerName: i % 4 === 1 ? "Example Bond (demo)" : "Banda Bond",
      id: "demo" + i, seq: names.length - i, ref: "VFC-2026-" + String(names.length - i).padStart(4, "0"),
      leadType: i % 7 === 3 ? "Call-back request" : "Application", source: pick(sources), fullName: n,
      phone: "+2567" + String(70000000 + Math.floor(rnd() * 9999999)).padStart(8, "0"), contactMethod: pick(["Call", "WhatsApp", "Either"]),
      area: pick(areas), vehicle, vehiclePrice: price, fromPartner: pick(["Yes", "Yes", "Still deciding", "No"]),
      canRaise: pick(["Yes", "Partially", "Not yet, but interested"]), availableContribution: Math.round(price * (0.15 + rnd() * 0.2) / 1e5) * 1e5,
      timeline: pick(["Within 2 weeks", "Within 1 month", "In 1 to 3 months"]), incomeSource: pick(["Employed", "Business owner", "Self-employed"]),
      contactTime: pick(["Morning", "Afternoon", "Evening"]), wantsContact: "Yes", consent: "Yes",
      questions: i % 5 === 0 ? "What documents do I need? Can I pay over 3 years?" : "",
      status, outcome, contactAttempts: attempts, createdAt: created,
      assignedTo: assigned ? assigned.email : null, assignedName: assigned ? assigned.name : null,
      lastContactAt: attempts ? new Date(created.getTime() + 3600000 * 5) : null,
      nextFollowUp: outcome === "Open" && status !== "New Lead" ? new Date(now + (rnd() * 6 - 2.5) * 86400000) : null,
      loanAppStarted: ["Application Started", "Submitted for Assessment", "Approved", "Completed"].includes(status) ? "Yes" : "No",
      loanAppRef: "", lostReason: status === "Lost" ? "Bought elsewhere" : ""
    };
  });
  const activity = new Map();
  leads.forEach((l) => {
    if (!l.assignedTo) return;
    activity.set(l.id, [
      { id: "a2", type: "call", text: "Called. Customer interested, will visit the bond on Saturday.", byName: l.assignedName, at: new Date(l.createdAt.getTime() + 18000000) },
      { id: "a1", type: "assign", text: "Assigned to " + l.assignedName, byName: "Grace Namutebi", at: new Date(l.createdAt.getTime() + 1800000) }
    ]);
  });

  const visibleLeads = () => (me.role === "officer" ? leads.filter((l) => l.assignedTo === me.email) : leads).map((l) => ({ ...l }));
  listeners.partners = new Set();
  const emit = () => {
    listeners.partners.forEach((cb) => cb(partners.map((p) => ({ ...p }))));
    listeners.leads.forEach((cb) => cb(visibleLeads()));
    listeners.staff.forEach((cb) => cb(staff.map((s) => ({ ...s }))));
  };
  let authCb = null;
  return {
    demo: true,
    staffList: staff,
    onAuth(cb) { authCb = cb; setTimeout(() => cb(null), 50); return () => {}; },
    async signIn(asEmail) {
      const s = staff.find((x) => x.email === (asEmail || staff[0].email));
      me = { email: s.email, name: s.name, role: s.role, authorised: true, photo: null };
      authCb(me);
    },
    async signOut() { me = null; authCb(null); },
    watchLeads(cb) { listeners.leads.add(cb); cb(visibleLeads()); return () => listeners.leads.delete(cb); },
    watchStaff(cb) { listeners.staff.add(cb); cb(staff.map((s) => ({ ...s }))); return () => listeners.staff.delete(cb); },
    watchActivity(id, cb) {
      const run = () => cb([...(activity.get(id) || [])]);
      listeners.act.set(id, run); run();
      return () => listeners.act.delete(id);
    },
    async updateLead(id, patch, act) {
      const l = leads.find((x) => x.id === id);
      Object.assign(l, patch, { updatedAt: new Date(), updatedBy: me.email });
      if (act) this.addActivity(id, act);
      emit();
    },
    async addActivity(id, act) {
      const list = activity.get(id) || [];
      list.unshift({ id: "x" + Date.now(), ...act, byName: me.name, at: new Date() });
      activity.set(id, list);
      const run = listeners.act.get(id); if (run) run();
    },
    async saveStaff(email, data) {
      const s = staff.find((x) => x.email === email);
      if (s) Object.assign(s, data); else staff.push({ email, ...data, active: data.active !== false });
      emit();
    },
    watchPartners(cb) { listeners.partners.add(cb); cb(partners.map((p) => ({ ...p }))); return () => listeners.partners.delete(cb); },
    async savePartner(id, data) {
      const p = partners.find((x) => x.id === id);
      if (p) Object.assign(p, data); else partners.push({ id, ...data, active: data.active !== false });
      emit();
    },
    async removeStaff(email) { const i = staff.findIndex((x) => x.email === email); if (i > -1) staff.splice(i, 1); emit(); },
    async deleteLead(id) { const i = leads.findIndex((x) => x.id === id); if (i > -1) leads.splice(i, 1); emit(); }
  };
}

export async function createBackend() {
  return DEMO ? demoBackend() : firebaseBackend();
}
