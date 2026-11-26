import { createBackend, ROLES, ROLE_INFO, STATUSES, OUTCOMES, LOST_REASONS, normalizeUgPhone } from "./data.js";

const site = window.DEED_CONFIG || {};
const PCT = Number(site.CONTRIBUTION_PCT) || 30;
const app = document.getElementById("app");
const drawerRoot = document.getElementById("drawer-root");
const modalRoot = document.getElementById("modal-root");

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ugx = (n) => (n || n === 0 ? Math.round(n).toLocaleString("en-US") : "—");
const short = (n) => (!n ? "0" : n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B" : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n));
const initials = (s) => String(s || "?").replace(/\(.*?\)/g, "").split(/[^A-Za-zÀ-ɏ]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const isoDate = (d) => { if (!d) return ""; const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
function ago(d) {
  if (!d) return "";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
function slugify(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60); }
const waDigits = (p) => String(p || "").replace(/\D/g, "");

let toastT;
function toast(msg, err) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2800);
}
function fail(e) { console.error(e); toast(e && e.code === "permission-denied" ? "You don't have permission to do that." : "Something went wrong. Please try again.", true); }

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  car: '<path d="M5 17h14M6 17v2M18 17v2M3 13l2-6a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 7l2 6v4H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z"/>',
  note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>'
};
const icon = (n, cls = "icon") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ""}</svg>`;

function statusClass(s) {
  if (s === "New Lead") return "s-new";
  if (["Completed", "Approved"].includes(s)) return "s-won";
  if (["Lost", "Not Eligible"].includes(s)) return "s-lost";
  if (["Interested", "Documents Pending", "Application Started", "Submitted for Assessment", "Awaiting Customer Contribution"].includes(s)) return "s-hot";
  return "s-progress";
}
const pill = (s) => `<span class="pill ${statusClass(s)}">${esc(s)}</span>`;
const CONTACTED = new Set(STATUSES.filter((s) => !["New Lead", "Contact Attempted"].includes(s)));
const INTERESTED = new Set(["Interested", "Documents Pending", "Application Started", "Submitted for Assessment", "Approved", "Awaiting Customer Contribution", "Completed"]);
const APPROVED = new Set(["Approved", "Awaiting Customer Contribution", "Completed"]);
function followState(l) {
  if (!l.nextFollowUp || l.outcome !== "Open") return "";
  const t = dayStart(new Date()).getTime(), d = dayStart(l.nextFollowUp).getTime();
  return d < t ? "overdue" : d === t ? "today" : "";
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
const S = {
  be: null, me: null, leads: [], staff: [], partners: [], unsub: [],
  route: "dashboard", openLead: null,
  filter: { chip: "all", q: "", status: "", officer: "", partner: "", source: "" },
  selected: new Set()
};
const isManager = () => S.me && (S.me.role === "admin" || S.me.role === "manager");
const isAdmin = () => S.me && S.me.role === "admin";
// Director, marketing team and admin see every lead; only admin and marketing managers assign.
const canViewAll = () => S.me && S.me.role !== "officer";
const canEditLead = (l) => isManager() || (S.me && l.assignedTo === S.me.email);
const officers = () => S.staff.filter((s) => s.active !== false && (s.role === "officer" || s.role === "manager")).sort((a, b) => (a.role === "officer" ? -1 : 1) - (b.role === "officer" ? -1 : 1) || a.name.localeCompare(b.name));
const staffName = (email) => (S.staff.find((s) => s.email === email) || {}).name || email || "Unassigned";
const partnerName = (l) => l.partnerName || (S.partners.find((p) => p.id === l.partnerId) || {}).name || "";

/* ------------------------------------------------------------------ */
/* Boot & auth                                                         */
/* ------------------------------------------------------------------ */
(async function boot() {
  try {
    S.be = await createBackend();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="boot"><p class="login-err">Could not load the portal. Check your connection and reload.</p></div>`;
    return;
  }
  S.be.onAuth((me) => {
    S.unsub.forEach((u) => u && u()); S.unsub = [];
    S.me = me;
    if (!me) return renderLogin();
    if (!me.authorised) return renderDenied();
    subscribe();
    window.addEventListener("hashchange", onRoute);
    onRoute();
  });
})();

function subscribe() {
  const err = (e) => fail(e);
  S.unsub.push(S.be.watchLeads((l) => { S.leads = l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); render(); refreshDrawer(); }, err));
  S.unsub.push(S.be.watchStaff((s) => { S.staff = s; render(); }, err));
  S.unsub.push(S.be.watchPartners((p) => { S.partners = p.sort((a, b) => a.name.localeCompare(b.name)); render(); }, err));
}

function renderLogin(errMsg) {
  const demo = S.be.demo;
  app.innerHTML = `
  <div class="login">
    <div class="login-art">
      <img src="../img/deed-emblem.png" alt="" width="56" height="56" style="background:#fff;border-radius:14px;padding:4px">
      <div>
        <h2>Drive Your Dream. Pay 30%.</h2>
        <p>Vehicle financing campaign portal. Track every lead from QR scan to vehicle release.</p>
      </div>
      <small style="opacity:.6">DEED Microfinance · We Care About Your Growth</small>
      <div class="stripe"></div>
    </div>
    <div class="login-pane">
      <div class="login-card">
        <img src="../img/deed-logo.png" alt="DEED Microfinance">
        <h1>Staff portal</h1>
        <p class="muted">Sign in with the Google account your admin added to the team.</p>
        ${demo ? "" : `<button class="btn btn-lg google" id="google-in">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continue with Google</button>`}
        ${errMsg ? `<p class="login-err">${esc(errMsg)}</p>` : ""}
        ${demo ? `<div class="demo-box"><strong>Preview mode</strong><span class="muted">Firebase isn't connected yet, so this uses sample data. Pick a role to see what each person sees.</span>
          <button class="btn" data-demo="arnold@deed.example">${icon("user")} Admin (Arnold)</button>
          <button class="btn" data-demo="director@deed.example">${icon("trend")} Director</button>
          <button class="btn" data-demo="grace@deed.example">${icon("users")} Marketing Manager</button>
          <button class="btn" data-demo="brenda@deed.example">${icon("chat")} Marketing Officer</button>
          <button class="btn" data-demo="peter@deed.example">${icon("car")} Credit Officer</button></div>` : ""}
      </div>
    </div>
  </div>`;
  const g = document.getElementById("google-in");
  if (g) g.onclick = async () => {
    g.disabled = true;
    try { await S.be.signIn(); } catch (e) {
      g.disabled = false;
      if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") renderLogin("Sign-in failed. Please try again.");
    }
  };
  app.querySelectorAll("[data-demo]").forEach((b) => (b.onclick = () => S.be.signIn(b.dataset.demo)));
}

function renderDenied() {
  app.innerHTML = `<div class="login"><div class="login-pane" style="grid-column:1/-1"><div class="login-card">
    <img src="../img/deed-logo.png" alt="DEED Microfinance">
    <h1>Access needed</h1>
    <p class="muted">You're signed in as <b>${esc(S.me.email)}</b>, but this account isn't on the DEED team yet. Ask your admin to add this email in <b>Team</b>.</p>
    <button class="btn btn-lg" id="out">${icon("out")} Use another account</button></div></div></div>`;
  document.getElementById("out").onclick = () => S.be.signOut();
}

/* ------------------------------------------------------------------ */
/* Routing & shell                                                     */
/* ------------------------------------------------------------------ */
function onRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  const [route, id] = h.split("/");
  const allowed = ["dashboard", "leads"].concat(isAdmin() ? ["team", "partners"] : []);
  S.route = allowed.includes(route) ? route : "dashboard";
  S.openLead = S.route === "leads" && id ? decodeURIComponent(id) : null;
  render();
  renderDrawer();
}
const go = (r) => { location.hash = "#/" + r; };

function navItems() {
  const unassigned = S.leads.filter((l) => !l.assignedTo && l.outcome === "Open").length;
  const mine = S.leads.filter((l) => followState(l) === "overdue" || followState(l) === "today").length;
  const items = [
    { r: "dashboard", label: "Dashboard", ic: "home" },
    { r: "leads", label: "Leads", ic: "list", count: canViewAll() ? unassigned : mine }
  ];
  if (isAdmin()) items.push({ r: "partners", label: "Partner bonds", ic: "building" }, { r: "team", label: "Team", ic: "users" });
  return items;
}

function render() {
  if (!S.me || !S.me.authorised) return;
  const titles = { dashboard: "Dashboard", leads: "Leads", team: "Team", partners: "Partner bonds" };
  const nav = navItems();
  const demoBar = S.be.demo ? `<div class="demo-banner">${icon("alert")}<span><b>Preview mode</b> with sample data. Connect Firebase to go live.</span>
    <label>View as <select id="demo-role">${S.be.staffList.map((s) => `<option value="${esc(s.email)}" ${s.email === S.me.email ? "selected" : ""}>${esc(s.name)} · ${esc(ROLES[s.role])}</option>`).join("")}</select></label></div>` : "";
  const scrollY = window.scrollY;
  const focusId = document.activeElement && document.activeElement.id;
  const caret = document.activeElement && document.activeElement.selectionStart;
  app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand"><img src="../img/deed-emblem.png" alt=""><div><b>DEED Portal</b><small>Vehicle financing</small></div></div>
      <nav class="nav">${nav.map((n) => `<a href="#/${n.r}" class="${S.route === n.r ? "active" : ""}">${icon(n.ic)}${n.label}${n.count ? `<span class="count">${n.count}</span>` : ""}</a>`).join("")}</nav>
      <div class="foot">DEED Microfinance<br>We Care About Your Growth</div>
    </aside>
    <div class="main">
      ${demoBar}
      ${!S.me.phone && isAdmin() ? `<div class="demo-banner" style="background:var(--red-50);color:var(--red);border-color:#f6c9cb">${icon("phone")}<span><b>Add your phone number.</b> Every team member needs one on the system.</span><button class="btn btn-sm btn-red" id="add-my-phone">Add phone</button></div>` : ""}
      <header class="topbar">
        <img class="mlogo" src="../img/deed-emblem.png" alt="">
        <h1>${titles[S.route]}</h1>
        <button class="user-chip" id="me-chip" title="Sign out">
          <span class="avatar">${S.me.photo ? `<img src="${esc(S.me.photo)}" alt="" referrerpolicy="no-referrer">` : esc(initials(S.me.name))}</span>
          <span class="who"><b>${esc(S.me.name)}</b><small>${esc(ROLES[S.me.role] || "")}</small></span>
          ${icon("out")}
        </button>
      </header>
      <div class="content">${S.route === "dashboard" ? viewDashboard() : S.route === "leads" ? viewLeads() : S.route === "team" ? viewTeam() : viewPartners()}</div>
    </div>
    <nav class="bottom-nav">${nav.map((n) => `<a href="#/${n.r}" class="${S.route === n.r ? "active" : ""}">${icon(n.ic)}${n.label.replace("Partner bonds", "Bonds")}</a>`).join("")}</nav>
  </div>`;
  window.scrollTo(0, scrollY);
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) {} } }
  bindShell();
}

function bindShell() {
  document.getElementById("me-chip").onclick = () => { if (confirmBox("Sign out of the DEED portal?")) S.be.signOut(); };
  const myPhone = document.getElementById("add-my-phone");
  if (myPhone) myPhone.onclick = () => personModal(S.staff.find((x) => x.email === S.me.email) || { email: S.me.email, name: S.me.name, role: S.me.role, active: true }, true);
  const dr = document.getElementById("demo-role");
  if (dr) dr.onchange = () => { S.be.signOut().then(() => S.be.signIn(dr.value)); };
  if (S.route === "leads") bindLeads();
  if (S.route === "team") bindTeam();
  if (S.route === "partners") bindPartners();
  app.querySelectorAll("[data-go]").forEach((el) => (el.onclick = () => { if (el.dataset.chip) S.filter = { ...S.filter, chip: el.dataset.chip }; go(el.dataset.go); }));
}
function confirmBox(msg) { return window.confirm(msg); }

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */
function viewDashboard() {
  const L = S.leads;
  const total = L.length;
  const unassigned = L.filter((l) => !l.assignedTo && l.outcome === "Open").length;
  const newLeads = L.filter((l) => l.status === "New Lead").length;
  const contacted = L.filter((l) => CONTACTED.has(l.status)).length;
  const interested = L.filter((l) => INTERESTED.has(l.status)).length;
  const approved = L.filter((l) => APPROVED.has(l.status)).length;
  const done = L.filter((l) => l.status === "Completed");
  const financed = done.reduce((s, l) => s + (l.vehiclePrice || 0) * (100 - PCT) / 100, 0);
  const vehicleValue = done.reduce((s, l) => s + (l.vehiclePrice || 0), 0);
  const overdue = L.filter((l) => followState(l) === "overdue").length;
  const today = L.filter((l) => followState(l) === "today").length;
  const conv = total ? (done.length / total * 100) : 0;
  const pipeline = L.filter((l) => l.outcome === "Open").reduce((s, l) => s + (l.vehiclePrice || 0) * (100 - PCT) / 100, 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = String(S.me.name).split(" ")[0];

  const kpi = (label, value, sub, cls = "", go = "", chip = "") => `<div class="card kpi ${cls}" ${go ? `data-go="${go}" data-chip="${chip}" style="cursor:pointer"` : ""}><div class="k-label">${label}</div><div class="k-value num">${value}</div>${sub ? `<div class="k-sub">${sub}</div>` : ""}</div>`;
  const kpis = canViewAll() ? [
    kpi("Total leads", total, `${newLeads} new`, "accent", "leads", "all"),
    kpi("Unassigned", unassigned, "Need an officer", unassigned ? "alert" : "", "leads", "unassigned"),
    kpi("Overdue follow-ups", overdue, `${today} due today`, overdue ? "alert" : "", "leads", "overdue"),
    kpi("Contacted", contacted, total ? Math.round(contacted / total * 100) + "% of leads" : ""),
    kpi("Interested", interested, "Genuine prospects"),
    kpi("Approved", approved, "Loans approved"),
    kpi("Vehicles financed", done.length, `${conv.toFixed(1)}% conversion`),
    kpi("Financed by DEED", "UGX " + short(financed), `Vehicles worth ${short(vehicleValue)}`)
  ] : [
    kpi("My leads", total, `${L.filter((l) => l.outcome === "Open").length} open`, "accent", "leads", "all"),
    kpi("New to call", newLeads, "Not contacted yet", newLeads ? "alert" : "", "leads", "new"),
    kpi("Follow-ups today", today, "", "", "leads", "today"),
    kpi("Overdue", overdue, "Past follow-up date", overdue ? "alert" : "", "leads", "overdue"),
    kpi("Interested", interested, ""),
    kpi("Approved", approved, ""),
    kpi("Financed", done.length, `${conv.toFixed(1)}% conversion`),
    kpi("Open pipeline", "UGX " + short(pipeline), "70% financing value")
  ];

  // Funnel
  const stages = [["New", (l) => true], ["Contacted", (l) => CONTACTED.has(l.status)], ["Interested", (l) => INTERESTED.has(l.status)],
    ["Application", (l) => ["Application Started", "Submitted for Assessment", "Approved", "Awaiting Customer Contribution", "Completed"].includes(l.status)],
    ["Approved", (l) => APPROVED.has(l.status)], ["Completed", (l) => l.status === "Completed"]];
  const funnel = stages.map(([n, f]) => { const c = L.filter(f).length; return `<div class="f-row"><span class="f-name">${n}</span><div class="f-bar"><span style="width:${total ? Math.max(c / total * 100, c ? 3 : 0) : 0}%"></span></div><span class="f-n num">${c}</span></div>`; }).join("");

  // Daily trend (14 days)
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = dayStart(new Date(Date.now() - i * 86400000)); days.push({ d, n: 0 }); }
  L.forEach((l) => { if (!l.createdAt) return; const t = dayStart(l.createdAt).getTime(); const b = days.find((x) => x.d.getTime() === t); if (b) b.n++; });
  const maxD = Math.max(1, ...days.map((x) => x.n));
  const spark = days.map((x, i) => `<div class="b ${i === 13 ? "today" : ""}" title="${fmtDate(x.d)}: ${x.n}"><em>${x.n || ""}</em><span style="height:${x.n / maxD * 100}%"></span><small>${x.d.getDate()}</small></div>`).join("");

  // Group tables
  const group = (keyFn) => {
    const m = new Map();
    L.forEach((l) => { const k = keyFn(l) || "—"; const g = m.get(k) || { k, n: 0, c: 0, done: 0, val: 0 }; g.n++; if (CONTACTED.has(l.status)) g.c++; if (l.status === "Completed") { g.done++; g.val += (l.vehiclePrice || 0) * (100 - PCT) / 100; } m.set(k, g); });
    return [...m.values()].sort((a, b) => b.n - a.n);
  };
  const gTable = (title, rows, label) => `<div class="card"><div class="card-head"><h3>${title}</h3></div>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>${label}</th><th>Leads</th><th>Contacted</th><th>Financed</th><th>Value</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td class="cell-main">${esc(r.k)}</td><td class="num">${r.n}</td><td class="num">${r.c}</td><td class="num">${r.done}</td><td class="num">${short(r.val)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No leads yet</div>`}</div>`;

  const recent = L.slice(0, 6).map((l) => `<a class="lead-card" href="#/leads/${encodeURIComponent(l.id)}" style="text-decoration:none;color:inherit">
      <span class="avatar">${esc(initials(l.fullName))}</span><div><div class="lc-name">${esc(l.fullName)}</div></div>${pill(l.status)}
      <div class="lc-meta"><span>${esc(l.vehicle || l.leadType)}</span>${l.vehiclePrice ? `<span>UGX ${short(l.vehiclePrice)}</span>` : ""}<span>${esc(partnerName(l) || l.source)}</span><span>${ago(l.createdAt)}</span></div></a>`).join("");

  return `
  <div class="page-head"><div><h2>${greet}, ${esc(first)}</h2><p>${canViewAll() ? "Here's how the campaign is doing." : "Here are your leads and follow-ups."}</p></div>
    <div class="actions"><button class="btn btn-primary" data-go="leads" data-chip="${isManager() ? "unassigned" : canViewAll() ? "all" : "new"}">${icon("list")} ${isManager() ? "Assign leads" : canViewAll() ? "View leads" : "Start calling"}</button></div></div>
  <div class="kpis">${kpis.join("")}</div>
  <div class="grid-2">
    <div class="card"><div class="card-head"><h3>Lead pipeline</h3><span class="muted">${total} leads</span></div><div class="funnel">${funnel}</div></div>
    <div class="card"><div class="card-head"><h3>Leads per day</h3><span class="muted">Last 14 days</span></div><div class="spark">${spark}</div></div>
  </div>
  ${canViewAll() ? `<div class="grid-2 even">${gTable("By partner bond", group(partnerName), "Bond")}${gTable("By QR source", group((l) => l.source), "Source")}</div>
  <div class="grid-2 even">${gTable("By officer", group((l) => l.assignedTo ? staffName(l.assignedTo) : "Unassigned"), "Officer")}
    <div class="card"><div class="card-head"><h3>Latest leads</h3><a href="#/leads" class="btn btn-sm btn-ghost">View all</a></div><div class="lead-cards">${recent || `<div class="empty">No leads yet. Share the QR codes!</div>`}</div></div></div>`
  : `<div class="card"><div class="card-head"><h3>Latest leads</h3><a href="#/leads" class="btn btn-sm btn-ghost">View all</a></div><div class="lead-cards">${recent || `<div class="empty">No leads assigned to you yet.</div>`}</div></div>`}`;
}

/* ------------------------------------------------------------------ */
/* Leads list                                                          */
/* ------------------------------------------------------------------ */
function chipDefs() {
  const L = S.leads;
  const defs = [["all", "All", () => true]];
  if (canViewAll()) defs.push(["unassigned", "Unassigned", (l) => !l.assignedTo && l.outcome === "Open"]);
  defs.push(["new", "New", (l) => l.status === "New Lead"], ["today", "Due today", (l) => followState(l) === "today"],
    ["overdue", "Overdue", (l) => followState(l) === "overdue"], ["hot", "Interested", (l) => INTERESTED.has(l.status) && l.outcome === "Open"],
    ["callback", "Call-backs", (l) => l.leadType === "Call-back request"], ["closed", "Closed", (l) => l.outcome !== "Open"]);
  return defs.map(([k, label, fn]) => ({ k, label, fn, n: L.filter(fn).length }));
}
function filteredLeads() {
  const f = S.filter;
  const chip = chipDefs().find((c) => c.k === f.chip) || chipDefs()[0];
  const q = f.q.trim().toLowerCase();
  const qd = q.replace(/\D/g, "");
  return S.leads.filter((l) => chip.fn(l)
    && (!f.status || l.status === f.status)
    && (!f.officer || (f.officer === "_none" ? !l.assignedTo : l.assignedTo === f.officer))
    && (!f.partner || l.partnerId === f.partner)
    && (!f.source || l.source === f.source)
    && (!q || [l.fullName, l.ref, l.vehicle, l.area, l.source, partnerName(l)].join(" ").toLowerCase().includes(q) || (qd.length >= 3 && waDigits(l.phone).includes(qd))));
}

function viewLeads() {
  const f = S.filter;
  const rows = filteredLeads();
  const sources = [...new Set(S.leads.map((l) => l.source).filter(Boolean))].sort();
  const sel = [...S.selected].filter((id) => rows.some((r) => r.id === id));
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label)}</option>`;
  const followCell = (l) => { const st = followState(l); return l.nextFollowUp ? `<span class="${st === "overdue" ? "overdue" : st === "today" ? "due-today" : ""}">${st === "today" ? "Today" : fmtDate(l.nextFollowUp)}</span>` : `<span class="muted">—</span>`; };

  const table = `<table class="only-desktop"><thead><tr>${isManager() ? `<th class="check"><input type="checkbox" id="sel-all" ${sel.length && sel.length === rows.length ? "checked" : ""} aria-label="Select all"></th>` : ""}
    <th>Customer</th><th>Vehicle</th><th>Bond · source</th><th>Officer</th><th>Status</th><th>Follow-up</th><th>Received</th></tr></thead><tbody>
    ${rows.map((l) => `<tr class="clickable ${S.selected.has(l.id) ? "sel" : ""}" data-open="${esc(l.id)}">
      ${isManager() ? `<td class="check"><input type="checkbox" data-sel="${esc(l.id)}" ${S.selected.has(l.id) ? "checked" : ""} aria-label="Select ${esc(l.fullName)}"></td>` : ""}
      <td><div class="cell-main">${esc(l.fullName)}</div><div class="cell-sub">${esc(l.ref || "")} · ${esc(l.phone)}</div></td>
      <td><div class="cell-main">${esc(l.vehicle || (l.leadType === "Call-back request" ? "Call-back request" : "—"))}</div><div class="cell-sub num">${l.vehiclePrice ? "UGX " + ugx(l.vehiclePrice) : ""}</div></td>
      <td><div>${esc(partnerName(l) || "—")}</div><div class="cell-sub">${esc(l.source)}</div></td>
      <td>${l.assignedTo ? `<span style="display:inline-flex;gap:8px;align-items:center"><span class="avatar" style="width:24px;height:24px;font-size:10px">${esc(initials(staffName(l.assignedTo)))}</span>${esc(staffName(l.assignedTo))}</span>` : `<span class="pill s-new">Unassigned</span>`}</td>
      <td>${pill(l.status)}</td><td>${followCell(l)}</td><td class="cell-sub">${ago(l.createdAt)}</td></tr>`).join("")}
    </tbody></table>`;
  const cards = `<div class="lead-cards only-mobile">${rows.map((l) => `<div class="lead-card" data-open="${esc(l.id)}">
      ${isManager() ? `<input type="checkbox" data-sel="${esc(l.id)}" ${S.selected.has(l.id) ? "checked" : ""} aria-label="Select ${esc(l.fullName)}" style="margin-top:8px">` : `<span class="avatar">${esc(initials(l.fullName))}</span>`}
      <div><div class="lc-name">${esc(l.fullName)}</div><div class="cell-sub">${esc(l.vehicle || l.leadType)}${l.vehiclePrice ? " · UGX " + short(l.vehiclePrice) : ""}</div></div>${pill(l.status)}
      <div class="lc-meta"><span>${l.assignedTo ? esc(staffName(l.assignedTo)) : "<b style='color:var(--red)'>Unassigned</b>"}</span><span>${esc(partnerName(l) || l.source)}</span>${l.nextFollowUp ? `<span>Follow-up ${followCell(l)}</span>` : ""}<span>${ago(l.createdAt)}</span></div></div>`).join("")}</div>`;

  return `
  <div class="page-head"><div><h2>${canViewAll() ? "All leads" : "My leads"}</h2><p>${rows.length} of ${S.leads.length} shown</p></div>
    <div class="actions">${canViewAll() ? `<button class="btn" id="export">${icon("dl")} Export CSV</button>` : ""}</div></div>
  <div class="card">
    <div class="chips" role="tablist">${chipDefs().map((c) => `<button class="chip ${f.chip === c.k ? "active" : ""}" data-chip="${c.k}" role="tab" aria-selected="${f.chip === c.k}">${c.label}<b>${c.n}</b></button>`).join("")}</div>
    <div class="toolbar">
      <div class="search">${icon("search")}<input class="input" id="q" type="search" placeholder="Search name, phone, vehicle, ref" value="${esc(f.q)}" autocomplete="off"></div>
      <select class="input" id="f-status" aria-label="Status"><option value="">All statuses</option>${STATUSES.map((s) => opt(s, s, f.status)).join("")}</select>
      ${canViewAll() ? `<select class="input" id="f-officer" aria-label="Officer"><option value="">All officers</option>${opt("_none", "Unassigned", f.officer)}${officers().map((o) => opt(o.email, o.name, f.officer)).join("")}</select>` : ""}
      <select class="input" id="f-partner" aria-label="Partner bond"><option value="">All bonds</option>${S.partners.map((p) => opt(p.id, p.name, f.partner)).join("")}</select>
      <select class="input" id="f-source" aria-label="Source"><option value="">All sources</option>${sources.map((s) => opt(s, s, f.source)).join("")}</select>
    </div>
    ${isManager() && sel.length ? `<div class="bulk">${sel.length} selected <select class="input" id="bulk-officer" style="width:auto"><option value="">Assign to…</option>${officers().map((o) => opt(o.email, `${o.name} (${ROLES[o.role]})`, "")).join("")}</select>
      <button class="btn btn-primary btn-sm" id="bulk-go">Assign</button><button class="btn btn-ghost btn-sm" id="bulk-clear">Clear</button></div>` : ""}
    ${rows.length ? `<div class="table-wrap">${table}</div>${cards}` : `<div class="empty">${icon("list")}<p>No leads match these filters.</p></div>`}
  </div>`;
}

function bindLeads() {
  app.querySelectorAll("[data-chip]").forEach((b) => (b.onclick = () => { S.filter.chip = b.dataset.chip; render(); }));
  const q = document.getElementById("q");
  q.oninput = () => { S.filter.q = q.value; render(); };
  [["f-status", "status"], ["f-officer", "officer"], ["f-partner", "partner"], ["f-source", "source"]].forEach(([id, k]) => {
    const el = document.getElementById(id); if (el) el.onchange = () => { S.filter[k] = el.value; render(); };
  });
  app.querySelectorAll("[data-open]").forEach((r) => (r.onclick = (e) => { if (e.target.closest("input")) return; go("leads/" + encodeURIComponent(r.dataset.open)); }));
  app.querySelectorAll("[data-sel]").forEach((c) => (c.onchange = () => { c.checked ? S.selected.add(c.dataset.sel) : S.selected.delete(c.dataset.sel); render(); }));
  const all = document.getElementById("sel-all");
  if (all) all.onchange = () => { const rows = filteredLeads(); if (all.checked) rows.forEach((r) => S.selected.add(r.id)); else S.selected.clear(); render(); };
  const bg = document.getElementById("bulk-go");
  if (bg) bg.onclick = async () => {
    const email = document.getElementById("bulk-officer").value;
    if (!email) return toast("Choose who to assign to.", true);
    const ids = [...S.selected]; bg.disabled = true;
    try {
      await Promise.all(ids.map((id) => assign(id, email)));
      toast(`${ids.length} lead${ids.length > 1 ? "s" : ""} assigned to ${staffName(email)}`);
      S.selected.clear(); render();
    } catch (e) { fail(e); bg.disabled = false; }
  };
  const bc = document.getElementById("bulk-clear"); if (bc) bc.onclick = () => { S.selected.clear(); render(); };
  const ex = document.getElementById("export"); if (ex) ex.onclick = exportCsv;
}

function assign(id, email) {
  const l = S.leads.find((x) => x.id === id);
  const patch = { assignedTo: email || null, assignedName: email ? staffName(email) : null };
  return S.be.updateLead(id, patch, { type: "assign", text: email ? "Assigned to " + staffName(email) : "Unassigned" + (l && l.assignedTo ? " from " + staffName(l.assignedTo) : "") });
}

function exportCsv() {
  const cols = [["Lead ID", "ref"], ["Received", (l) => l.createdAt ? new Date(l.createdAt).toISOString() : ""], ["Type", "leadType"], ["Partner bond", partnerName], ["Source", "source"],
    ["Name", "fullName"], ["Phone", "phone"], ["Alt phone", "altPhone"], ["Contact method", "contactMethod"], ["Contact time", "contactTime"], ["Area", "area"],
    ["Vehicle", "vehicle"], ["Make", "vehicleMake"], ["Model", "vehicleModel"], ["Year", "vehicleYear"], ["Vehicle price", "vehiclePrice"],
    ["30% contribution", (l) => l.vehiclePrice ? Math.round(l.vehiclePrice * PCT / 100) : ""], ["70% financing", (l) => l.vehiclePrice ? Math.round(l.vehiclePrice * (100 - PCT) / 100) : ""],
    ["Available contribution", "availableContribution"], ["Can raise 30%", "canRaise"], ["Timeline", "timeline"], ["Repayment period", "repaymentPeriod"], ["Income", "incomeSource"],
    ["Buying from partner", "fromPartner"], ["Salesperson", "salesperson"], ["Questions", "questions"], ["Officer", (l) => l.assignedTo ? staffName(l.assignedTo) : ""],
    ["Status", "status"], ["Contact attempts", "contactAttempts"], ["Last contact", (l) => isoDate(l.lastContactAt)], ["Next follow-up", (l) => isoDate(l.nextFollowUp)],
    ["Loan app started", "loanAppStarted"], ["Loan app ref", "loanAppRef"], ["Outcome", "outcome"], ["Lost reason", "lostReason"]];
  const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [cols.map((c) => c[0]).join(",")].concat(filteredLeads().map((l) => cols.map(([, k]) => cell(typeof k === "function" ? k(l) : l[k])).join(",")));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `deed-leads-${isoDate(new Date())}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ------------------------------------------------------------------ */
/* Lead drawer                                                         */
/* ------------------------------------------------------------------ */
let actUnsub = null, actItems = [], drawerLeadId = null;
function closeDrawer() { go("leads"); }
function renderDrawer() {
  if (!S.openLead) { drawerRoot.innerHTML = ""; if (actUnsub) { actUnsub(); actUnsub = null; } drawerLeadId = null; document.body.style.overflow = ""; return; }
  if (drawerLeadId !== S.openLead) {
    if (actUnsub) actUnsub();
    drawerLeadId = S.openLead; actItems = [];
    actUnsub = S.be.watchActivity(S.openLead, (items) => { actItems = items; const tl = document.getElementById("timeline"); if (tl) tl.innerHTML = timelineHtml(); });
  }
  drawLead();
}
function refreshDrawer() { if (S.openLead && !document.querySelector(".drawer [data-dirty='1']")) drawLead(); }

function timelineHtml() {
  if (!actItems.length) return `<p class="muted">No activity yet.</p>`;
  const ic = { call: "phone", whatsapp: "chat", note: "note", status: "flag", assign: "user", followup: "cal" };
  return actItems.map((a) => `<div class="tl"><span class="tl-ic">${icon(ic[a.type] || "note")}</span><div><p>${esc(a.text)}</p><small>${esc(a.byName || a.by || "")} · ${fmtDateTime(a.at)}</small></div></div>`).join("");
}

function drawLead() {
  const l = S.leads.find((x) => x.id === S.openLead);
  if (!l) {
    drawerRoot.innerHTML = S.leads.length ? `<div class="scrim" data-close></div><aside class="drawer"><div class="drawer-head"><div class="row"><h2 style="flex:1">Lead not found</h2><button class="btn btn-ghost" data-close>${icon("x")}</button></div><p class="muted">It may have been reassigned or removed.</p></div></aside>` : "";
    drawerRoot.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeDrawer));
    return;
  }
  document.body.style.overflow = "hidden";
  const prevBody = drawerRoot.querySelector(".drawer-body");
  const keepScroll = prevBody && drawerRoot.dataset.lead === l.id ? prevBody.scrollTop : 0;
  const noteDraft = (document.getElementById("d-note") || {}).value || "";
  drawerRoot.dataset.lead = l.id;
  const price = l.vehiclePrice || 0, need = price * PCT / 100, have = l.availableContribution || 0;
  const ratio = need ? Math.min(have / need, 1) : 0;
  const waText = `Hello ${String(l.fullName).split(" ")[0]}, thank you for your interest in vehicle financing through DEED Microfinance.\n\nWe received your inquiry${l.vehicle ? " regarding the " + l.vehicle : ""} and would be glad to guide you through the financing process.\n\nUnder our vehicle financing arrangement, you may contribute ${PCT}% of the vehicle price while DEED Microfinance finances up to ${100 - PCT}%, subject to assessment and approval.\n\nWhen would be a convenient time for us to discuss your application?\n\nThank you,\n${S.me.name}${S.me.phone ? " (" + S.me.phone + ")" : ""}\nDEED Microfinance`;
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(label || v)}</option>`;
  const kv = (k, v) => v || v === 0 ? `<div><small>${k}</small><span>${esc(v)}</span></div>` : "";
  const editable = canEditLead(l);

  drawerRoot.innerHTML = `
  <div class="scrim" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Lead ${esc(l.fullName)}">
    <div class="drawer-head">
      <div class="row">
        <span class="avatar" style="width:44px;height:44px;font-size:15px">${esc(initials(l.fullName))}</span>
        <div style="flex:1;min-width:0"><h2>${esc(l.fullName)}</h2>
          <div class="sub"><span class="code">${esc(l.ref || l.id)}</span>${pill(l.status)}<span>${esc(l.leadType)}</span><span>${ago(l.createdAt)}</span></div></div>
        <button class="btn btn-ghost" data-close aria-label="Close">${icon("x")}</button>
      </div>
      <div class="quick">
        <a class="btn btn-primary" href="tel:${esc(l.phone)}" id="q-call">${icon("phone")} Call</a>
        <a class="btn btn-green" href="https://wa.me/${waDigits(l.phone)}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener" id="q-wa">${icon("chat")} WhatsApp</a>
        ${editable ? `<button class="btn" id="q-attempt">${icon("check")} Log attempt</button>` : `<span class="btn" style="cursor:default" title="View only">${icon("user")} ${esc(l.assignedTo ? staffName(l.assignedTo).split(" ")[0] : "Unassigned")}</span>`}
      </div>
    </div>
    <div class="drawer-body">
      ${isManager() ? `<div class="card card-pad section"><h3>Assignment</h3>
        <div style="display:flex;gap:8px"><select class="input" id="d-assign"><option value="">Unassigned</option>${officers().map((o) => opt(o.email, l.assignedTo, `${o.name} · ${ROLES[o.role]}`)).join("")}</select>
        <button class="btn btn-primary" id="d-assign-go">Assign</button></div>
        ${l.assignedTo ? `<p class="muted" style="margin:8px 0 0">Assigned to <b>${esc(staffName(l.assignedTo))}</b>${l.assignedAt ? " · " + fmtDateTime(l.assignedAt) : ""}</p>` : ""}</div>` : ""}

      <div class="card card-pad section" id="progress"><h3>Progress${editable ? "" : ` <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· view only</span>`}</h3>
        <fieldset ${editable ? "" : "disabled"} style="border:0;padding:0;margin:0;min-width:0"><div class="form-grid">
          <div class="full"><label class="lbl" for="d-status">Lead status</label><select class="input" id="d-status">${STATUSES.map((s) => opt(s, l.status)).join("")}</select></div>
          <div><label class="lbl" for="d-follow">Next follow-up</label><input class="input" type="date" id="d-follow" value="${isoDate(l.nextFollowUp)}"></div>
          <div><label class="lbl">Contact attempts</label><div class="input num" style="display:flex;align-items:center">${l.contactAttempts || 0}${l.lastContactAt ? `<span class="muted" style="margin-left:auto;font-size:12px">last ${fmtDate(l.lastContactAt)}</span>` : ""}</div></div>
          <div><label class="lbl" for="d-app">Loan application started</label><select class="input" id="d-app">${opt("No", l.loanAppStarted || "No")}${opt("Yes", l.loanAppStarted)}</select></div>
          <div><label class="lbl" for="d-appref">Application reference</label><input class="input" id="d-appref" value="${esc(l.loanAppRef || "")}" maxlength="60"></div>
          <div><label class="lbl" for="d-outcome">Final outcome</label><select class="input" id="d-outcome">${OUTCOMES.map((o) => opt(o, l.outcome || "Open")).join("")}</select></div>
          <div><label class="lbl" for="d-lost">Closed / lost reason</label><select class="input" id="d-lost"><option value="">—</option>${LOST_REASONS.map((o) => opt(o, l.lostReason)).join("")}</select></div>
        </div></fieldset>
        ${editable ? `<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-red" id="d-save">Save progress</button></div>` : ""}
      </div>

      ${price ? `<div class="card card-pad section"><h3>Financing</h3>
        <div class="money-split"><div class="ms-you"><small>Customer ${PCT}%</small><b class="num">UGX ${ugx(need)}</b></div><div class="ms-deed"><small>DEED ${100 - PCT}% estimate</small><b class="num">UGX ${ugx(price - need)}</b></div></div>
        <div class="meter"><span class="${ratio >= 1 ? "ok" : ""}" style="width:${ratio * 100}%"></span></div>
        <p class="muted" style="margin:0">Has <b>UGX ${ugx(have)}</b> available (${Math.round(ratio * 100)}% of the ${PCT}%). Can raise 30%: <b>${esc(l.canRaise || "—")}</b></p></div>` : ""}

      <div class="card card-pad section"><h3>Customer</h3><div class="kv">
        ${kv("Phone", l.phone)}${kv("Alt. phone", l.altPhone)}${kv("Prefers", [l.contactMethod, l.contactTime].filter(Boolean).join(", "))}${kv("Area", l.area)}
        ${kv("Vehicle", l.vehicle)}${kv("Make / model / year", [l.vehicleMake, l.vehicleModel, l.vehicleYear].filter(Boolean).join(" "))}${kv("Price", price ? "UGX " + ugx(price) : "")}
        ${kv("Partner bond", partnerName(l))}${kv("Buying from partner", l.fromPartner)}${kv("Salesperson", l.salesperson)}${kv("QR source", l.source)}
        ${kv("Timeline", l.timeline)}${kv("Repayment", l.repaymentPeriod)}${kv("Income", l.incomeSource)}${kv("Wants contact", l.wantsContact)}
      </div>${l.questions ? `<div style="margin-top:12px;padding:10px 12px;background:var(--bg);border-radius:10px"><small class="muted" style="font-weight:600">QUESTION FROM CUSTOMER</small><p style="margin:4px 0 0">${esc(l.questions)}</p></div>` : ""}</div>

      <div class="card card-pad section"><h3>Notes & activity</h3>
        ${editable ? `<div class="note-box"><textarea class="input" id="d-note" placeholder="Add a note (what was discussed, next step)" maxlength="2000"></textarea><button class="btn btn-primary" id="d-note-go">Add</button></div>` : ""}
        <div class="timeline" id="timeline">${timelineHtml()}</div></div>

      ${isAdmin() ? `<div style="text-align:center"><button class="btn btn-ghost btn-sm" id="d-delete" style="color:var(--red)">Delete lead</button></div>` : ""}
    </div>
  </aside>`;
  drawerRoot.querySelector(".drawer-body").scrollTop = keepScroll;
  if (noteDraft) document.getElementById("d-note").value = noteDraft;
  bindDrawer(l);
}

function bindDrawer(l) {
  drawerRoot.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeDrawer));
  const prog = document.getElementById("progress");
  prog.addEventListener("input", () => (prog.dataset.dirty = "1"));
  prog.addEventListener("change", () => (prog.dataset.dirty = "1"));
  const logContact = (type, text) => S.be.updateLead(l.id, { contactAttempts: (l.contactAttempts || 0) + 1, lastContactAt: new Date(),
    ...(l.status === "New Lead" ? { status: "Contact Attempted" } : {}) }, { type, text }).catch(fail);
  if (!canEditLead(l)) return;
  document.getElementById("q-call").addEventListener("click", () => logContact("call", "Called customer"));
  document.getElementById("q-wa").addEventListener("click", () => logContact("whatsapp", "Sent WhatsApp message"));
  document.getElementById("q-attempt").onclick = async () => {
    const note = prompt("What happened? (e.g. No answer, will try evening)", "No answer");
    if (note === null) return;
    await logContact("call", "Contact attempt: " + (note || "no details"));
    toast("Attempt logged");
  };
  const ag = document.getElementById("d-assign-go");
  if (ag) ag.onclick = async () => {
    const email = document.getElementById("d-assign").value;
    if ((email || null) === (l.assignedTo || null)) return toast("Already assigned.");
    ag.disabled = true;
    try { await assign(l.id, email); toast(email ? "Assigned to " + staffName(email) : "Unassigned"); } catch (e) { fail(e); ag.disabled = false; }
  };
  document.getElementById("d-save").onclick = async (ev) => {
    const btn = ev.currentTarget;
    const status = document.getElementById("d-status").value;
    const follow = document.getElementById("d-follow").value;
    let outcome = document.getElementById("d-outcome").value;
    if (status === "Completed" && outcome === "Open") outcome = "Financed";
    if (status === "Lost" && outcome === "Open") outcome = "Lost";
    if (status === "Not Eligible" && outcome === "Open") outcome = "Not Eligible";
    const patch = { status, outcome, nextFollowUp: follow ? new Date(follow + "T09:00:00") : null,
      loanAppStarted: document.getElementById("d-app").value, loanAppRef: document.getElementById("d-appref").value.trim().slice(0, 60),
      lostReason: document.getElementById("d-lost").value };
    const changes = [];
    if (status !== l.status) changes.push(`Status: ${l.status} → ${status}`);
    if (isoDate(patch.nextFollowUp) !== isoDate(l.nextFollowUp)) changes.push(follow ? "Follow-up set for " + fmtDate(patch.nextFollowUp) : "Follow-up cleared");
    if (outcome !== (l.outcome || "Open")) changes.push("Outcome: " + outcome);
    if (patch.loanAppStarted !== (l.loanAppStarted || "No")) changes.push("Loan application started: " + patch.loanAppStarted);
    btn.disabled = true;
    try {
      await S.be.updateLead(l.id, patch, changes.length ? { type: status !== l.status ? "status" : "followup", text: changes.join(". ") } : null);
      prog.dataset.dirty = "0"; toast("Saved"); drawLead();
    } catch (e) { fail(e); btn.disabled = false; }
  };
  document.getElementById("d-note-go").onclick = async () => {
    const t = document.getElementById("d-note");
    const text = t.value.trim(); if (!text) return;
    try { await S.be.addActivity(l.id, { type: "note", text }); t.value = ""; } catch (e) { fail(e); }
  };
  const del = document.getElementById("d-delete");
  if (del) del.onclick = async () => { if (!confirmBox(`Delete ${l.fullName}'s lead permanently?`)) return; try { await S.be.deleteLead(l.id); toast("Lead deleted"); closeDrawer(); } catch (e) { fail(e); } };
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (modalRoot.innerHTML) closeModal(); else if (S.openLead) closeDrawer(); } });

/* ------------------------------------------------------------------ */
/* Team (admin)                                                        */
/* ------------------------------------------------------------------ */
function viewTeam() {
  const order = { admin: 0, director: 1, manager: 2, marketing: 3, officer: 4 };
  const people = [...S.staff].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || String(a.name).localeCompare(b.name));
  const load = (email) => S.leads.filter((l) => l.assignedTo === email && l.outcome === "Open").length;
  const group = (roles) => people.filter((p) => roles.includes(p.role));
  const missingPhone = people.filter((p) => !p.phone).length;
  const row = (p) => `<div class="person ${p.active === false ? "inactive" : ""}">
      <span class="avatar">${esc(initials(p.name))}</span>
      <div style="min-width:0"><div class="p-name">${esc(p.name)} ${p.email === S.me.email ? '<span class="muted">(you)</span>' : ""}</div>
        <div class="p-sub">${p.phone ? `<a href="tel:${esc(p.phone)}" style="color:inherit">${esc(p.phone)}</a>` : `<b style="color:var(--red)">No phone number</b>`} · ${esc(p.email)}${["officer", "manager"].includes(p.role) ? ` · ${load(p.email)} open leads` : ""}${p.active === false ? " · deactivated" : ""}</div></div>
      <div class="p-act"><span class="role-badge role-${p.role}">${ROLES[p.role] || p.role}</span><button class="btn btn-sm" data-edit="${esc(p.email)}">Edit</button></div>
    </div>`;
  const block = (title, desc, roles) => `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${title} <span class="muted" style="font-weight:500">· ${desc}</span></h3><span class="muted">${group(roles).length}</span></div>
    <div class="people">${group(roles).map(row).join("") || `<div class="empty">None yet</div>`}</div></div>`;
  return `<div class="page-head"><div><h2>Team</h2><p>Add the people who can sign in, their phone number and what they can do.</p></div>
    <div class="actions"><button class="btn btn-primary" id="add-person">${icon("plus")} Add person</button></div></div>
    ${missingPhone ? `<div class="card card-pad" style="margin-bottom:16px;border-color:#f6c9cb;background:var(--red-50);color:var(--red)"><b>${missingPhone} ${missingPhone > 1 ? "people need" : "person needs"} a phone number.</b> Click Edit to add it.</div>` : ""}
    ${block("Management", "admin and director", ["admin", "director"])}
    ${block("Marketing team", "managers assign leads; marketing officers view", ["manager", "marketing"])}
    ${block("Credit officers", "follow up only their own leads", ["officer"])}`;
}
function bindTeam() {
  document.getElementById("add-person").onclick = () => personModal();
  app.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => personModal(S.staff.find((s) => s.email === b.dataset.edit))));
}
function personModal(p, focusPhone) {
  const isNew = !p;
  p = p || { name: "", email: "", role: "officer", active: true, phone: "" };
  const self = !isNew && p.email === S.me.email;
  openModal(`<div class="modal-head"><h3>${isNew ? "Add person" : "Edit " + esc(p.name)}</h3><button class="btn btn-ghost" data-mclose>${icon("x")}</button></div>
    <form id="pf" novalidate><div class="modal-body"><div class="form-grid">
      <div class="full"><label class="lbl" for="pf-name">Full name *</label><input class="input" id="pf-name" required maxlength="80" value="${esc(p.name)}"></div>
      <div class="full"><label class="lbl" for="pf-phone">Phone number *</label><input class="input" id="pf-phone" type="tel" inputmode="tel" required value="${esc(p.phone || "")}" placeholder="07XXXXXXXX or +2567XXXXXXXX"></div>
      <div class="full"><label class="lbl" for="pf-email">Google account email *</label><input class="input" id="pf-email" type="email" required value="${esc(p.email)}" ${isNew ? "" : "disabled"} placeholder="name@gmail.com or work Google email">
        <p class="muted" style="margin:6px 0 0;font-size:12px">They sign in with Google using exactly this email.</p></div>
      <div class="full"><label class="lbl" for="pf-role">Role *</label><select class="input" id="pf-role" ${self ? "disabled" : ""}>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${p.role === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <p class="muted" id="pf-role-info" style="margin:6px 0 0;font-size:12px">${esc(ROLE_INFO[p.role] || "")}</p></div>
      ${isNew || self ? "" : `<div class="full"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="pf-active" ${p.active !== false ? "checked" : ""}> Active (can sign in)</label></div>`}
      <p class="login-err full" id="pf-err" hidden style="margin:0"></p>
    </div></div>
    <div class="modal-foot">${isNew || self ? "" : `<button type="button" class="btn btn-ghost" id="pf-del" style="color:var(--red);margin-right:auto">Remove</button>`}<button type="button" class="btn" data-mclose>Cancel</button><button class="btn btn-primary" type="submit">${isNew ? "Add to team" : "Save"}</button></div></form>`);
  const roleEl = document.getElementById("pf-role");
  roleEl.onchange = () => (document.getElementById("pf-role-info").textContent = ROLE_INFO[roleEl.value] || "");
  if (focusPhone) document.getElementById("pf-phone").focus();
  const err = (m) => { const e = document.getElementById("pf-err"); e.textContent = m; e.hidden = false; };
  document.getElementById("pf").onsubmit = async (e) => {
    e.preventDefault();
    const email = (isNew ? document.getElementById("pf-email").value : p.email).trim().toLowerCase();
    const name = document.getElementById("pf-name").value.trim();
    const phone = normalizeUgPhone(document.getElementById("pf-phone").value);
    if (name.length < 2) return err("Enter the person's full name.");
    if (!phone) return err("Enter a valid Ugandan phone number, e.g. 0772123456 or +256772123456.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("Enter a valid Google email.");
    if (isNew && S.staff.some((s) => s.email === email)) return err("That email is already on the team.");
    const activeEl = document.getElementById("pf-active");
    try {
      await S.be.saveStaff(email, { name, phone, role: self ? p.role : roleEl.value, active: activeEl ? activeEl.checked : true }, isNew);
      toast(isNew ? `${name} added. They can sign in now.` : "Saved"); closeModal(); render();
    } catch (er) { fail(er); }
  };
  const del = document.getElementById("pf-del");
  if (del) del.onclick = async () => {
    const open = S.leads.filter((l) => l.assignedTo === p.email && l.outcome === "Open").length;
    if (!confirmBox(`Remove ${p.name} from the team?${open ? ` They have ${open} open leads; reassign them afterwards (filter Leads by officer).` : ""}`)) return;
    try { await S.be.removeStaff(p.email); toast("Removed"); closeModal(); } catch (er) { fail(er); }
  };
}

/* ------------------------------------------------------------------ */
/* Partner bonds (admin)                                               */
/* ------------------------------------------------------------------ */
const landingBase = () => location.origin + location.pathname.replace(/portal\/(index\.html)?$/, "");
function viewPartners() {
  const stats = (id) => { const L = S.leads.filter((l) => l.partnerId === id); return { n: L.length, done: L.filter((l) => l.status === "Completed").length, open: L.filter((l) => l.outcome === "Open").length }; };
  return `<div class="page-head"><div><h2>Partner bonds</h2><p>Each bond gets its own link and QR codes, so you can see which bond brings the leads.</p></div>
    <div class="actions"><button class="btn btn-primary" id="add-partner">${icon("plus")} Add partner bond</button></div></div>
    <div class="partners">${S.partners.map((p) => { const s = stats(p.id); const url = landingBase() + "?bond=" + encodeURIComponent(p.id); return `<div class="card partner ${p.active === false ? "inactive" : ""}">
      <div class="partner-top"><span class="partner-ic">${esc(initials(p.name))}</span><div style="flex:1;min-width:0"><h3>${esc(p.name)}</h3><div class="muted">${esc(p.location || "")}${p.active === false ? " · paused" : ""}</div></div></div>
      <div class="partner-stats"><div><small>Leads</small><b class="num">${s.n}</b></div><div><small>Open</small><b class="num">${s.open}</b></div><div><small>Financed</small><b class="num">${s.done}</b></div></div>
      <div><small class="muted" style="font-weight:600">LINK</small><div class="code" style="margin-top:4px">${esc(url)}</div></div>
      ${p.contactName || p.contactPhone ? `<div class="muted">Contact: ${esc([p.contactName, p.contactPhone].filter(Boolean).join(" · "))}</div>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" data-qr="${esc(p.id)}">${icon("qr")} QR codes</button><button class="btn btn-sm" data-copy="${esc(url)}">Copy link</button><button class="btn btn-sm" data-pedit="${esc(p.id)}">Edit</button></div>
    </div>`; }).join("") || `<div class="card empty">No partner bonds yet. Add Banda Bond to start.</div>`}</div>`;
}
function bindPartners() {
  document.getElementById("add-partner").onclick = () => partnerModal();
  app.querySelectorAll("[data-pedit]").forEach((b) => (b.onclick = () => partnerModal(S.partners.find((p) => p.id === b.dataset.pedit))));
  app.querySelectorAll("[data-qr]").forEach((b) => (b.onclick = () => qrModal(S.partners.find((p) => p.id === b.dataset.qr))));
  app.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Link copied"), () => toast("Copy failed", true))));
}
function partnerModal(p) {
  const isNew = !p;
  p = p || { name: "", location: "", contactName: "", contactPhone: "", active: true };
  openModal(`<div class="modal-head"><h3>${isNew ? "Add partner bond" : "Edit " + esc(p.name)}</h3><button class="btn btn-ghost" data-mclose>${icon("x")}</button></div>
    <form id="bf"><div class="modal-body"><div class="form-grid">
      <div class="full"><label class="lbl" for="bf-name">Bond name</label><input class="input" id="bf-name" required maxlength="80" value="${esc(p.name)}" placeholder="e.g. Banda Bond"></div>
      ${isNew ? `<div class="full"><label class="lbl" for="bf-id">Link code</label><input class="input" id="bf-id" maxlength="60" placeholder="banda_bond" pattern="[a-z0-9_\\-]{2,60}">
        <p class="muted" style="margin:6px 0 0;font-size:12px">Used in the QR link (<span class="code">?bond=banda_bond</span>). Can't be changed later.</p></div>` : ""}
      <div class="full"><label class="lbl" for="bf-loc">Location</label><input class="input" id="bf-loc" maxlength="80" value="${esc(p.location || "")}" placeholder="Banda, Kampala"></div>
      <div><label class="lbl" for="bf-cn">Contact person</label><input class="input" id="bf-cn" maxlength="60" value="${esc(p.contactName || "")}"></div>
      <div><label class="lbl" for="bf-cp">Contact phone</label><input class="input" id="bf-cp" maxlength="20" value="${esc(p.contactPhone || "")}"></div>
      ${isNew ? "" : `<div class="full"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="bf-active" ${p.active !== false ? "checked" : ""}> Active</label></div>`}
    </div></div>
    <div class="modal-foot"><button type="button" class="btn" data-mclose>Cancel</button><button class="btn btn-primary" type="submit">${isNew ? "Add bond" : "Save"}</button></div></form>`);
  const nameEl = document.getElementById("bf-name"), idEl = document.getElementById("bf-id");
  if (idEl) { let touched = false; idEl.oninput = () => (touched = true); nameEl.oninput = () => { if (!touched) idEl.value = slugify(nameEl.value); }; }
  document.getElementById("bf").onsubmit = async (e) => {
    e.preventDefault();
    const id = isNew ? slugify(idEl.value || nameEl.value) : p.id;
    const name = nameEl.value.trim();
    if (!name || !/^[a-z0-9_-]{2,60}$/.test(id)) return toast("Enter a bond name.", true);
    if (isNew && S.partners.some((x) => x.id === id)) return toast("That link code is already used.", true);
    try {
      await S.be.savePartner(id, { name, location: document.getElementById("bf-loc").value.trim(), contactName: document.getElementById("bf-cn").value.trim(),
        contactPhone: document.getElementById("bf-cp").value.trim(), active: isNew ? true : document.getElementById("bf-active").checked }, isNew);
      toast(isNew ? `${name} added` : "Saved"); closeModal();
    } catch (er) { fail(er); }
  };
}
const PLACEMENTS = [["main_entrance", "Main entrance"], ["showroom", "Showroom"], ["vehicle_sticker", "Vehicle windshield"], ["salesperson_01", "Salesperson desk 01"], ["deed_banner", "DEED banner"]];
function qrModal(p) {
  openModal(`<div class="modal-head"><h3>QR codes · ${esc(p.name)}</h3><button class="btn btn-ghost" data-mclose>${icon("x")}</button></div>
    <div class="modal-body">
      <label class="lbl" for="qr-list">One placement per line: <span class="code">source_code | Label</span></label>
      <textarea class="input" id="qr-list" rows="5" style="font-family:ui-monospace,Menlo,monospace;font-size:13px">${PLACEMENTS.map(([a, b]) => a + " | " + b).join("\n")}</textarea>
      <div style="display:flex;gap:8px;margin:12px 0 16px"><button class="btn btn-primary" id="qr-make">${icon("qr")} Update codes</button><button class="btn" id="qr-print">Print</button></div>
      <div class="print-area"><div class="qr-grid" id="qr-grid"></div></div>
    </div>`, true);
  const make = () => {
    const grid = document.getElementById("qr-grid"); grid.innerHTML = "";
    document.getElementById("qr-list").value.split("\n").forEach((line) => {
      const [a, b] = line.split("|"); const src = slugify(a || ""); if (!src) return;
      const label = (b || src).trim();
      const url = landingBase() + "?bond=" + encodeURIComponent(p.id) + "&source=" + encodeURIComponent(src);
      const qr = window.qrcode(0, "M"); qr.addData(url); qr.make();
      const card = document.createElement("div"); card.className = "qr-card";
      card.innerHTML = `<img class="l" src="../img/deed-logo.png" alt="DEED"><div class="t">Drive your dream. Pay 30%.</div>${qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true })}
        <div class="p">${esc(p.name)} · ${esc(label)}</div><div class="u">${esc(url)}</div><button class="btn btn-sm" style="margin-top:8px">${icon("dl")} SVG</button>`;
      card.querySelector("button").onclick = () => {
        const blob = new Blob([card.querySelector("svg").outerHTML], { type: "image/svg+xml" });
        const el = document.createElement("a"); el.href = URL.createObjectURL(blob); el.download = `qr-${p.id}-${src}.svg`; el.click();
      };
      grid.appendChild(card);
    });
  };
  document.getElementById("qr-make").onclick = make;
  document.getElementById("qr-print").onclick = () => window.print();
  make();
}

/* ------------------------------------------------------------------ */
/* Modal helpers                                                       */
/* ------------------------------------------------------------------ */
function openModal(html, wide) {
  modalRoot.innerHTML = `<div class="scrim top" data-mclose></div><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  modalRoot.querySelectorAll("[data-mclose]").forEach((b) => (b.onclick = closeModal));
  const first = modalRoot.querySelector("input:not([disabled]), select, textarea");
  if (first) first.focus();
}
function closeModal() { modalRoot.innerHTML = ""; }
