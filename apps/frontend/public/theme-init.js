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

    var theme = null;
    if (raw) {
      try {
        theme = JSON.parse(raw).theme;
      } catch (_) {}
    }

    if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      d.classList.add("dark");
      d.style.colorScheme = "dark";
    } else {
      d.classList.remove("dark");
      d.style.colorScheme = "light";
    }
  } catch (_) {}
})();
