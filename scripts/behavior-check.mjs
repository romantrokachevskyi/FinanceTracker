import vm from "node:vm";

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createAppHarness(source, initialState, { failWrites = false } = {}) {
  const values = new Map();
  if (initialState !== undefined) values.set("financeTrackerStateV1", JSON.stringify(initialState));
  let writes = 0;
  const elements = new Map();
  let document;
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const listeners = {};
    const attributes = new Map();
    const value = {
      id, hidden: false, value: "", textContent: "", className: "", disabled: false, placeholder: "",
      classList: { toggle() {} },
      addEventListener(type, listener) { listeners[type] = listener; },
      dispatch(type, event = {}) { return listeners[type]?.({ preventDefault() {}, ...event }); },
      setAttribute(name, next) { attributes.set(name, String(next)); },
      removeAttribute(name) { attributes.delete(name); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      focus() { document.activeElement = value; },
      requestSubmit() { return value.dispatch("submit"); },
      showModal() {}, close() {}
    };
    elements.set(id, value);
    return value;
  }
  document = { activeElement: null, getElementById: element };
  const localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (failWrites) throw new Error("storage unavailable");
      writes += 1;
      values.set(key, String(value));
    }
  };
  const window = { matchMedia: () => ({ matches: false }), addEventListener() {} };
  const context = vm.createContext({ document, localStorage, window, navigator: { userAgent: "", platform: "", maxTouchPoints: 0 }, Intl, Date });
  vm.runInContext(source, context);
  return { context, element, localStorage, get writes() { return writes; } };
}

export function checkBehavior(source) {
  const failures = [];
  const requireBehavior = (condition, message) => { if (!condition) failures.push(message); };
  const activeState = {
    balance: 10000,
    startDate: localDate(-1),
    salaryDate: localDate(10),
    currentBalance: 9000,
    currentBalanceDate: localDate(),
    schemaVersion: 3,
    futureField: { preserved: true }
  };
  const app = createAppHarness(source, activeState);
  const parseMoney = (value) => vm.runInContext(`parseMoneyInput(${JSON.stringify(value)})`, app.context);
  for (const [input, expected] of [["8 500,25", 8500.25], ["8\u00a0500.25 ₴", 8500.25], ["₴ 8500", 8500]]) {
    requireBehavior(parseMoney(input) === expected, `money input should accept ${JSON.stringify(input)}`);
  }
  for (const input of ["12 34", "₴1₴2", "1.234,56", "-1", "1,234", "Infinity", ""]) {
    requireBehavior(parseMoney(input) === null, `money input should reject ${JSON.stringify(input)}`);
  }

  const checkIn = app.element("checkInBalance");
  checkIn.value = "8 500,25";
  checkIn.dispatch("input");
  requireBehavior(app.writes === 0, "balance preview must not write storage");
  requireBehavior(app.element("checkInPreview").textContent.includes("на день"), "valid balance must produce a preview");
  app.element("checkInForm").dispatch("submit");
  const saved = JSON.parse(app.localStorage.getItem("financeTrackerStateV1"));
  requireBehavior(app.writes === 1, "balance submit must write exactly once");
  requireBehavior(saved.currentBalance === 8500.25, "balance submit must store the parsed amount");
  requireBehavior(saved.schemaVersion === 3 && saved.futureField.preserved, "balance submit must preserve future schema data");

  const keyboardApp = createAppHarness(source, activeState);
  keyboardApp.element("checkInBalance").value = "9000";
  keyboardApp.element("checkInBalance").dispatch("keydown", { key: "Enter" });
  requireBehavior(keyboardApp.writes === 1, "Enter must submit the balance exactly once");

  const cancelApp = createAppHarness(source, activeState);
  cancelApp.element("showCheckIn").dispatch("click");
  cancelApp.element("cancelCheckIn").dispatch("click");
  requireBehavior(cancelApp.writes === 0, "cancel must not write storage");
  requireBehavior(cancelApp.element("showCheckIn").getAttribute("aria-expanded") === "false", "cancel must collapse the balance form");
  requireBehavior(cancelApp.context.document.activeElement?.id === "showCheckIn", "cancel must restore focus to its trigger");

  const failedApp = createAppHarness(source, activeState, { failWrites: true });
  failedApp.element("checkInBalance").value = "8000";
  failedApp.element("checkInForm").dispatch("submit");
  requireBehavior(JSON.parse(failedApp.localStorage.getItem("financeTrackerStateV1")).currentBalance === 9000, "failed storage write must preserve the prior balance");
  requireBehavior(Boolean(failedApp.element("checkInFormError").textContent), "failed storage write must show an error");

  const paydayState = { ...activeState, startDate: localDate(-10), salaryDate: localDate() };
  const paydayApp = createAppHarness(source, paydayState);
  paydayApp.element("checkInBalance").value = "8000";
  paydayApp.element("checkInForm").dispatch("submit");
  requireBehavior(paydayApp.writes === 0, "payday rollover must block balance writes");
  requireBehavior(!paydayApp.element("payday").hidden, "payday rollover must remain visible after a blocked submit");
  return failures;
}
