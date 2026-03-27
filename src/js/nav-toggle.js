document.addEventListener("DOMContentLoaded", function () {
  var btn = document.querySelector(".nav-toggle");
  if (!btn) return;
  var nav = btn.closest(".sidebar");

  function close() {
    nav.classList.remove("sidebar-open");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", function () {
    var open = nav.classList.toggle("sidebar-open");
    btn.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("ul a").forEach(function (link) {
    link.addEventListener("click", close);
  });
});
