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

    // Safely validate & sanitize a URL to prevent javascript: / data: injection
    function safeUrl(raw) {
      if (!raw) return null;
      let u;
      try { u = new URL(raw); } catch { u = new URL('https://' + raw); }
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return u.href;
    }

    const ctaPrimary = document.getElementById('dyn-cta-primary');
    if (ctaPrimary && cfg.email) {
      // Sanitize mailto: — only allow the email address portion, strip everything after ?
      const safeEmail = cfg.email.split('?')[0].trim();
      if (safeEmail) ctaPrimary.href = `mailto:${safeEmail}`;
      if (cfg.primaryCta) ctaPrimary.textContent = cfg.primaryCta;
    }

    const ctaSecondary = document.getElementById('dyn-cta-secondary');
    if (ctaSecondary) {
      const validUrl = safeUrl(cfg.secondaryUrl);
      if (validUrl) ctaSecondary.href = validUrl;
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
