/*
 * Campaign settings. This is the ONLY file you need to edit to go live.
 * Everything marked TODO is a placeholder.
 */
window.DEED_CONFIG = {
  // Google Apps Script web app URL (see docs/GOOGLE_SHEET_SETUP.md).
  // Leave empty to run in demo mode: the form works but nothing is saved.
  SHEET_ENDPOINT: "",

  // TODO: DEED's real numbers. International format, digits only, no "+".
  WHATSAPP_NUMBER: "256700000000",
  CALL_NUMBER: "+256700000000",

  // TODO: real names.
  BRAND_NAME: "DEED Microfinance",
  PARTNER_NAME: "Partner Car Bond",

  // Split shown in the calculator.
  CONTRIBUTION_PCT: 30,

  // TODO: replace with DEED-approved loan terms.
  REPAYMENT_OPTIONS: ["Not sure yet", "12 months", "24 months", "36 months", "48 months"],

  // Pre-filled WhatsApp message from the customer to DEED.
  WHATSAPP_MESSAGE:
    "Hello DEED Microfinance, I'm interested in vehicle financing (30% contribution). Please contact me."
};
