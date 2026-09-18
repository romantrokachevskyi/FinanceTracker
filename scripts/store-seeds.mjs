// Demo states for store screenshots, shared by the local server
// (scripts/serve.mjs, ?seed=<name>) and the device capture
// (scripts/capture-store.mjs). Dates are relative to today so every capture
// shows the same situation.

function daysFromToday(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function inProgressPlan() {
  return {
    balance: 18000,
    startDate: daysFromToday(-9),
    salaryDate: daysFromToday(12),
    currentBalance: 13200,
    currentBalanceDate: daysFromToday(0),
    schemaVersion: 2
  };
}

// `open` names a button the capture clicks once the app has rendered.
export const SEEDS = {
  setup: () => ({ state: null }),
  dashboard: () => ({ state: inProgressPlan() }),
  checkin: () => ({ state: inProgressPlan(), open: "showCheckIn" }),
  payday: () => ({
    state: {
      balance: 18000,
      startDate: daysFromToday(-21),
      salaryDate: daysFromToday(0),
      currentBalance: 900,
      currentBalanceDate: daysFromToday(0),
      schemaVersion: 2
    }
  })
};

// Store listing language → Android locale, which also sets date formats.
export const STORE_LANGUAGES = { en: "en-US", uk: "uk-UA" };

// Screenshot file name → seed, in listing order.
export const STORE_SHOTS = {
  "01-setup": "setup",
  "02-dashboard": "dashboard",
  "03-checkin": "checkin",
  "04-payday": "payday"
};
