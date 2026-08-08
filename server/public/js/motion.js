/* ===================== SCROLL REVEAL ===================== */
// Bölümler ekrana girdikçe hafifçe belirir. prefers-reduced-motion açıksa (veya
// IntersectionObserver desteklenmiyorsa) animasyonsuz, doğrudan görünür bırakılır.
(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('.feat-card, .step-row, .stats-bar, .cta-band');

  if (prefersReduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in-view'));
    return;
  }

  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = Math.min(i % 3, 2) * 0.08 + 's';
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  targets.forEach((el) => io.observe(el));
})();
