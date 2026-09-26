// Applies the saved colour theme before the first paint, so a dark choice never flashes light.
// A file rather than an inline script, since the content security policy allows only the app's
// own scripts. Light is the default (D61).
(function () {
  var theme = 'light';
  try {
    if (localStorage.getItem('theme') === 'dark') theme = 'dark';
  } catch {
    // Storage can be unavailable (private mode); the default applies.
  }
  document.documentElement.dataset.theme = theme;
})();
