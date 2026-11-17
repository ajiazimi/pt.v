(function initEarlyThemeAndCanonical() {
  try {
    var savedTheme = localStorage.getItem('vv_theme');
    var activeTheme = savedTheme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', activeTheme === 'light' ? '#f8fafc' : '#07070a');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  try {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      var currentUrl = window.location.origin + window.location.pathname;
      var canonicalEl = document.getElementById('canonicalLink');
      var ogUrlEl = document.getElementById('ogUrlMeta');
      if (canonicalEl) canonicalEl.setAttribute('href', currentUrl);
      if (ogUrlEl) ogUrlEl.setAttribute('content', currentUrl);
    }
  } catch (e) {}
})();
