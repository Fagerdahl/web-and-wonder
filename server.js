import "dotenv/config";
import express from "express";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { query } from "./database/database.js";

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL saknas i .env");
}

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET saknas i .env");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json({ limit: "20kb" }));

const PgSession = connectPgSimple(session);

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

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 2,
    },
  }),
);

app.use(express.static(__dirname));

// ======================================================
// HELPERS
// ======================================================

const cleanText = (value, maxLength) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
};

const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({
      message: "Du är inte behörig.",
    });
  }

  next();
};

// ======================================================
// PUBLIC: Hämta endast godkända recensioner
// ======================================================

app.get("/api/reviews", async (req, res) => {
  try {
    const result = await query(`
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

    res.json(result.rows);
  } catch (error) {
    console.error("Kunde inte hämta recensioner:", error);

    res.status(500).json({
      message: "Kunde inte hämta recensionerna.",
    });
  }
});

// ======================================================
// PUBLIC: Skicka recension
// ======================================================

app.post("/api/reviews", async (req, res) => {
  try {
    const name = cleanText(req.body.name, 80);
    const email = cleanText(req.body.email, 150);
    const role = cleanText(req.body.role, 100);
    const company = cleanText(req.body.company, 100);
    const quote = cleanText(req.body.quote, 800);

    const website = cleanText(req.body.website, 200);

    // Honeypot
    if (website) {
      return res.status(200).json({
        message: "Tack!",
      });
    }

    if (!name) {
      return res.status(400).json({
        message: "Du måste ange ditt namn.",
      });
    }

    if (!quote) {
      return res.status(400).json({
        message: "Du måste skriva en recension.",
      });
    }

    if (quote.length < 10) {
      return res.status(400).json({
        message: "Recensionen är för kort.",
      });
    }

    const id = randomUUID();

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
        VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      `,
      [id, name, email || null, role || null, company || null, quote],
    );

    res.status(201).json({
      message: "Tack! Din recension har skickats och väntar på godkännande.",
    });
  } catch (error) {
    console.error("Kunde inte spara recension:", error);

    res.status(500).json({
      message: "Kunde inte spara recensionen.",
    });
  }
});

// ======================================================
// ADMIN: Login
// ======================================================

app.post("/api/admin/login", async (req, res) => {
  try {
    const username = cleanText(req.body.username, 80);

    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({
        message: "Användarnamn och lösenord krävs.",
      });
    }

    const result = await query(
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

    if (result.rowCount === 0) {
      return res.status(401).json({
        message: "Fel användarnamn eller lösenord.",
      });
    }

    const admin = result.rows[0];

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Fel användarnamn eller lösenord.",
      });
    }

    req.session.adminId = admin.id;
    req.session.username = admin.username;

    res.json({
      message: "Inloggningen lyckades.",
      username: admin.username,
    });
  } catch (error) {
    console.error("Admin login misslyckades:", error);

    res.status(500).json({
      message: "Kunde inte logga in.",
    });
  }
});

// ======================================================
// ADMIN: Kontrollera session
// ======================================================

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({
    authenticated: true,
    username: req.session.username,
  });
});

// ======================================================
// ADMIN: Logout
// ======================================================

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Kunde inte logga ut admin:", error);

      return res.status(500).json({
        message: "Kunde inte logga ut.",
      });
    }

    res.clearCookie("webwonder.sid");

    res.json({
      message: "Du är utloggad.",
    });
  });
});

// ======================================================
// ADMIN: Hämta alla recensioner
// ======================================================

app.get("/api/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const result = await query(`
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

    res.json(result.rows);
  } catch (error) {
    console.error("Kunde inte hämta admin-recensioner:", error);

    res.status(500).json({
      message: "Kunde inte hämta recensionerna.",
    });
  }
});

// ======================================================
// ADMIN: Godkänn recension
// ======================================================

app.patch("/api/admin/reviews/:id/approve", requireAdmin, async (req, res) => {
  try {
    const result = await query(
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
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Recensionen hittades inte.",
      });
    }

    res.json({
      message: "Recensionen är godkänd.",
      review: result.rows[0],
    });
  } catch (error) {
    console.error("Kunde inte godkänna recension:", error);

    res.status(500).json({
      message: "Kunde inte godkänna recensionen.",
    });
  }
});

// ======================================================
// ADMIN: Ta bort godkännande
// ======================================================

app.patch(
  "/api/admin/reviews/:id/unapprove",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await query(
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
        [req.params.id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Recensionen hittades inte.",
        });
      }

      res.json({
        message: "Recensionen är inte längre publicerad.",
        review: result.rows[0],
      });
    } catch (error) {
      console.error("Kunde inte avpublicera recension:", error);

      res.status(500).json({
        message: "Kunde inte uppdatera recensionen.",
      });
    }
  },
);

// ======================================================
// ADMIN: Radera recension
// ======================================================

app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `
          DELETE FROM reviews
          WHERE id = $1
        `,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Recensionen hittades inte.",
      });
    }

    res.status(204).end();
  } catch (error) {
    console.error("Kunde inte radera recension:", error);

    res.status(500).json({
      message: "Kunde inte radera recensionen.",
    });
  }
});

// ======================================================
// FRONTEND
// ======================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
  try {
    await query("SELECT 1");

    console.log("PostgreSQL ansluten.");

    app.listen(PORT, () => {
      console.log(`Web & Wonder kör på http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Kunde inte ansluta till PostgreSQL:", error);

    process.exit(1);
  }
};

await startServer();
