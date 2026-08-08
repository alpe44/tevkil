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

/* ===================== THEMIS HEYKELİ: KAYDIRDIKÇA DÖNME ===================== */
(function () {
  const el = document.getElementById('themisMotif');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!el || prefersReduced) return;

  let ticking = false;
  function update() {
    const angle = window.scrollY * 0.18;
    el.style.transform = 'translateY(-50%) rotate(' + angle + 'deg)';
    ticking = false;
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );
  update();
})();

/* ===================== İMLEÇ IŞIĞI ===================== */
// Sadece ince işaretçili (fare) masaüstü cihazlarda: imleci yumuşakça izleyen
// hafif bir marka rengi ışığı. Tıklamaları engellememesi için pointer-events:none.
(function () {
  const glow = document.getElementById('cursorGlow');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (!glow || prefersReduced || !finePointer) return;

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let curX = targetX;
  let curY = targetY;
  let active = false;

  window.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!active) {
      active = true;
      glow.classList.add('on');
    }
  });
  document.addEventListener('mouseleave', () => glow.classList.remove('on'));

  function tick() {
    curX += (targetX - curX) * 0.12;
    curY += (targetY - curY) * 0.12;
    glow.style.transform = 'translate(' + curX + 'px,' + curY + 'px)';
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ===================== MANYETİK BUTONLAR ===================== */
// Giriş sayfasındaki ana çağrı butonları, imleç yaklaştıkça hafifçe ona doğru kayar.
(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (prefersReduced || !finePointer) return;

  const buttons = document.querySelectorAll('#view-landing .cta-btn, #view-landing .ghost-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const relX = e.clientX - (r.left + r.width / 2);
      const relY = e.clientY - (r.top + r.height / 2);
      btn.style.transform = 'translate(' + relX * 0.25 + 'px,' + relY * 0.35 + 'px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0,0)';
    });
  });
})();

/* ===================== KART EĞİM (TILT) EFEKTİ ===================== */
// "Neden Nöbetçi" kartları, imlecin konumuna göre hafifçe 3B eğilir.
(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (prefersReduced || !finePointer) return;

  document.querySelectorAll('.feat-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'rotateX(' + (-py * 7) + 'deg) rotateY(' + (px * 7) + 'deg) translateZ(0)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'rotateX(0) rotateY(0)';
    });
  });
})();
