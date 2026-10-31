(function () {
  try {
    window.__zod_globalConfig = Object.assign(window.__zod_globalConfig || {}, { jitless: true });
    var d = document.documentElement;

    // Read the tenant-scoped settings key first so a shared browser cannot
    // flash another workspace's theme. `scopedStorageKey('global_settings')`
    // produces `mms_t:<subdomain>:global_settings` on a tenant host and
    // `mms_global_settings` when no subdomain resolves (apex/localhost).
    var host = location.hostname.toLowerCase();
    var dot = host.indexOf(".");
    var subdomain = dot > 0 ? host.slice(0, dot) : host;
    var candidates = [
      "mms_t:" + subdomain + ":global_settings",
      "mms_global_settings",
      "global_settings",
      "globalSettings",
    ];
    var raw = null;
    for (var i = 0; i < candidates.length; i++) {
      var value = localStorage.getItem(candidates[i]);
      if (value) {
        raw = value;
        break;
      }
    }

    var settings = null;
    if (raw) {
      try {
        settings = JSON.parse(raw);
      } catch (_) {}
    }
    var theme = settings ? settings.theme : null;

    var meta = document.querySelector('meta[name="color-scheme"]');
    if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      d.classList.add("dark");
      d.style.colorScheme = "dark";
      if (meta) meta.content = "dark";
    } else {
      d.classList.remove("dark");
      d.style.colorScheme = "light";
      if (meta) meta.content = "light";
    }

    // Language + direction before first paint. Without this, ar/ur/fa tenants
    // lay out LTR until React mounts and the locale pack downloads, then the
    // whole shell mirrors. Kept in sync with `ENTRY_PATHS` in
    // `src/lib/config/routes.ts` by `src/__tests__/themeInitPrelanguage.test.ts`.
    // `isEntryPath` covers `/onboarding`; the platform apex console is always
    // English/LTR (`shouldForcePlatformEnglish`).
    var ENTRY_PATHS = [
      "/login",
      "/forgot-password",
      "/platform/forgot-password",
      "/2fa",
      "/onboarding",
    ];
    var PLATFORM_PREFIX = "/platform";
    var RTL_LANGUAGES = ["ar", "ur", "fa"];
    var FONT_CLASSES = { ar: "font-arabic", ur: "font-urdu", fa: "font-persian" };
    var pathname = location.pathname;

    var forceEnglish = pathname.indexOf(PLATFORM_PREFIX) === 0;
    for (var j = 0; j < ENTRY_PATHS.length && !forceEnglish; j++) {
      var entry = ENTRY_PATHS[j];
      forceEnglish = pathname === entry || pathname.indexOf(entry + "/") === 0;
    }

    var language = "en";
    if (!forceEnglish && settings && typeof settings.language === "string") {
      language = settings.language.toLowerCase();
    }
    if (RTL_LANGUAGES.indexOf(language) === -1) {
      language = "en";
    }

    d.setAttribute("lang", language);
    d.setAttribute("dir", RTL_LANGUAGES.indexOf(language) === -1 ? "ltr" : "rtl");

    var fontNames = ["font-arabic", "font-urdu", "font-persian"];
    for (var k = 0; k < fontNames.length; k++) {
      d.classList.remove(fontNames[k]);
    }
    if (FONT_CLASSES[language]) {
      d.classList.add(FONT_CLASSES[language]);
    }
  } catch (_) {}
})();
