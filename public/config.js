/*
 * Campaign settings. This is the ONLY file you need to edit to go live.
 * Everything marked TODO is a placeholder.
 */
window.DEED_CONFIG = {
  // Leads are saved to Firebase (see firebase-config.js) for the staff portal.
  // Optional backup copy to a Google Sheet: Apps Script web app URL (docs/GOOGLE_SHEET_SETUP.md).
  // With neither set, the form runs in demo mode: it works but nothing is saved.
  SHEET_ENDPOINT: "https://script.google.com/macros/s/AKfycbzbjZEoWX-lHosR10jjdw_gpIwM1ZNuMMdH9eKfugiUUeTxSKEQZDvycCnpUjbj5-i6/exec",

  // WhatsApp: international format, digits only. Call: one or more numbers separated by "/".
  WHATSAPP_NUMBER: "256758511610",
  CALL_NUMBER: "+256 758 511610 / +256 781 048434",

  BRAND_NAME: "DEED Microfinance",

  // Partner car bonds. The QR link says which one: ?bond=banda_bond
  // Bonds added in the staff portal work automatically once Firebase is connected;
  // this list is only the offline fallback for showing the name.
  PARTNERS: { banda_bond: "Banda Bond" },
  DEFAULT_PARTNER_NAME: "our partner car bonds",

  // Lead reference prefix: DEEDVFC-2026-0001, ... (2-10 capital letters, a dash, a 4-digit year, a dash)
  LEAD_PREFIX: "DEEDVFC-2026-",

  // Split shown in the calculator.
  CONTRIBUTION_PCT: 30,

  // TODO: replace with DEED-approved loan terms.
  REPAYMENT_OPTIONS: ["Not sure yet", "12 months", "24 months", "36 months", "48 months"],

  // Pre-filled WhatsApp message from the customer to DEED.
  WHATSAPP_MESSAGE:
    "Hello DEED Microfinance, I'm interested in vehicle financing (30% contribution). Please contact me."
};
