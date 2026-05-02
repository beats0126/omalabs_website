/* OMA Labs — Portfolio Scripts */

// ── Load dynamic config ─────────────────────────────────────
(async function loadConfig() {
  try {
    const res = await fetch('config.json');
    if (!res.ok) return;
    const cfg = await res.json();

    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    set('dyn-heading1',     cfg.contactHeading1);
    set('dyn-heading2',     cfg.contactHeading2);
    set('dyn-body',         cfg.contactBody);

    const ctaPrimary = document.getElementById('dyn-cta-primary');
    if (ctaPrimary && cfg.email) {
      ctaPrimary.href = `mailto:${cfg.email}`;
      if (cfg.primaryCta) ctaPrimary.textContent = cfg.primaryCta;
    }

    const ctaSecondary = document.getElementById('dyn-cta-secondary');
    if (ctaSecondary) {
      if (cfg.secondaryUrl) ctaSecondary.href = cfg.secondaryUrl;
      if (cfg.secondaryCta) ctaSecondary.textContent = cfg.secondaryCta;
    }
  } catch { /* static fallback — content stays as in HTML */ }
})();

// Nav scroll effect
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

// Mobile hamburger
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav__links');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(
  '.stat-card, .service-card, .pill, .about__text p, .contact__body'
).forEach(el => {
  el.classList.add('reveal');
  observer.observe(el);
});
