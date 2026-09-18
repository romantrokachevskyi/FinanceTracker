import vm from "node:vm";

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TEST_AD_PUBLISHER = "ca-app-pub-3940256099942544";

const defaultConsentInfo = { status: "NOT_REQUIRED", isConsentFormAvailable: false, canRequestAds: true };
// UMP returns updated consent once the user has answered the form, so the fake
// must too, or the app would look like it ignores its own consent gate.
const defaultConsentAfterForm = { status: "OBTAINED", isConsentFormAvailable: true, canRequestAds: true };

function createAppHarness(source, initialState, { failReads = false, failWrites = false, locale, ads, capacitor = false, consentInfo = defaultConsentInfo, consentAfterForm = defaultConsentAfterForm } = {}) {
  const values = new Map();
  if (initialState !== undefined) values.set("financeTrackerStateV1", JSON.stringify(initialState));
  if (locale !== undefined) values.set("financeTrackerLocaleV1", locale);
  if (ads !== undefined) values.set("financeTrackerAdsV1", typeof ads === "string" ? ads : JSON.stringify(ads));
  let writes = 0;
  const writesByKey = new Map();
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
  const documentListeners = {};
  document = {
    activeElement: null, title: "", documentElement: { lang: "uk" }, getElementById: element,
    addEventListener(type, listener) { (documentListeners[type] ??= []).push(listener); },
    dispatch(type, event = {}) { for (const listener of documentListeners[type] ?? []) listener(event); }
  };
  const localStorage = {
    getItem(key) {
      if (failReads) throw new Error("storage unavailable");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (failWrites) throw new Error("storage unavailable");
      writes += 1;
      writesByKey.set(key, (writesByKey.get(key) ?? 0) + 1);
      values.set(key, String(value));
    }
  };
  const window = { matchMedia: () => ({ matches: false }), addEventListener() {} };
  const adCalls = [];
  if (capacitor) {
    const record = (name, result) => (...args) => {
      adCalls.push({ name, args });
      return Promise.resolve(result);
    };
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        AdMob: {
          initialize: record("initialize"),
          requestConsentInfo: record("requestConsentInfo", consentInfo),
          showConsentForm: record("showConsentForm", consentAfterForm),
          showBanner: record("showBanner"),
          hideBanner: record("hideBanner"),
          resumeBanner: record("resumeBanner"),
          showPrivacyOptionsForm: record("showPrivacyOptionsForm"),
          addListener: record("addListener", { remove() {} })
        }
      }
    };
  }
  const context = vm.createContext({ document, localStorage, window, navigator: { userAgent: "", platform: "", maxTouchPoints: 0 }, Intl, Date });
  vm.runInContext(source, context);
  return {
    context, element, document, localStorage, adCalls,
    adCallNames() { return adCalls.map((call) => call.name); },
    get writes() { return writes; },
    writesFor(key) { return writesByKey.get(key) ?? 0; }
  };
}

export async function checkBehavior(source) {
  const failures = [];
  const requireBehavior = (condition, message) => { if (!condition) failures.push(message); };
  const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
  const storedAdState = (app) => { try { return JSON.parse(app.localStorage.getItem("financeTrackerAdsV1")); } catch (error) { return null; } };
  const activeState = {
    balance: 10000,
    startDate: localDate(-1),
    salaryDate: localDate(10),
    currentBalance: 9000,
    currentBalanceDate: localDate(),
    schemaVersion: 3,
    futureField: { preserved: true }
  };
  const countedToday = { visits: 1, lastVisitDate: localDate() };
  const app = createAppHarness(source, activeState, { ads: countedToday });
  requireBehavior(app.context.document.documentElement.lang === "uk", "Ukrainian must remain the default locale");
  requireBehavior(app.element("localeToggle").textContent === "EN", "default locale switch must offer English");

  const englishApp = createAppHarness(source, activeState, { locale: "en" });
  requireBehavior(englishApp.context.document.documentElement.lang === "en", "saved English preference must update the document language");
  requireBehavior(englishApp.context.document.title === "Until payday", "English locale must translate the document title");
  requireBehavior(englishApp.element("localeToggle").textContent === "UA", "English locale switch must offer Ukrainian");
  requireBehavior(englishApp.element("freshness").textContent.includes("today"), "English locale must translate dynamic freshness text");
  requireBehavior(englishApp.element("daysLeft").textContent.includes("days"), "English locale must translate dynamic day counts");

  const localeApp = createAppHarness(source, activeState);
  const financialStateBeforeLocaleChange = localeApp.localStorage.getItem("financeTrackerStateV1");
  localeApp.element("localeToggle").dispatch("click");
  requireBehavior(localeApp.localStorage.getItem("financeTrackerLocaleV1") === "en", "locale switch must persist English preference");
  requireBehavior(localeApp.writesFor("financeTrackerLocaleV1") === 1, "locale switch must write its preference exactly once");
  requireBehavior(localeApp.localStorage.getItem("financeTrackerStateV1") === financialStateBeforeLocaleChange, "locale switch must not rewrite financial state");
  requireBehavior(localeApp.element("currentBalance").textContent.includes("9,000"), "English locale must re-render localized money");

  const openCheckInApp = createAppHarness(source, activeState);
  openCheckInApp.element("showCheckIn").dispatch("click");
  openCheckInApp.element("checkInBalance").value = "8500";
  openCheckInApp.element("checkInBalance").dispatch("input");
  openCheckInApp.element("localeToggle").dispatch("click");
  requireBehavior(!openCheckInApp.element("checkInPanel").hidden, "locale switch must keep an open balance check-in visible");
  requireBehavior(openCheckInApp.element("checkInBalance").value === "8500", "locale switch must preserve an in-progress balance entry");
  requireBehavior(openCheckInApp.element("checkInPreview").textContent.includes("per day"), "locale switch must translate an in-progress balance preview");

  const unknownLocaleApp = createAppHarness(source, activeState, { locale: "fr", ads: countedToday });
  requireBehavior(unknownLocaleApp.context.document.documentElement.lang === "uk", "unknown locale preference must safely fall back to Ukrainian");
  requireBehavior(unknownLocaleApp.writes === 0, "unknown locale fallback must not eagerly rewrite storage");

  const unreadableApp = createAppHarness(source, undefined, { failReads: true });
  requireBehavior(unreadableApp.element("savePlan").disabled, "unreadable storage must block plan creation");
  unreadableApp.element("localeToggle").dispatch("click");
  requireBehavior(unreadableApp.element("savePlan").disabled, "locale switch must keep plan creation blocked when storage is unreadable");
  requireBehavior(!unreadableApp.element("retryStorage").hidden, "locale switch must keep storage recovery available");
  const parseMoney = (value) => vm.runInContext(`parseMoneyInput(${JSON.stringify(value)})`, app.context);
  for (const [input, expected] of [["8 500,25", 8500.25], ["8\u00a0500.25 ₴", 8500.25], ["₴ 8500", 8500]]) {
    requireBehavior(parseMoney(input) === expected, `money input should accept ${JSON.stringify(input)}`);
  }
  for (const input of ["12 34", "₴1₴2", "1.234,56", "-1", "1,234", "Infinity", ""]) {
    requireBehavior(parseMoney(input) === null, `money input should reject ${JSON.stringify(input)}`);
  }

  const staleState = { ...activeState, currentBalanceDate: localDate(-1) };
  const staleApp = createAppHarness(source, staleState);
  requireBehavior(staleApp.element("dailyAmount").textContent !== "—", "saved balance must keep producing a daily allowance until updated");
  requireBehavior(staleApp.element("dailyAmount").textContent.includes("₴"), "saved balance allowance must render as money");
  requireBehavior(!staleApp.element("differenceRow").hidden, "saved balance must keep showing the difference from plan");
  requireBehavior(staleApp.element("difference").textContent.includes("₴"), "saved balance difference must render as money");
  requireBehavior(staleApp.element("freshness").textContent.includes("вчора"), "saved balance age must remain visible");

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

  const keyboardApp = createAppHarness(source, activeState, { ads: countedToday });
  keyboardApp.element("checkInBalance").value = "9000";
  keyboardApp.element("checkInBalance").dispatch("keydown", { key: "Enter" });
  requireBehavior(keyboardApp.writesFor("financeTrackerStateV1") === 1, "Enter must submit the balance exactly once");
  requireBehavior(keyboardApp.writes === 1, "Enter must not write anything besides the balance");

  const cancelApp = createAppHarness(source, activeState, { ads: countedToday });
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

  const invalidEnglishApp = createAppHarness(source, activeState, { locale: "en" });
  invalidEnglishApp.element("checkInBalance").value = "invalid";
  invalidEnglishApp.element("checkInForm").dispatch("submit");
  requireBehavior(invalidEnglishApp.element("checkInBalanceError").textContent.includes("valid balance"), "English locale must translate validation errors");

  const paydayState = { ...activeState, startDate: localDate(-10), salaryDate: localDate() };
  const paydayApp = createAppHarness(source, paydayState, { ads: countedToday });
  paydayApp.element("checkInBalance").value = "8000";
  paydayApp.element("checkInForm").dispatch("submit");
  requireBehavior(paydayApp.writes === 0, "payday rollover must block balance writes");
  requireBehavior(!paydayApp.element("payday").hidden, "payday rollover must remain visible after a blocked submit");

  const firstVisitApp = createAppHarness(source, activeState);
  const firstVisit = storedAdState(firstVisitApp);
  requireBehavior(firstVisitApp.writesFor("financeTrackerAdsV1") === 1, "a first ever open must record the visit exactly once");
  requireBehavior(firstVisit?.visits === 1 && firstVisit?.lastVisitDate === localDate(), "a first ever open must start the visit counter at today");

  const sameDayApp = createAppHarness(source, activeState, { ads: { visits: 3, lastVisitDate: localDate() } });
  requireBehavior(sameDayApp.writesFor("financeTrackerAdsV1") === 0, "a second open on the same day must not rewrite the visit counter");

  const nextDayApp = createAppHarness(source, activeState, { ads: { visits: 3, lastVisitDate: localDate(-1) } });
  const nextDayVisit = storedAdState(nextDayApp);
  requireBehavior(nextDayApp.writesFor("financeTrackerAdsV1") === 1, "an open on a later day must record the visit exactly once");
  requireBehavior(nextDayVisit?.visits === 4 && nextDayVisit?.lastVisitDate === localDate(), "an open on a later day must count one more visit");

  const bannerApp = createAppHarness(source, activeState, { capacitor: true, ads: { visits: 9, lastVisitDate: localDate(-1) } });
  await flush();
  const bannerOptions = bannerApp.adCalls.find((call) => call.name === "showBanner")?.args[0];
  // Read the configured unit out of the source so swapping test IDs for real
  // ones stays a two-string edit and does not drag the suite along with it.
  const configuredAdId = source.match(/const AD_BANNER_ID="([^"]+)"/)?.[1] ?? null;
  requireBehavior(Boolean(bannerOptions), "the tenth day of use must show the banner");
  requireBehavior(bannerOptions?.position === "BOTTOM_CENTER", "the banner must stay anchored to the bottom");
  requireBehavior(bannerOptions?.adSize === "ADAPTIVE_BANNER", "the banner must size itself adaptively");
  requireBehavior(bannerOptions?.adId === configuredAdId, "the banner must request the configured ad unit");
  requireBehavior(bannerOptions?.isTesting === configuredAdId?.startsWith(TEST_AD_PUBLISHER), "test ads must be requested for a Google test unit, and only for one");

  // With the keyboard up the SDK re-anchors the banner above it, which puts an
  // ad over the field being typed in. A focused text field is the keyboard.
  const field = { tagName: "INPUT" }, otherField = { tagName: "INPUT" }, button = { tagName: "BUTTON" };
  bannerApp.document.dispatch("focusin", { target: button });
  bannerApp.document.dispatch("focusin", { target: { tagName: "INPUT", type: "date" } });
  requireBehavior(!bannerApp.adCallNames().includes("hideBanner"), "a button or a date picker must leave the banner up");
  bannerApp.document.dispatch("focusin", { target: field });
  requireBehavior(bannerApp.adCallNames().includes("hideBanner"), "typing into a field must hide the banner");
  bannerApp.document.dispatch("focusout", { target: field, relatedTarget: otherField });
  requireBehavior(!bannerApp.adCallNames().includes("resumeBanner"), "moving between fields must keep the banner hidden");
  bannerApp.document.dispatch("focusout", { target: otherField, relatedTarget: null });
  requireBehavior(bannerApp.adCallNames().includes("resumeBanner"), "leaving the fields must bring the banner back");

  const focusedAtStartApp = createAppHarness(source, activeState, { capacitor: true, ads: { visits: 20, lastVisitDate: localDate() } });
  focusedAtStartApp.document.activeElement = field;
  await flush();
  requireBehavior(focusedAtStartApp.adCallNames().includes("hideBanner"), "a field already focused when the banner arrives must hide it");

  const englishAdPrivacyApp = createAppHarness(source, activeState, { locale: "en" });
  requireBehavior(englishAdPrivacyApp.element("adPrivacy").textContent === "Ad settings", "the ad settings button must be translated");

  const belowThresholdApp = createAppHarness(source, activeState, { capacitor: true, ads: { visits: 8, lastVisitDate: localDate(-1) } });
  await flush();
  requireBehavior(!belowThresholdApp.adCallNames().includes("showBanner"), "the ninth day of use must stay free of ads");

  const consentApp = createAppHarness(source, activeState, {
    capacitor: true,
    ads: { visits: 20, lastVisitDate: localDate() },
    consentInfo: { status: "REQUIRED", isConsentFormAvailable: true, canRequestAds: true }
  });
  await flush();
  const consentNames = consentApp.adCallNames();
  requireBehavior(consentNames.includes("showConsentForm"), "required consent must present the consent form");
  requireBehavior(consentNames.indexOf("showConsentForm") < consentNames.indexOf("showBanner"), "consent must be gathered before the banner appears");

  // EEA and UK users must be able to reopen their consent choice at any time.
  // UMP says when that applies; the entry point must exist whether or not the
  // user ended up allowing ads.
  const privacyOptionsApp = createAppHarness(source, activeState, {
    capacitor: true,
    ads: { visits: 20, lastVisitDate: localDate() },
    consentInfo: { status: "REQUIRED", isConsentFormAvailable: true, canRequestAds: false },
    consentAfterForm: { status: "REQUIRED", isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" }
  });
  privacyOptionsApp.element("adPrivacy").hidden = true;
  await flush();
  requireBehavior(privacyOptionsApp.element("adPrivacy").hidden === false, "required privacy options must show the ad settings button");
  privacyOptionsApp.element("adPrivacy").dispatch("click");
  requireBehavior(privacyOptionsApp.adCallNames().includes("showPrivacyOptionsForm"), "the ad settings button must open the privacy options form");
  bannerApp.element("adPrivacy").dispatch("click");
  requireBehavior(!bannerApp.adCallNames().includes("showPrivacyOptionsForm"), "the ad settings button must stay inert where privacy options are not required");

  const refusedConsentApp = createAppHarness(source, activeState, {
    capacitor: true,
    ads: { visits: 20, lastVisitDate: localDate() },
    consentInfo: { status: "REQUIRED", isConsentFormAvailable: false, canRequestAds: false }
  });
  await flush();
  // The positive control keeps the two negatives below from passing merely
  // because the promise chain had not got that far yet.
  requireBehavior(refusedConsentApp.adCallNames().includes("requestConsentInfo"), "the ad flow must reach the consent decision before it gives up");
  requireBehavior(!refusedConsentApp.adCallNames().includes("showConsentForm"), "an unavailable consent form must not be requested");
  requireBehavior(!refusedConsentApp.adCallNames().includes("showBanner"), "ads must not be requested without consent");
  refusedConsentApp.document.dispatch("focusin", { target: field });
  refusedConsentApp.document.dispatch("focusout", { target: field, relatedTarget: null });
  requireBehavior(!refusedConsentApp.adCallNames().some((name) => name === "hideBanner" || name === "resumeBanner"), "fields must not touch a banner that was never shown");

  // The form was shown and the user did not consent. canRequestAds is absent, as
  // it can be on an error path, so only the status stands between us and an ad.
  const dismissedConsentApp = createAppHarness(source, activeState, {
    capacitor: true,
    ads: { visits: 20, lastVisitDate: localDate() },
    consentInfo: { status: "REQUIRED", isConsentFormAvailable: true },
    consentAfterForm: { status: "REQUIRED", isConsentFormAvailable: true }
  });
  await flush();
  requireBehavior(dismissedConsentApp.adCallNames().includes("showConsentForm"), "a dismissed consent test must actually reach the form");
  requireBehavior(!dismissedConsentApp.adCallNames().includes("showBanner"), "a dismissed consent form must leave the banner unshown");

  const malformedAdsApp = createAppHarness(source, activeState, { ads: "{not json" });
  const repairedVisit = storedAdState(malformedAdsApp);
  requireBehavior(Boolean(malformedAdsApp.element("dailyAmount").textContent), "a malformed visit counter must not stop the dashboard");
  requireBehavior(repairedVisit?.visits === 1 && repairedVisit?.lastVisitDate === localDate(), "a malformed visit counter must be replaced by a fresh count");

  const webApp = createAppHarness(source, activeState, { ads: { visits: 50, lastVisitDate: localDate(-1) } });
  await flush();
  requireBehavior(webApp.adCalls.length === 0, "the web build must never call the ad SDK");
  requireBehavior(Boolean(webApp.element("dailyAmount").textContent), "the web build must keep rendering the dashboard");

  const failedCounterApp = createAppHarness(source, activeState, { failWrites: true });
  requireBehavior(Boolean(failedCounterApp.element("dailyAmount").textContent), "a failed visit counter write must not break the dashboard");

  return failures;
}
