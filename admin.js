const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://api.webwonder.se";

const $ = (selector, root = document) =>
  root.querySelector(selector);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const loginSection = $("[data-admin-login]");
const reviewsSection = $("[data-admin-reviews]");
const loginForm = $("[data-login-form]");
const usernameInput = $("#admin-username");
const passwordInput = $("#admin-password");
const message = $("[data-admin-message]");
const reviewList = $("[data-review-list]");
const reviewCount = $("[data-review-count]");
const logoutButton = $("[data-logout]");

// ======================================================
// MESSAGES
// ======================================================

const setMessage = (text, type = "error") => {
  if (!message) return;

  message.textContent = text;
  message.classList.remove("success", "error");

  if (text) {
    message.classList.add(type);
  }
};

// ======================================================
// API
// ======================================================

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type");

  const result = contentType?.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(
      result?.message ?? "Något gick fel.",
    );
  }

  return result;
};

// ======================================================
// DATE
// ======================================================

const formatDate = (dateString) => {
  if (!dateString) return "";

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
};

// ======================================================
// UI STATE
// ======================================================

const showLogin = () => {
  if (loginSection) {
    loginSection.hidden = false;
  }

  if (reviewsSection) {
    reviewsSection.hidden = true;
  }
};

const showReviews = () => {
  if (loginSection) {
    loginSection.hidden = true;
  }

  if (reviewsSection) {
    reviewsSection.hidden = false;
  }

  setMessage("");
};

// ======================================================
// RENDER REVIEWS
// ======================================================

const renderReviews = (reviews) => {
  if (!reviewList) return;

  if (reviewCount) {
    const pending = reviews.filter(
      (review) => !review.approved,
    ).length;

    reviewCount.textContent =
      `${pending} väntar på godkännande · ${reviews.length} totalt`;
  }

  if (reviews.length === 0) {
    reviewList.innerHTML = `
      <div class="admin-empty">
        <p>Det finns inga recensioner ännu.</p>
      </div>
    `;

    return;
  }

  reviewList.innerHTML = reviews
    .map((review) => {
      const statusClass =
        review.approved ? "approved" : "pending";

      const statusText =
        review.approved ? "Publicerad" : "Väntar";

      const roleCompany = [
        review.role,
        review.company,
      ]
        .filter(Boolean)
        .join(" · ");

      const reviewAction = review.approved
        ? `
            <button
              type="button"
              class="button ghost"
              data-action="unapprove"
            >
              Dölj
            </button>
          `
        : `
            <button
              type="button"
              class="button primary"
              data-action="approve"
            >
              Godkänn
            </button>
          `;

      return `
        <article
          class="admin-review-card ${statusClass}"
          data-review-id="${escapeHtml(review.id)}"
        >
          <div class="admin-review-card-header">
            <div>
              <span class="review-status ${statusClass}">
                ${statusText}
              </span>

              <h3>${escapeHtml(review.name)}</h3>

              ${
                roleCompany
                  ? `<p>${escapeHtml(roleCompany)}</p>`
                  : ""
              }
            </div>

            <time>
              ${escapeHtml(
                formatDate(review.createdAt),
              )}
            </time>
          </div>

          <blockquote>
            “${escapeHtml(review.quote)}”
          </blockquote>

          ${
            review.email
              ? `
                  <p class="admin-review-email">
                    E-post:
                    <a
                      href="mailto:${escapeHtml(
                        review.email,
                      )}"
                    >
                      ${escapeHtml(review.email)}
                    </a>
                  </p>
                `
              : ""
          }

          <div class="admin-review-actions">
            ${reviewAction}

            <button
              type="button"
              class="button danger"
              data-action="delete"
            >
              Radera
            </button>
          </div>
        </article>
      `;
    })
    .join("");
};

// ======================================================
// LOAD REVIEWS
// ======================================================

const loadReviews = async () => {
  try {
    const reviews = await request(
      "/api/admin/reviews",
    );

    renderReviews(reviews);
    showReviews();

    return true;
  } catch (error) {
    console.error(error);

    showLogin();

    return false;
  }
};

// ======================================================
// CHECK SESSION
// ======================================================

const checkSession = async () => {
  try {
    await request("/api/admin/me");
    await loadReviews();
  } catch {
    showLogin();
  }
};

// ======================================================
// LOGIN
// ======================================================

loginForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const username =
      usernameInput?.value.trim() ?? "";

    const password =
      passwordInput?.value ?? "";

    if (!username || !password) {
      setMessage(
        "Ange användarnamn och lösenord.",
      );

      return;
    }

    const submitButton =
      loginForm.querySelector(
        'button[type="submit"]',
      );

    try {
      if (submitButton) {
        submitButton.disabled = true;
      }

      setMessage("");

      await request(
        "/api/admin/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        },
      );

      if (passwordInput) {
        passwordInput.value = "";
      }

      await loadReviews();
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ??
          "Kunde inte logga in.",
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  },
);

// ======================================================
// REVIEW ACTIONS
// ======================================================

reviewList?.addEventListener(
  "click",
  async (event) => {
    const button =
      event.target.closest(
        "[data-action]",
      );

    if (!button) return;

    const card = button.closest(
      "[data-review-id]",
    );

    if (!card) return;

    const reviewId =
      card.dataset.reviewId;

    const action =
      button.dataset.action;

    if (!reviewId || !action) {
      return;
    }

    try {
      button.disabled = true;

      if (action === "approve") {
        await request(
          `/api/admin/reviews/${reviewId}/approve`,
          {
            method: "PATCH",
          },
        );
      }

      if (action === "unapprove") {
        await request(
          `/api/admin/reviews/${reviewId}/unapprove`,
          {
            method: "PATCH",
          },
        );
      }

      if (action === "delete") {
        const confirmed =
          window.confirm(
            "Vill du verkligen radera recensionen?",
          );

        if (!confirmed) {
          button.disabled = false;
          return;
        }

        await request(
          `/api/admin/reviews/${reviewId}`,
          {
            method: "DELETE",
          },
        );
      }

      await loadReviews();
    } catch (error) {
      console.error(error);

      if (
        error.message ===
        "Du är inte behörig."
      ) {
        showLogin();

        setMessage(
          "Din session har gått ut. Logga in igen.",
        );

        return;
      }

      window.alert(
        error.message ??
          "Något gick fel.",
      );

      button.disabled = false;
    }
  },
);

// ======================================================
// LOGOUT
// ======================================================

logoutButton?.addEventListener(
  "click",
  async () => {
    try {
      await request(
        "/api/admin/logout",
        {
          method: "POST",
        },
      );
    } catch (error) {
      console.error(error);
    }

    if (usernameInput) {
      usernameInput.value = "";
    }

    if (passwordInput) {
      passwordInput.value = "";
    }

    showLogin();

    setMessage(
      "Du är utloggad.",
      "success",
    );

    usernameInput?.focus();
  },
);

// ======================================================
// START
// ======================================================

checkSession();