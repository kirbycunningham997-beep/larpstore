// auth.js — toggles the login/signup panes on the landing page without a
// full reload. Works fine without JS too (the links are real URLs).
(function () {
  "use strict";
  function show(pane) {
    document.querySelectorAll(".auth-pane").forEach(function (el) {
      el.hidden = el.getAttribute("data-pane") !== pane;
    });
    var url = pane === "signup" ? "/login?mode=signup" : "/login";
    history.replaceState(null, "", url);
  }
  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-toggle]");
    if (!link) return;
    e.preventDefault();
    show(link.getAttribute("data-toggle"));
  });
})();
