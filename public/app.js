(function () {
  "use strict";

  var cfg = window.DEED_CONFIG || {};
  var PCT = Number(cfg.CONTRIBUTION_PCT) || 30;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- helpers ---------- */
  function digits(v) { return String(v || "").replace(/\D/g, ""); }
  function toNum(v) { var d = digits(v); return d ? Number(d) : 0; }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function store(key, val) {
    try {
      if (val === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function normalizePhone(v) {
    var d = digits(v);
    if (/^07\d{8}$/.test(d)) return "+256" + d.slice(1);
    if (/^2567\d{8}$/.test(d)) return "+" + d;
    if (/^7\d{8}$/.test(d)) return "+256" + d;
    return null;
  }
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- campaign source (?source=...) ---------- */
  var params = new URLSearchParams(location.search);
  var rawSource = params.get("source") || params.get("utm_source") || store("deed_source") || "direct";
  var SOURCE = String(rawSource).toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 60) || "direct";
  store("deed_source", SOURCE);
  var LANDED_AT = store("deed_landed") || new Date().toISOString();
  store("deed_landed", LANDED_AT);

  /* ---------- config into page ---------- */
  $$("[data-brand]").forEach(function (el) { if (cfg.BRAND_NAME) el.textContent = cfg.BRAND_NAME; });
  $$("[data-partner]").forEach(function (el) { if (cfg.PARTNER_NAME) el.textContent = cfg.PARTNER_NAME; });
  $$("[data-pct-you]").forEach(function (el) { el.textContent = PCT; });
  $$("[data-pct-deed]").forEach(function (el) { el.textContent = 100 - PCT; });

  var waUrl = "https://wa.me/" + digits(cfg.WHATSAPP_NUMBER) + "?text=" + encodeURIComponent(cfg.WHATSAPP_MESSAGE || "Hello DEED Microfinance");
  $$("[data-whatsapp]").forEach(function (a) { a.href = waUrl; });
  $$("[data-call]").forEach(function (a) { a.href = "tel:" + String(cfg.CALL_NUMBER || "").replace(/[^\d+]/g, ""); });

  var repay = $("#repayment_period");
  (cfg.REPAYMENT_OPTIONS || ["Not sure yet"]).forEach(function (o, i) {
    var opt = document.createElement("option");
    opt.textContent = o; opt.value = i === 0 && /not sure/i.test(o) ? "" : o;
    repay.appendChild(opt);
  });

  /* ---------- money input formatting ---------- */
  function bindMoney(input, onChange) {
    input.addEventListener("input", function () {
      var n = toNum(input.value);
      input.value = n ? fmt(n) : "";
      if (onChange) onChange(n);
    });
  }

  /* ---------- calculator ---------- */
  var calcPrice = $("#calc-price");
  var calcHave = $("#calc-have");
  function renderCalc() {
    var price = toNum(calcPrice.value);
    $("#calc-you").textContent = fmt(price * PCT / 100);
    $("#calc-deed").textContent = fmt(price * (100 - PCT) / 100);
    $$(".chip").forEach(function (c) { c.classList.toggle("is-active", Number(c.dataset.price) === price); });
    renderReady();
  }
  function renderReady() {
    var price = toNum(calcPrice.value);
    var need = price * PCT / 100;
    var have = toNum(calcHave.value);
    var fill = $("#ready-fill"), msg = $("#ready-msg");
    if (!price || !calcHave.value) {
      fill.style.width = "0"; fill.classList.remove("full");
      msg.textContent = price ? "Enter an amount to see how close you are." : "Enter a vehicle price first.";
      return;
    }
    var ratio = Math.min(have / need, 1);
    fill.style.width = (ratio * 100).toFixed(0) + "%";
    fill.classList.toggle("full", have >= need);
    if (have >= need) msg.textContent = "You have the full " + PCT + "% contribution. You're ready to apply!";
    else msg.textContent = "You have " + Math.floor(ratio * 100) + "% of the contribution. UGX " + fmt(need - have) + " to go. You can still apply and talk to an officer.";
  }
  bindMoney(calcPrice, renderCalc);
  bindMoney(calcHave, renderReady);
  $$(".chip").forEach(function (c) {
    c.addEventListener("click", function () { calcPrice.value = fmt(Number(c.dataset.price)); renderCalc(); });
  });
  $("#calc-apply").addEventListener("click", function () {
    var p = toNum(calcPrice.value);
    if (p) { $("#vehicle_price").value = fmt(p); renderPriceSplit(); }
    var h = toNum(calcHave.value);
    if (h && calcHave.value) $("#available_contribution").value = fmt(h);
  });
  renderCalc();

  /* ---------- multi-step form ---------- */
  var form = $("#lead-form");
  var steps = $$(".step", form);
  var current = 0;
  var btnBack = $("#btn-back"), btnNext = $("#btn-next"), btnSubmit = $("#btn-submit");
  var formError = $("#form-error");

  $$("[data-money]", form).forEach(function (i) { bindMoney(i); });
  function renderPriceSplit() {
    var p = toNum($("#vehicle_price").value);
    $("#price-split").textContent = p ? "Your " + PCT + "%: UGX " + fmt(p * PCT / 100) + " · Financing " + (100 - PCT) + "%: UGX " + fmt(p * (100 - PCT) / 100) : "";
  }
  $("#vehicle_price").addEventListener("input", renderPriceSplit);

  function applyShowIf() {
    $$("[data-show-if]", form).forEach(function (el) {
      var parts = el.dataset.showIf.split("=");
      var checked = form.querySelector('input[name="' + parts[0] + '"]:checked');
      el.hidden = !(checked && checked.value === parts[1]);
    });
  }
  form.addEventListener("change", applyShowIf);
  applyShowIf();

  function showStep(i) {
    current = i;
    steps.forEach(function (s, idx) { s.hidden = idx !== i; });
    btnBack.hidden = i === 0;
    btnNext.hidden = i === steps.length - 1;
    btnSubmit.hidden = i !== steps.length - 1;
    $("#progress-fill").style.width = ((i + 1) / steps.length * 100) + "%";
    $("#step-count").textContent = "Step " + (i + 1) + " of " + steps.length;
    formError.hidden = true;
  }

  function setError(field, msg) {
    var wrap = field.closest(".field") || field.closest(".check");
    if (!wrap) return;
    wrap.classList.add("has-error");
    if (wrap.classList.contains("field")) {
      var m = wrap.querySelector(".field-msg");
      if (!m) { m = document.createElement("p"); m.className = "field-msg"; wrap.appendChild(m); }
      m.textContent = msg;
    }
  }
  function clearErrors(scope) {
    $$(".has-error", scope).forEach(function (w) { w.classList.remove("has-error"); });
    $$(".field-msg", scope).forEach(function (m) { m.remove(); });
  }

  function validateScope(scope) {
    clearErrors(scope);
    var firstBad = null;
    var seenRadio = {};
    $$("input, select, textarea", scope).forEach(function (el) {
      if (el.closest("[hidden]") && el.closest("[hidden]") !== scope) return;
      if (el.closest(".hp")) return;
      var bad = null;
      if (el.type === "radio") {
        if (seenRadio[el.name]) return;
        seenRadio[el.name] = true;
        var group = $$('input[name="' + el.name + '"]', scope);
        var req = group.some(function (g) { return g.required; });
        if (req && !group.some(function (g) { return g.checked; })) bad = "Please choose an option.";
      } else if (el.type === "checkbox") {
        if (el.required && !el.checked) bad = "Required";
      } else {
        var v = el.value.trim();
        var rule = el.dataset.validate;
        if (el.required && !v) bad = "This field is required.";
        else if (rule === "ug-phone" && !normalizePhone(v)) bad = "Enter a Ugandan mobile number, e.g. 0772123456 or +256772123456.";
        else if (rule === "ug-phone-optional" && v && !normalizePhone(v)) bad = "Check this number, or leave it empty.";
        else if (rule === "year-optional" && v && !(/^\d{4}$/.test(v) && +v >= 1980 && +v <= new Date().getFullYear() + 1)) bad = "Enter a 4-digit year.";
        else if (rule === "money" && toNum(v) < 1000000) bad = "Enter the price in UGX, e.g. 30,000,000.";
        else if (rule === "money-zero" && !digits(v)) bad = "Enter an amount (0 if none yet).";
      }
      if (bad) { setError(el, bad); if (!firstBad) firstBad = el; }
    });
    if (firstBad) {
      var target = firstBad.type === "radio" ? firstBad.closest(".field") : firstBad;
      (target.closest(".field") || target).scrollIntoView({ behavior: "smooth", block: "center" });
      if (firstBad.type !== "radio") firstBad.focus({ preventScroll: true });
    }
    return !firstBad;
  }

  btnNext.addEventListener("click", function () {
    if (!validateScope(steps[current])) return;
    showStep(current + 1);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  btnBack.addEventListener("click", function () { showStep(current - 1); });
  form.addEventListener("input", function (e) {
    var w = e.target.closest(".has-error");
    if (w) { w.classList.remove("has-error"); var m = w.querySelector(".field-msg"); if (m) m.remove(); }
  });

  /* ---------- submission ---------- */
  function collect(f) {
    var data = {};
    new FormData(f).forEach(function (v, k) { data[k] = typeof v === "string" ? v.trim() : v; });
    return data;
  }

  function baseMeta(type) {
    return {
      lead_type: type,
      source: SOURCE,
      submission_id: uid(),
      page_url: location.href.split("#")[0],
      referrer: document.referrer || "",
      landed_at: LANDED_AT,
      submitted_at_client: new Date().toISOString(),
      user_agent: navigator.userAgent.slice(0, 250)
    };
  }

  function ServerError(msg) { this.message = msg; this.server = true; }

  function send(payload) {
    var url = cfg.SHEET_ENDPOINT;
    var body = JSON.stringify(payload);
    if (!url) {
      console.info("[DEED] Demo mode (no SHEET_ENDPOINT). Payload:", payload);
      return new Promise(function (r) { setTimeout(function () { r({ ok: true, lead_id: "DEMO-" + payload.submission_id.slice(0, 6).toUpperCase(), demo: true }); }, 500); });
    }
    var opts = { method: "POST", body: body, headers: { "Content-Type": "text/plain;charset=utf-8" } };
    return fetch(url, opts)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) throw new ServerError((data && data.error) || "Submission failed");
        return data;
      })
      .catch(function (err) {
        if (err && err.server) throw err;
        // Response unreadable (e.g. CORS on redirect). Send opaquely; the script de-duplicates by submission_id.
        return fetch(url, { method: "POST", mode: "no-cors", body: body, headers: opts.headers })
          .then(function () { return { ok: true, lead_id: null }; });
      });
  }

  function failMessage(err) {
    if (err && err.server) return "We couldn't save your details: " + err.message + ". Please try again or WhatsApp us.";
    return "No connection. Please check your internet and try again, or WhatsApp us.";
  }

  var submitting = false;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;
    if (!validateScope(steps[current])) return;
    for (var i = 0; i < steps.length; i++) {
      if (!validateScope(steps[i])) { showStep(i); validateScope(steps[i]); return; }
    }
    var data = collect(form);
    if (data.company_website) { onSuccess({ lead_id: "OK" }); return; } // bot: pretend success

    var payload = Object.assign(baseMeta("Application"), data, {
      phone: normalizePhone(data.phone),
      alt_phone: data.alt_phone ? normalizePhone(data.alt_phone) : "",
      vehicle_price: toNum(data.vehicle_price),
      available_contribution: toNum(data.available_contribution),
      contribution_pct: PCT
    });
    delete payload.company_website;

    submitting = true;
    btnSubmit.disabled = true; btnSubmit.textContent = "Sending…";
    send(payload).then(function (res) {
      onSuccess({ lead_id: res.lead_id || payload.submission_id.slice(0, 8).toUpperCase(), demo: res.demo });
    }).catch(function (err) {
      formError.textContent = failMessage(err);
      formError.hidden = false;
    }).then(function () {
      submitting = false;
      btnSubmit.disabled = false; btnSubmit.textContent = "Submit application";
    });
  });

  function onSuccess(res) {
    form.hidden = true;
    var s = $("#success");
    $("#lead-ref").textContent = res.lead_id;
    s.hidden = false;
    s.focus();
    s.scrollIntoView({ behavior: "smooth", block: "center" });
    if (res.demo) toast("Demo mode: not saved. Add SHEET_ENDPOINT in config.js.");
  }

  /* ---------- call-back dialog ---------- */
  var dlg = $("#callback-dialog");
  var cbForm = $("#callback-form");
  $("#open-callback").addEventListener("click", function () {
    $("#cb-done").hidden = true; $("#cb-error").hidden = true;
    $("#cb-submit").hidden = false;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  });
  $("#cb-cancel").addEventListener("click", function () { dlg.close ? dlg.close() : dlg.removeAttribute("open"); });
  cbForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateScope(cbForm)) return;
    var data = collect(cbForm);
    var btn = $("#cb-submit");
    if (data.company_website) { $("#cb-done").hidden = false; btn.hidden = true; return; }
    var payload = Object.assign(baseMeta("Call-back request"), data, { phone: normalizePhone(data.phone), wants_contact: "Yes" });
    delete payload.company_website;
    btn.disabled = true; btn.textContent = "Sending…";
    send(payload).then(function (res) {
      $("#cb-done").hidden = false; btn.hidden = true; $("#cb-error").hidden = true;
      cbForm.reset();
      if (res.demo) toast("Demo mode: not saved. Add SHEET_ENDPOINT in config.js.");
    }).catch(function (err) {
      var el = $("#cb-error"); el.textContent = failMessage(err); el.hidden = false;
    }).then(function () { btn.disabled = false; btn.textContent = "Call me back"; });
  });

  /* ---------- share ---------- */
  var shareUrl = location.origin + location.pathname + "?source=shared";
  $$("[data-share]").forEach(function (b) {
    b.addEventListener("click", function () {
      var data = { title: "Drive Your Dream. Pay 30%.", text: "Put down 30% and let DEED Microfinance help finance the rest (subject to approval).", url: shareUrl };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      var done = function () { toast("Link copied. Paste it to a friend."); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareUrl).then(done, function () { location.href = "https://wa.me/?text=" + encodeURIComponent(data.text + " " + shareUrl); });
      else location.href = "https://wa.me/?text=" + encodeURIComponent(data.text + " " + shareUrl);
    });
  });

  showStep(0);
})();
