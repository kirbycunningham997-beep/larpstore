// app.js — light progressive enhancement. The store works without JS; this
// just adds button feedback and dismisses the ?flash notice after a moment.
(function () {
  "use strict";

  // Show a pressed/loading state on checkout submit so double-clicks don't
  // fire twice.
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.getAttribute("action") !== "/checkout") return;
    var btn = form.querySelector("button[type=submit]");
    if (btn) {
      btn.disabled = true;
      btn.dataset.label = btn.textContent;
      btn.textContent = "Processing…";
    }
  });

  // Auto-fade a success/info notice after 6s.
  var notice = document.querySelector(".notice.ok, .notice.info");
  if (notice) {
    setTimeout(function () {
      notice.style.transition = "opacity .4s ease";
      notice.style.opacity = "0";
      setTimeout(function () {
        if (notice.parentNode) notice.parentNode.removeChild(notice);
      }, 450);
    }, 6000);
  }
})();
