const $ = (selector, root = document) =>
  root.querySelector(selector);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const loginSection = $(
  "[data-admin-login]",
);

const reviewsSection = $(
  "[data-admin-reviews]",
);

const loginForm = $(
  ".admin-login-form",
);

const adminKeyInput = $("#admin-key");

const message = $(".admin-message");

const reviewList = $(
  "[data-review-list]",
);

const reviewCount = $(
  "[data-review-count]",
);

const logoutButton = $(
  "[data-logout]",
);

let adminKey =
  sessionStorage.getItem(
    "webWonderAdminKey",
  ) ?? "";

const setMessage = (
  text,
  type = "error",
) => {
  if (!message) return;

  message.textContent = text;

  message.classList.remove(
    "success",
    "error",
  );

  message.classList.add(type);
};

const request = async (
  url,
  options = {},
) => {
  const response = await fetch(url, {
    ...options,

    headers: {
      ...options.headers,

      "x-admin-key": adminKey,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ??
        "Något gick fel.",
    );
  }

  return result;
};

const formatDate = (dateString) => {
  if (!dateString) return "";

  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(dateString));
};

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
        <p>
          Det finns inga recensioner ännu.
        </p>
      </div>
    `;

    return;
  }

  reviewList.innerHTML = reviews
    .map(
      (review) => `
        <article
          class="admin-review-card ${
            review.approved
              ? "approved"
              : "pending"
          }"
          data-review-id="${escapeHtml(
            review.id,
          )}"
        >
          <div
            class="admin-review-card-header"
          >
            <div>
              <span
                class="review-status ${
                  review.approved
                    ? "approved"
                    : "pending"
                }"
              >
                ${
                  review.approved
                    ? "Publicerad"
                    : "Väntar"
                }
              </span>

              <h3>
                ${escapeHtml(review.name)}
              </h3>

              ${
                review.role ||
                review.company
                  ? `
                      <p>
                        ${escapeHtml(
                          [
                            review.role,
                            review.company,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        )}
                      </p>
                    `
                  : ""
              }
            </div>

            <time>
              ${escapeHtml(
                formatDate(
                  review.createdAt,
                ),
              )}
            </time>
          </div>

          <blockquote>
            “${escapeHtml(
              review.quote,
            )}”
          </blockquote>

          ${
            review.email
              ? `
                  <p
                    class="admin-review-email"
                  >
                    E-post:
                    <a
                      href="mailto:${escapeHtml(
                        review.email,
                      )}"
                    >
                      ${escapeHtml(
                        review.email,
                      )}
                    </a>
                  </p>
                `
              : ""
          }

          <div
            class="admin-review-actions"
          >
            ${
              review.approved
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
                  `
            }

            <button
              type="button"
              class="button danger"
              data-action="delete"
            >
              Radera
            </button>
          </div>
        </article>
      `,
    )
    .join("");
};

const loadReviews = async () => {
  try {
    const reviews = await request(
      "/api/admin/reviews",
    );

    renderReviews(reviews);

    loginSection.hidden = true;
    reviewsSection.hidden = false;

    return true;
  } catch (error) {
    console.error(error);

    sessionStorage.removeItem(
      "webWonderAdminKey",
    );

    adminKey = "";

    loginSection.hidden = false;
    reviewsSection.hidden = true;

    setMessage(
      "Fel adminnyckel.",
    );

    return false;
  }
};

loginForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    adminKey =
      adminKeyInput.value.trim();

    if (!adminKey) return;

    sessionStorage.setItem(
      "webWonderAdminKey",
      adminKey,
    );

    await loadReviews();
  },
);

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

      alert(
        error.message ??
          "Något gick fel.",
      );

      button.disabled = false;
    }
  },
);

logoutButton?.addEventListener(
  "click",
  () => {
    sessionStorage.removeItem(
      "webWonderAdminKey",
    );

    adminKey = "";

    reviewsSection.hidden = true;
    loginSection.hidden = false;

    if (adminKeyInput) {
      adminKeyInput.value = "";
      adminKeyInput.focus();
    }
  },
);

if (adminKey) {
  loadReviews();
}