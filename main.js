// ==============================
// Helpers FOR A DRY CODEBASE
// ==============================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ==============================
// Testimonials (carousel + autoslide)
// ==============================
(() => {
  const track = $(".testimonial-track");
  const slides = $$(".testimonial-slide");
  const prev = $(".t-btn.prev");
  const next = $(".t-btn.next");
  const dots = $$(".t-dot");

  if (!track || slides.length === 0) return;

  let index = 0;
  let intervalId = null;
  let restartTimeoutId = null;

  const AUTO_DELAY = 6000;
  const RESTART_DELAY = 8000;

  const render = () => {
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((s, i) => s.classList.toggle("active", i === index));
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  };

  const setIndex = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    render();
  };

  const step = (dir) => setIndex(index + dir);

  const stopAuto = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  };

  const startAuto = () => {
    stopAuto();
    intervalId = setInterval(() => step(1), AUTO_DELAY);
  };

  const pauseAndRestart = () => {
    stopAuto();
    if (restartTimeoutId) clearTimeout(restartTimeoutId);
    restartTimeoutId = setTimeout(startAuto, RESTART_DELAY);
  };

  next?.addEventListener("click", () => {
    step(1);
    pauseAndRestart();
  });

  prev?.addEventListener("click", () => {
    step(-1);
    pauseAndRestart();
  });

  dots.forEach((dot, i) =>
    dot.addEventListener("click", () => {
      setIndex(i);
      pauseAndRestart();
    })
  );

  render();
  startAuto();
})();

// ==============================
// Tech modal
// ==============================
(() => {
  const trigger = $(".tech-trigger");
  const modal = $("#techModal");
  if (!trigger || !modal) return;

  const closeBtn = $(".tech-modal-close", modal);
  const backdrop = $(".tech-modal-backdrop", modal);
  const dialog = $(".tech-modal-content", modal);

  let lastFocused = null;

  const open = () => {
    lastFocused = document.activeElement;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    (closeBtn || dialog)?.focus?.();
  };

  const close = () => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    lastFocused?.focus?.();
  };

  trigger.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("active")) return;
    if (e.key === "Escape") close();
  });
})();

// ==============================
// Contact form (Formspree)
// ==============================
(() => {
  const form = $(".contact-form");
  if (!form) return;

  const successMarkup = `
    <p style="font-family: 'Playfair Display', serif;">
      ✅ Tack för ditt meddelande! <br> 
      /Ronja, Web & Wonder
    </p>
  `;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error("Form submit failed");

      form.innerHTML = successMarkup;
    } catch {
      alert(
        "Något gick fel. Försök igen senare, eller mejla mig på ronjafagerdahl@gmail.com."
      );
    }
  });
})();

// ==============================
// Mobile nav (hamburger)
// ==============================
(() => {
  const toggle = $(".nav-toggle");
  const nav = $(".main-nav");
  if (!toggle || !nav) return;

  const setOpen = (isOpen) => {
    nav.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  const close = () => setOpen(false);
  const toggleOpen = () => setOpen(!nav.classList.contains("is-open"));

  toggle.addEventListener("click", toggleOpen);

  // Close when a link is clicked
  $$("a", nav).forEach((link) => link.addEventListener("click", close));

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    close();
  });

  // Close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();

// ==============================
// Header hide on scroll (mobile-friendly)
// ==============================
(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let lastY = window.scrollY;
  const threshold = 12;

  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      const diff = y - lastY;

      // Nära toppen – visa alltid
      if (y < 40) {
        header.classList.remove("is-hidden");
        lastY = y;
        return;
      }

      // Scroll ner → göm
      if (diff > threshold) header.classList.add("is-hidden");

      // Scroll upp → visa
      if (diff < -threshold) header.classList.remove("is-hidden");

      lastY = y;
    },
    { passive: true }
  );
})();

