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
  const dotsWrap = $(".t-dots");
  const prev = $(".t-btn.prev");
  const next = $(".t-btn.next");

  if (!track || !dotsWrap) return;

  // Recensioner ska in här med "approved: true" för att visas på sidan
  const reviews = [
    // Exempel:
    // {
    //   quote:
    //     "Ronja var lyhörd genom hela processen och skapade en lösning som kändes både genomtänkt och professionell.",
    //   name: "Anna",
    //   role: "Företagare",
    //   company; "Anna's Bakery",
    //   approved: true,
    // },
    // {
    //   quote:
    //     "Samarbetet var smidigt, tydligt och resultatet speglade verkligen vårt varumärke.",
    //   name: "Johan",
    //   role: "Grundare",
    //   company; "Johan's Consulting",
    //   approved: true,
    // },
  ];

  const approvedReviews = reviews.filter((review) => review.approved);

  let index = 0;
  let intervalId = null;
  let restartTimeoutId = null;

  const AUTO_DELAY = 6000;
  const RESTART_DELAY = 8000;

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const buildMarkup = () => {
    if (approvedReviews.length === 0) {
      track.innerHTML = `
        <article class="testimonial-slide active">
          <div class="t-avatar">✨</div>
          <p class="t-quote">Kundomdömen kommer snart.</p>
          <p class="t-name">Web &amp; Wonder</p>
        </article>
      `;
      dotsWrap.innerHTML = "";
      if (prev) prev.hidden = true;
      if (next) next.hidden = true;
      return;
    }

    if (prev) prev.hidden = approvedReviews.length <= 1;
    if (next) next.hidden = approvedReviews.length <= 1;

    track.innerHTML = approvedReviews
      .map(
        (review, i) => `
          <article class="testimonial-slide ${i === 0 ? "active" : ""}">
            <div class="t-avatar">✨</div>
            <p class="t-quote">“${escapeHtml(review.quote)}”</p>
           <p class="t-name">
  ${escapeHtml(review.name)}
  ${
    review.role || review.company
      ? ` · ${escapeHtml(
          [review.role, review.company].filter(Boolean).join(", "),
        )}`
      : ""
  }
</p>
          </article>
        `,
      )
      .join("");

    dotsWrap.innerHTML = approvedReviews
      .map(
        (_, i) => `
          <button
            class="t-dot ${i === 0 ? "active" : ""}"
            type="button"
            data-index="${i}"
            aria-label="Visa kundomdöme ${i + 1}"
            aria-selected="${i === 0 ? "true" : "false"}"
          ></button>
        `,
      )
      .join("");
  };

  buildMarkup();

  const slides = $$(".testimonial-slide", track);
  const dots = $$(".t-dot", dotsWrap);

  if (slides.length === 0) return;

  const render = () => {
    track.style.transform = `translateX(-${index * 100}%)`;

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });

    dots.forEach((dot, i) => {
      const isActive = i === index;
      dot.classList.toggle("active", isActive);
      dot.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };

  const setIndex = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    render();
  };

  const step = (dir) => {
    if (slides.length <= 1) return;
    setIndex(index + dir);
  };

  const stopAuto = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  };

  const startAuto = () => {
    stopAuto();
    if (slides.length <= 1) return;
    intervalId = setInterval(() => step(1), AUTO_DELAY);
  };

  const pauseAndRestart = () => {
    stopAuto();
    clearTimeout(restartTimeoutId);
    if (slides.length <= 1) return;
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

  dotsWrap.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const nextIndex = Number(target.dataset.index);
    if (Number.isNaN(nextIndex)) return;

    setIndex(nextIndex);
    pauseAndRestart();
  });

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
        "Något gick fel. Försök igen senare, eller mejla mig på ronjafagerdahl@gmail.com.",
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
    { passive: true },
  );
})();
