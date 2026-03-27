document.addEventListener("DOMContentLoaded", function () {
  var btn = document.querySelector(".nav-toggle");
  if (!btn) return;
  var nav = btn.closest(".sidebar");
  btn.addEventListener("click", function () {
    var open = nav.classList.toggle("sidebar-open");
    btn.setAttribute("aria-expanded", String(open));
  });
});
