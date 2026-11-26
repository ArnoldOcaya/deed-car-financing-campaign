// Security rules tests. Run: cd tests && npm install && npm test (needs Java for the emulator).
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, collection, runTransaction, serverTimestamp, setDoc, getDoc, getDocs, query, where, updateDoc, addDoc, writeBatch } from "firebase/firestore";

const env = await initializeTestEnvironment({ projectId: "demo-deed", firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8").replace(/\['admin@example\.com'\]/, "['owner@test.com']"), host: "127.0.0.1", port: 8085 } });
let pass = 0, failN = 0;
async function t(name, p) { try { await p; pass++; console.log("ok  ", name); } catch (e) { failN++; console.log("FAIL", name, e.message.split("\n")[0]); } }
const user = (email) => env.authenticatedContext(email, { email, email_verified: true }).firestore();
const pub = env.unauthenticatedContext().firestore();

function lead(extra = {}) {
  return { leadType: "Application", source: "vehicle_sticker", partnerId: "banda_bond", partnerName: "Banda Bond", fullName: "Jane Doe", phone: "+256772123456",
    contactMethod: "WhatsApp", area: "Kampala", vehicle: "Toyota Harrier", vehiclePrice: 30000000, availableContribution: 7000000, consent: "Yes",
    status: "New Lead", outcome: "Open", assignedTo: null, contactAttempts: 0, ...extra };
}
async function submit(db, extra = {}, seqOverride) {
  return runTransaction(db, async (tx) => {
    const c = doc(db, "counters", "leads"); const s = await tx.get(c);
    const n = (s.exists() ? s.data().n : 0) + 1;
    const l = doc(collection(db, "leads"));
    const seq = seqOverride || n;
    tx.set(l, { ...lead(extra), seq, ref: "DEEDVFC-2026-" + String(seq).padStart(4, "0"), createdAt: serverTimestamp() });
    tx.set(c, { n, lastLead: l.id });
    return l.id;
  });
}

await t("public submits first lead", assertSucceeds(submit(pub)));
await t("public submits second lead", assertSucceeds(submit(pub)));
await t("public callback lead without vehicle", assertSucceeds(runTransaction(pub, async (tx) => {
  const c = doc(pub, "counters", "leads"); const s = await tx.get(c); const n = s.data().n + 1; const l = doc(collection(pub, "leads"));
  const { vehicle, vehiclePrice, availableContribution, ...rest } = lead({ leadType: "Call-back request", contactTime: "Morning" });
  tx.set(l, { ...rest, seq: n, ref: "VFC-2026-" + String(n).padStart(4, "0"), createdAt: serverTimestamp() }); tx.set(c, { n, lastLead: l.id });
})));
await t("application without vehicle rejected", assertFails(runTransaction(pub, async (tx) => {
  const c = doc(pub, "counters", "leads"); const s = await tx.get(c); const n = s.data().n + 1; const l = doc(collection(pub, "leads"));
  const { vehicle, vehiclePrice, ...rest } = lead();
  tx.set(l, { ...rest, seq: n, ref: "VFC-2026-" + String(n).padStart(4, "0"), createdAt: serverTimestamp() }); tx.set(c, { n, lastLead: l.id });
})));
await t("public cannot fake status", assertFails(submit(pub, { status: "Approved" })));
await t("public cannot pre-assign", assertFails(submit(pub, { assignedTo: "x@y.com" })));
await t("public cannot add unknown field", assertFails(submit(pub, { hacked: true })));
await t("public cannot use wrong seq", assertFails(submit(pub, {}, 99)));
await t("public bad phone rejected", assertFails(submit(pub, { phone: "12345" })));
await t("public no consent rejected", assertFails(submit(pub, { consent: "No" })));
await t("public lead without counter rejected", assertFails(setDoc(doc(pub, "leads", "x1"), { ...lead(), seq: 3, ref: "VFC-2026-0003", createdAt: serverTimestamp() })));
await t("public cannot read leads", assertFails(getDocs(collection(pub, "leads"))));
await t("public cannot bump counter alone", assertFails(setDoc(doc(pub, "counters", "leads"), { n: 50, lastLead: "zzz" })));

const owner = user("owner@test.com"), stranger = user("bob@test.com");
await t("stranger cannot self-register", assertFails(setDoc(doc(stranger, "staff", "bob@test.com"), { name: "Bob", role: "admin", active: true })));
await t("owner bootstraps admin", assertSucceeds(setDoc(doc(owner, "staff", "owner@test.com"), { name: "Owner", role: "admin", active: true, addedBy: "owner@test.com", addedAt: serverTimestamp() })));
await t("admin adds own phone", assertSucceeds(setDoc(doc(owner, "staff", "owner@test.com"), { name: "Owner", role: "admin", active: true, phone: "+256758511610" }, { merge: true })));
await t("staff without phone rejected", assertFails(setDoc(doc(owner, "staff", "nophone@test.com"), { name: "No Phone", role: "officer", active: true })));
await t("staff with bad phone rejected", assertFails(setDoc(doc(owner, "staff", "badphone@test.com"), { name: "Bad Phone", role: "officer", active: true, phone: "0772" })));
await t("unknown role rejected", assertFails(setDoc(doc(owner, "staff", "x@test.com"), { name: "X", role: "superuser", active: true, phone: "+256772000001" })));
await t("admin adds director", assertSucceeds(setDoc(doc(owner, "staff", "dir@test.com"), { name: "Dir", role: "director", active: true, phone: "+256772000002" })));
await t("admin adds marketing officer", assertSucceeds(setDoc(doc(owner, "staff", "mkt@test.com"), { name: "Mkt", role: "marketing", active: true, phone: "+256772000003" })));
await t("admin adds manager", assertSucceeds(setDoc(doc(owner, "staff", "mgr@test.com"), { name: "Mgr", role: "manager", active: true, phone: "+256772000004" })));
await t("admin adds officer", assertSucceeds(setDoc(doc(owner, "staff", "off@test.com"), { name: "Off", role: "officer", active: true, phone: "+256772000005" })));
await t("admin adds officer 2", assertSucceeds(setDoc(doc(owner, "staff", "off2@test.com"), { name: "Off2", role: "officer", active: true, phone: "+256772000006" })));
await t("admin cannot demote self", assertFails(setDoc(doc(owner, "staff", "owner@test.com"), { name: "Owner", role: "officer", active: true, phone: "+256758511610" })));
await t("stranger still denied leads", assertFails(getDocs(collection(stranger, "leads"))));

const mgr = user("mgr@test.com"), off = user("off@test.com"), off2 = user("off2@test.com");
await t("manager cannot add staff", assertFails(setDoc(doc(mgr, "staff", "x@test.com"), { name: "X", role: "officer", active: true, phone: "+256772000007" })));
const dir = user("dir@test.com"), mkt = user("mkt@test.com");
await t("director lists all leads", assertSucceeds(getDocs(collection(dir, "leads"))));
await t("marketing officer lists all leads", assertSucceeds(getDocs(collection(mkt, "leads"))));
await t("director cannot add staff", assertFails(setDoc(doc(dir, "staff", "y@test.com"), { name: "Y", role: "officer", active: true, phone: "+256772000008" })));
let ids = [];
await t("manager lists all leads", (async () => { const s = await assertSucceeds(getDocs(collection(mgr, "leads"))); ids = s.docs.map((d) => d.id); if (ids.length < 2) throw new Error("expected leads, got " + ids.length); })());
await t("manager assigns to officer", assertSucceeds(updateDoc(doc(mgr, "leads", ids[0]), { assignedTo: "off@test.com", assignedName: "Off", assignedAt: serverTimestamp(), assignedBy: "mgr@test.com", updatedAt: serverTimestamp(), updatedBy: "mgr@test.com" })));
await t("manager cannot assign to non-staff", assertFails(updateDoc(doc(mgr, "leads", ids[1]), { assignedTo: "nobody@test.com", assignedBy: "mgr@test.com", updatedBy: "mgr@test.com" })));
await t("manager cannot edit customer phone", assertFails(updateDoc(doc(mgr, "leads", ids[0]), { phone: "+256700000000", updatedBy: "mgr@test.com" })));
await t("director cannot assign", assertFails(updateDoc(doc(dir, "leads", ids[1]), { assignedTo: "off@test.com", assignedBy: "dir@test.com", updatedBy: "dir@test.com" })));
await t("marketing officer cannot change status", assertFails(updateDoc(doc(mkt, "leads", ids[1]), { status: "Lost", updatedBy: "mkt@test.com" })));
await t("director reads activity", assertSucceeds(getDocs(collection(dir, "leads", ids[0], "activity"))));
await t("director cannot add notes", assertFails(addDoc(collection(dir, "leads", ids[0], "activity"), { type: "note", text: "hi", by: "dir@test.com", byName: "Dir", at: serverTimestamp() })));
await t("officer lists own leads", assertSucceeds(getDocs(query(collection(off, "leads"), where("assignedTo", "==", "off@test.com")))));
await t("officer cannot list all", assertFails(getDocs(collection(off, "leads"))));
await t("officer cannot read unassigned lead", assertFails(getDoc(doc(off, "leads", ids[1]))));
await t("other officer cannot read it", assertFails(getDoc(doc(off2, "leads", ids[0]))));
await t("officer updates status", assertSucceeds(updateDoc(doc(off, "leads", ids[0]), { status: "Contacted", contactAttempts: 1, lastContactAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: "off@test.com" })));
await t("officer cannot reassign", assertFails(updateDoc(doc(off, "leads", ids[0]), { assignedTo: "off2@test.com", updatedBy: "off@test.com" })));
await t("officer cannot fake updatedBy", assertFails(updateDoc(doc(off, "leads", ids[0]), { status: "Lost", updatedBy: "mgr@test.com" })));
await t("officer adds note", assertSucceeds(addDoc(collection(off, "leads", ids[0], "activity"), { type: "note", text: "hi", by: "off@test.com", byName: "Off", at: serverTimestamp() })));
await t("officer2 cannot add note", assertFails(addDoc(collection(off2, "leads", ids[0], "activity"), { type: "note", text: "hi", by: "off2@test.com", byName: "Off2", at: serverTimestamp() })));
await t("batch update + activity (portal pattern)", assertSucceeds((async () => { const b = writeBatch(off); b.update(doc(off, "leads", ids[0]), { status: "Interested", updatedAt: serverTimestamp(), updatedBy: "off@test.com" }); b.set(doc(collection(off, "leads", ids[0], "activity")), { type: "status", text: "x", by: "off@test.com", byName: "Off", at: serverTimestamp() }); await b.commit(); })()));
await t("officer cannot delete lead", assertFails((async () => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(doc(off, "leads", ids[0])); })()));
await t("public reads partner", assertSucceeds((async () => { await setDoc(doc(owner, "partners", "banda_bond"), { name: "Banda Bond", location: "Banda", active: true }); await getDoc(doc(pub, "partners", "banda_bond")); })()));
await t("manager cannot add partner", assertFails(setDoc(doc(mgr, "partners", "x_bond"), { name: "X Bond", active: true })));
await t("deactivated officer loses access", (async () => { await setDoc(doc(owner, "staff", "off@test.com"), { name: "Off", role: "officer", active: false, phone: "+256772000005" }); await assertFails(getDocs(query(collection(off, "leads"), where("assignedTo", "==", "off@test.com")))); })());
console.log(`\n${pass} passed, ${failN} failed`);
await env.cleanup();
process.exit(failN ? 1 : 0);
