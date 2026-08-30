import "dotenv/config";

import express from "express";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { query } from "./database/database.js";

// ======================================================
// APP
// ======================================================

const app = express();

app.set("trust proxy", 1);

// ======================================================
// ENVIRONMENT
// ======================================================

const PORT = Number(process.env.PORT) || 3000;

const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

const isProduction =
  process.env.NODE_ENV === "production";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL saknas.");
}

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET saknas.");
}

// ======================================================
// PATHS
// ======================================================

const __filename = fileURLToPath(
  import.meta.url,
);

const __dirname = path.dirname(
  __filename,
);

// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
  "https://webwonder.se",
  "https://www.webwonder.se",
];

if (!isProduction) {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
  );
}

app.use(
  cors({
    origin(origin, callback) {
      // Tillåt requests utan Origin,
      // exempelvis server-to-server och health checks.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origin tillåts inte av CORS."),
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
    ],
  }),
);

// ======================================================
// BODY PARSING
// ======================================================

app.use(
  express.json({
    limit: "20kb",
  }),
);

// ======================================================
// SESSION
// ======================================================

const PgSession =
  connectPgSimple(session);

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  maxAge: 1000 * 60 * 60 * 2,
};

app.use(
  session({
    store: new PgSession({
      conString: DATABASE_URL,
      createTableIfMissing: true,
    }),

    name: "webwonder.sid",

    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: cookieOptions,
  }),
);

// ======================================================
// STATIC FILES
// ======================================================

app.use(
  express.static(__dirname),
);

// ======================================================
// HELPERS
// ======================================================

const cleanText = (
  value,
  maxLength,
) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
};

const requireAdmin = (
  req,
  res,
  next,
) => {
  if (!req.session.adminId) {
    return res.status(401).json({
      message:
        "Du är inte behörig.",
    });
  }

  next();
};

// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await query("SELECT 1");

      res.json({
        status: "ok",
        database: "connected",
      });
    } catch (error) {
      console.error(
        "Health check misslyckades:",
        error,
      );

      res.status(503).json({
        status: "error",
        database: "disconnected",
      });
    }
  },
);

// ======================================================
// PUBLIC: GET APPROVED REVIEWS
// ======================================================

app.get(
  "/api/reviews",
  async (req, res) => {
    try {
      const result =
        await query(`
          SELECT
            id,
            name,
            role,
            company,
            quote,
            created_at AS "createdAt"
          FROM reviews
          WHERE approved = TRUE
          ORDER BY created_at DESC
        `);

      res.json(
        result.rows,
      );
    } catch (error) {
      console.error(
        "Kunde inte hämta recensioner:",
        error,
      );

      res.status(500).json({
        message:
          "Kunde inte hämta recensionerna.",
      });
    }
  },
);

// ======================================================
// PUBLIC: CREATE REVIEW
// ======================================================

app.post(
  "/api/reviews",
  async (req, res) => {
    try {
      const name =
        cleanText(
          req.body.name,
          80,
        );

      const email =
        cleanText(
          req.body.email,
          150,
        );

      const role =
        cleanText(
          req.body.role,
          100,
        );

      const company =
        cleanText(
          req.body.company,
          100,
        );

      const quote =
        cleanText(
          req.body.quote,
          800,
        );

      const website =
        cleanText(
          req.body.website,
          200,
        );

      // Honeypot
      if (website) {
        return res
          .status(200)
          .json({
            message: "Tack!",
          });
      }

      if (!name) {
        return res
          .status(400)
          .json({
            message:
              "Du måste ange ditt namn.",
          });
      }

      if (!quote) {
        return res
          .status(400)
          .json({
            message:
              "Du måste skriva en recension.",
          });
      }

      if (
        quote.length < 10
      ) {
        return res
          .status(400)
          .json({
            message:
              "Recensionen är för kort.",
          });
      }

      const id =
        randomUUID();

      await query(
        `
          INSERT INTO reviews (
            id,
            name,
            email,
            role,
            company,
            quote,
            approved
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            FALSE
          )
        `,
        [
          id,
          name,
          email || null,
          role || null,
          company || null,
          quote,
        ],
      );

      res
        .status(201)
        .json({
          message:
            "Tack! Din recension har skickats och väntar på godkännande.",
        });
    } catch (error) {
      console.error(
        "Kunde inte spara recension:",
        error,
      );

      res
        .status(500)
        .json({
          message:
            "Kunde inte spara recensionen.",
        });
    }
  },
);

// ======================================================
// ADMIN: LOGIN
// ======================================================

app.post(
  "/api/admin/login",
  async (req, res) => {
    try {
      const username =
        cleanText(
          req.body.username,
          80,
        );

      const password =
        typeof req.body
          .password === "string"
          ? req.body.password
          : "";

      if (
        !username ||
        !password
      ) {
        return res
          .status(400)
          .json({
            message:
              "Användarnamn och lösenord krävs.",
          });
      }

      const result =
        await query(
          `
            SELECT
              id,
              username,
              password_hash
            FROM admins
            WHERE username = $1
          `,
          [username],
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(401)
          .json({
            message:
              "Fel användarnamn eller lösenord.",
          });
      }

      const admin =
        result.rows[0];

      const passwordMatches =
        await bcrypt.compare(
          password,
          admin.password_hash,
        );

      if (
        !passwordMatches
      ) {
        return res
          .status(401)
          .json({
            message:
              "Fel användarnamn eller lösenord.",
          });
      }

      req.session.regenerate(
        (error) => {
          if (error) {
            console.error(
              "Kunde inte skapa admin-session:",
              error,
            );

            return res
              .status(500)
              .json({
                message:
                  "Kunde inte logga in.",
              });
          }

          req.session.adminId =
            admin.id;

          req.session.username =
            admin.username;

          req.session.save(
            (saveError) => {
              if (
                saveError
              ) {
                console.error(
                  "Kunde inte spara admin-session:",
                  saveError,
                );

                return res
                  .status(500)
                  .json({
                    message:
                      "Kunde inte logga in.",
                  });
              }

              res.json({
                message:
                  "Inloggningen lyckades.",
                username:
                  admin.username,
              });
            },
          );
        },
      );
    } catch (error) {
      console.error(
        "Admin login misslyckades:",
        error,
      );

      res
        .status(500)
        .json({
          message:
            "Kunde inte logga in.",
        });
    }
  },
);

// ======================================================
// ADMIN: CHECK SESSION
// ======================================================

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {
    res.json({
      authenticated: true,
      username:
        req.session.username,
    });
  },
);

// ======================================================
// ADMIN: LOGOUT
// ======================================================

app.post(
  "/api/admin/logout",
  requireAdmin,
  (req, res) => {
    req.session.destroy(
      (error) => {
        if (error) {
          console.error(
            "Kunde inte logga ut admin:",
            error,
          );

          return res
            .status(500)
            .json({
              message:
                "Kunde inte logga ut.",
            });
        }

        res.clearCookie(
          "webwonder.sid",
          {
            httpOnly: true,
            secure:
              isProduction,
            sameSite:
              "lax",
          },
        );

        res.json({
          message:
            "Du är utloggad.",
        });
      },
    );
  },
);

// ======================================================
// ADMIN: GET ALL REVIEWS
// ======================================================

app.get(
  "/api/admin/reviews",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await query(`
          SELECT
            id,
            name,
            email,
            role,
            company,
            quote,
            approved,
            created_at AS "createdAt",
            approved_at AS "approvedAt"
          FROM reviews
          ORDER BY created_at DESC
        `);

      res.json(
        result.rows,
      );
    } catch (error) {
      console.error(
        "Kunde inte hämta admin-recensioner:",
        error,
      );

      res
        .status(500)
        .json({
          message:
            "Kunde inte hämta recensionerna.",
        });
    }
  },
);

// ======================================================
// ADMIN: APPROVE REVIEW
// ======================================================

app.patch(
  "/api/admin/reviews/:id/approve",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await query(
          `
            UPDATE reviews
            SET
              approved = TRUE,
              approved_at = NOW()
            WHERE id = $1
            RETURNING
              id,
              name,
              email,
              role,
              company,
              quote,
              approved,
              created_at AS "createdAt",
              approved_at AS "approvedAt"
          `,
          [
            req.params.id,
          ],
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              "Recensionen hittades inte.",
          });
      }

      res.json({
        message:
          "Recensionen är godkänd.",
        review:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Kunde inte godkänna recension:",
        error,
      );

      res
        .status(500)
        .json({
          message:
            "Kunde inte godkänna recensionen.",
        });
    }
  },
);

// ======================================================
// ADMIN: UNAPPROVE REVIEW
// ======================================================

app.patch(
  "/api/admin/reviews/:id/unapprove",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await query(
          `
            UPDATE reviews
            SET
              approved = FALSE,
              approved_at = NULL
            WHERE id = $1
            RETURNING
              id,
              name,
              email,
              role,
              company,
              quote,
              approved,
              created_at AS "createdAt",
              approved_at AS "approvedAt"
          `,
          [
            req.params.id,
          ],
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              "Recensionen hittades inte.",
          });
      }

      res.json({
        message:
          "Recensionen är inte längre publicerad.",
        review:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Kunde inte avpublicera recension:",
        error,
      );

      res
        .status(500)
        .json({
          message:
            "Kunde inte uppdatera recensionen.",
        });
    }
  },
);

// ======================================================
// ADMIN: DELETE REVIEW
// ======================================================

app.delete(
  "/api/admin/reviews/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const result =
        await query(
          `
            DELETE FROM reviews
            WHERE id = $1
          `,
          [
            req.params.id,
          ],
        );

      if (
        result.rowCount === 0
      ) {
        return res
          .status(404)
          .json({
            message:
              "Recensionen hittades inte.",
          });
      }

      res
        .status(204)
        .end();
    } catch (error) {
      console.error(
        "Kunde inte radera recension:",
        error,
      );

      res
        .status(500)
        .json({
          message:
            "Kunde inte radera recensionen.",
        });
    }
  },
);

// ======================================================
// FRONTEND
// ======================================================

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "index.html",
      ),
    );
  },
);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (error, req, res, next) => {
    console.error(
      "Oväntat serverfel:",
      error,
    );

    if (
      error.message ===
      "Origin tillåts inte av CORS."
    ) {
      return res
        .status(403)
        .json({
          message:
            "Origin är inte tillåten.",
        });
    }

    res
      .status(500)
      .json({
        message:
          "Ett oväntat serverfel inträffade.",
      });
  },
);

// ======================================================
// START SERVER
// ======================================================

const startServer =
  async () => {
    try {
      await query(
        "SELECT 1",
      );

      console.log(
        "PostgreSQL ansluten.",
      );

      app.listen(
        PORT,
        () => {
          console.log(
            `Web & Wonder API kör på port ${PORT}`,
          );
        },
      );
    } catch (error) {
      console.error(
        "Kunde inte ansluta till PostgreSQL:",
        error,
      );

      process.exit(1);
    }
  };

await startServer();