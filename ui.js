(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const preloader = document.createElement("div");
  preloader.className = "site-preloader";
  preloader.innerHTML = '<div class="preloader-mark">↗</div><div class="preloader-line"><span></span></div>';
  document.body.prepend(preloader);

  const reveal = () => {
    document.body.classList.add("ui-ready");
    setTimeout(() => preloader.remove(), reduceMotion ? 0 : 650);
  };
  if (document.fonts?.ready) document.fonts.ready.then(reveal);
  else window.addEventListener("load", reveal, { once: true });

  document.querySelectorAll(".panel, .hero-card, .metric-card").forEach((element, index) => {
    element.classList.add("motion-card");
    element.style.setProperty("--motion-delay", `${Math.min(index * 45, 360)}ms`);
  });

  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("motion-visible");
          instance.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".motion-card").forEach((element) => observer.observe(element));
  } else {
    document.querySelectorAll(".motion-card").forEach((element) => element.classList.add("motion-visible"));
  }

  let lastScroll = window.scrollY;
  window.addEventListener("scroll", () => {
    const currentScroll = window.scrollY;
    document.body.classList.toggle("is-scrolling-down", currentScroll > lastScroll && currentScroll > 80);
    document.body.classList.toggle("is-scrolling-up", currentScroll < lastScroll);
    lastScroll = currentScroll;
  }, { passive: true });
})();
