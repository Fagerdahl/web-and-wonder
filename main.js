// ==============================
// API
// ==============================

const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://api.webwonder.se";

// ==============================
// Helpers FOR A DRY CODEBASE
// ==============================

const $ = (selector, root = document) => root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// ==============================
// Testimonials
// Carousel + autoslide
// ==============================

(async () => {
  const track = $(".testimonial-track");
  const dotsWrap = $(".t-dots");
  const prev = $(".t-btn.prev");
  const next = $(".t-btn.next");

  if (!track || !dotsWrap) return;

  let reviews = [];
  let index = 0;
  let intervalId = null;
  let restartTimeoutId = null;

  const AUTO_DELAY = 6000;
  const RESTART_DELAY = 8000;

  const showEmptyState = (message = "Verifierade omdömen kommer snart.") => {
    track.style.transform = "";

    track.innerHTML = `
      <article class="testimonial-slide active">
        <div class="t-avatar">✨</div>

        <p class="t-quote">
          ${escapeHtml(message)}
        </p>

        <p class="t-name">
          Web &amp; Wonder
        </p>
      </article>
    `;

    dotsWrap.innerHTML = "";

    if (prev) prev.hidden = true;
    if (next) next.hidden = true;
  };

  const loadReviews = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reviews`);

      if (!response.ok) {
        throw new Error("Kunde inte hämta recensionerna.");
      }

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        throw new Error("Servern returnerade ett oväntat svar.");
      }

      reviews = await response.json();
    } catch (error) {
      console.error("Kunde inte hämta recensioner:", error);

      showEmptyState("Kunde inte ladda kundomdömen just nu.");

      return false;
    }

    return true;
  };

  const buildMarkup = () => {
    if (reviews.length === 0) {
      showEmptyState();
      return;
    }

    if (prev) {
      prev.hidden = reviews.length <= 1;
    }

    if (next) {
      next.hidden = reviews.length <= 1;
    }

    track.innerHTML = reviews
      .map(
        (review, reviewIndex) => `
          <article
            class="testimonial-slide ${reviewIndex === 0 ? "active" : ""}"
          >
            <div class="t-avatar">✨</div>

            <p class="t-quote">
              “${escapeHtml(review.quote)}”
            </p>

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

    dotsWrap.innerHTML = reviews
      .map(
        (_, dotIndex) => `
          <button
            class="t-dot ${dotIndex === 0 ? "active" : ""}"
            type="button"
            data-index="${dotIndex}"
            aria-label="Visa kundomdöme ${dotIndex + 1}"
            aria-selected="${dotIndex === 0 ? "true" : "false"}"
          ></button>
        `,
      )
      .join("");
  };

  const loaded = await loadReviews();

  if (!loaded) return;

  buildMarkup();

  const slides = $$(".testimonial-slide", track);

  const dots = $$(".t-dot", dotsWrap);

  if (reviews.length === 0) {
    return;
  }

  const render = () => {
    track.style.transform = `translateX(-${index * 100}%)`;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === index;

      dot.classList.toggle("active", isActive);

      dot.setAttribute("aria-selected", String(isActive));
    });
  };

  const setIndex = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;

    render();
  };

  const step = (direction) => {
    if (slides.length <= 1) {
      return;
    }

    setIndex(index + direction);
  };

  const stopAuto = () => {
    if (intervalId) {
      clearInterval(intervalId);
    }

    intervalId = null;
  };

  const startAuto = () => {
    stopAuto();

    if (slides.length <= 1) {
      return;
    }

    intervalId = setInterval(() => step(1), AUTO_DELAY);
  };

  const pauseAndRestart = () => {
    stopAuto();

    if (restartTimeoutId) {
      clearTimeout(restartTimeoutId);
    }

    if (slides.length <= 1) {
      return;
    }

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

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const nextIndex = Number(target.dataset.index);

    if (Number.isNaN(nextIndex)) {
      return;
    }

    setIndex(nextIndex);
    pauseAndRestart();
  });

  render();
  startAuto();
})();

// ==============================
// Review form toggle
// ==============================

(() => {
  const reviewSection = $(".review-section");

  const toggle = $(".review-toggle");

  const wrapper = $(".review-form-wrapper");

  if (!reviewSection || !toggle || !wrapper) {
    return;
  }

  const setOpen = (isOpen) => {
    toggle.setAttribute("aria-expanded", String(isOpen));

    wrapper.hidden = !isOpen;

    toggle.classList.toggle("is-open", isOpen);

    if (isOpen) {
      setTimeout(() => {
        $("#review-name")?.focus();
      }, 100);
    }
  };

  // Klick på recensionsrutan → öppna/stäng
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    setOpen(!isOpen);
  });

  // Dubbelklick utanför → stäng
  document.addEventListener("dblclick", (event) => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    if (!isOpen) return;

    if (reviewSection.contains(event.target)) {
      return;
    }

    setOpen(false);
  });

  // ESC → stäng
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    if (!isOpen) return;

    setOpen(false);
    toggle.focus();
  });
})();

// ==============================
// Submit review
// ==============================

(() => {
  const form = $(".review-form");

  const message = $(".review-message");

  const submitButton = $(".review-submit");

  if (!form) return;

  const setMessage = (text, type) => {
    if (!message) return;

    message.textContent = text;

    message.classList.remove("success", "error");

    if (type) {
      message.classList.add(type);
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const review = {
      name: String(formData.get("name") ?? "").trim(),

      email: String(formData.get("email") ?? "").trim(),

      role: String(formData.get("role") ?? "").trim(),

      company: String(formData.get("company") ?? "").trim(),

      quote: String(formData.get("quote") ?? "").trim(),

      website: String(formData.get("website") ?? "").trim(),
    };

    setMessage("");

    if (!review.name) {
      setMessage("Du måste ange ditt namn.", "error");

      return;
    }

    if (review.quote.length < 10) {
      setMessage("Recensionen måste innehålla minst 10 tecken.", "error");

      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;

        submitButton.textContent = "Skickar...";
      }

      const response = await fetch(`${API_BASE_URL}/api/reviews`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify(review),
      });

      const contentType = response.headers.get("content-type");

      const result = contentType?.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        throw new Error(result?.message || "Recensionen kunde inte skickas.");
      }

      if (!result) {
        throw new Error("Servern returnerade ett oväntat svar.");
      }

      form.reset();

      setMessage(
        result.message ||
          "Tack! Din recension har skickats och väntar på godkännande.",
        "success",
      );
    } catch (error) {
      console.error("Kunde inte skicka recension:", error);

      setMessage(
        error instanceof Error ? error.message : "Något gick fel. Försök igen.",
        "error",
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;

        submitButton.textContent = "Skicka recension";
      }
    }
  });
})();

// ==============================
// Tech modal
// ==============================

(() => {
  const trigger = $(".tech-trigger");

  const modal = $("#techModal");

  if (!trigger || !modal) {
    return;
  }

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

  document.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("active")) {
      return;
    }

    if (event.key === "Escape") {
      close();
    }
  });
})();

// ==============================
// Contact form
// Formspree
// ==============================

(() => {
  const form = $(".contact-form");

  if (!form) return;

  const successMarkup = `
    <p
      style="
        font-family:
          'Playfair Display',
          serif;
      "
    >
      ✅ Tack för ditt meddelande!
      <br />

      /Ronja, Web &amp; Wonder
    </p>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(form.action, {
        method: "POST",

        body: new FormData(form),

        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Form submit failed");
      }

      form.innerHTML = successMarkup;
    } catch {
      alert(
        "Något gick fel. Försök igen senare, eller mejla mig på ronjafagerdahl@gmail.com.",
      );
    }
  });
})();

// ==============================
// Mobile nav
// ==============================

(() => {
  const toggle = $(".nav-toggle");

  const nav = $(".main-nav");

  if (!toggle || !nav) {
    return;
  }

  const setOpen = (isOpen) => {
    nav.classList.toggle("is-open", isOpen);

    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  const close = () => {
    setOpen(false);
  };

  const toggleOpen = () => {
    setOpen(!nav.classList.contains("is-open"));
  };

  toggle.addEventListener("click", toggleOpen);

  $$("a", nav).forEach((link) => {
    link.addEventListener("click", close);
  });

  document.addEventListener("click", (event) => {
    if (nav.contains(event.target) || toggle.contains(event.target)) {
      return;
    }

    close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
})();

// ==============================
// Header hide on scroll
// ==============================

(() => {
  const header = $(".site-header");

  if (!header) return;

  let lastY = window.scrollY;

  const threshold = 12;

  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;

      const diff = y - lastY;

      if (y < 40) {
        header.classList.remove("is-hidden");

        lastY = y;

        return;
      }

      if (diff > threshold) {
        header.classList.add("is-hidden");
      }

      if (diff < -threshold) {
        header.classList.remove("is-hidden");
      }

      lastY = y;
    },
    {
      passive: true,
    },
  );
})();
