import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!ADMIN_KEY) {
  throw new Error("ADMIN_KEY saknas i .env");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDirectory = path.join(__dirname, "public");
const dataDirectory = path.join(__dirname, "data");
const reviewsFile = path.join(dataDirectory, "reviews.json");

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

const ensureReviewsFile = async () => {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(reviewsFile, "utf8");
  } catch {
    await writeFile(reviewsFile, "[]", "utf8");
  }
};

const readReviews = async () => {
  await ensureReviewsFile();

  const file = await readFile(reviewsFile, "utf8");

  try {
    return JSON.parse(file);
  } catch {
    return [];
  }
};

const saveReviews = async (reviews) => {
  await writeFile(
    reviewsFile,
    JSON.stringify(reviews, null, 2),
    "utf8",
  );
};

const cleanText = (value, maxLength) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
};

const requireAdmin = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== ADMIN_KEY) {
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
    const reviews = await readReviews();

    const approvedReviews = reviews
      .filter((review) => review.approved)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
      .map(
        ({
          id,
          name,
          role,
          company,
          quote,
          createdAt,
        }) => ({
          id,
          name,
          role,
          company,
          quote,
          createdAt,
        }),
      );

    res.json(approvedReviews);
  } catch (error) {
    console.error(error);

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

    // Honeypot
    const website = cleanText(req.body.website, 200);

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

    const reviews = await readReviews();

    const review = {
      id: randomUUID(),
      name,
      email,
      role,
      company,
      quote,
      approved: false,
      createdAt: new Date().toISOString(),
    };

    reviews.push(review);

    await saveReviews(reviews);

    res.status(201).json({
      message:
        "Tack! Din recension har skickats och väntar på godkännande.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Kunde inte spara recensionen.",
    });
  }
});

// ======================================================
// ADMIN: Hämta alla recensioner
// ======================================================

app.get(
  "/api/admin/reviews",
  requireAdmin,
  async (req, res) => {
    try {
      const reviews = await readReviews();

      const sortedReviews = reviews.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );

      res.json(sortedReviews);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Kunde inte hämta recensionerna.",
      });
    }
  },
);

// ======================================================
// ADMIN: Godkänn recension
// ======================================================

app.patch(
  "/api/admin/reviews/:id/approve",
  requireAdmin,
  async (req, res) => {
    try {
      const reviews = await readReviews();

      const review = reviews.find(
        ({ id }) => id === req.params.id,
      );

      if (!review) {
        return res.status(404).json({
          message: "Recensionen hittades inte.",
        });
      }

      review.approved = true;
      review.approvedAt = new Date().toISOString();

      await saveReviews(reviews);

      res.json({
        message: "Recensionen är godkänd.",
        review,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Kunde inte godkänna recensionen.",
      });
    }
  },
);

// ======================================================
// ADMIN: Ta bort godkännande
// ======================================================

app.patch(
  "/api/admin/reviews/:id/unapprove",
  requireAdmin,
  async (req, res) => {
    try {
      const reviews = await readReviews();

      const review = reviews.find(
        ({ id }) => id === req.params.id,
      );

      if (!review) {
        return res.status(404).json({
          message: "Recensionen hittades inte.",
        });
      }

      review.approved = false;
      delete review.approvedAt;

      await saveReviews(reviews);

      res.json({
        message: "Recensionen är inte längre publicerad.",
        review,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Kunde inte uppdatera recensionen.",
      });
    }
  },
);

// ======================================================
// ADMIN: Radera recension
// ======================================================

app.delete(
  "/api/admin/reviews/:id",
  requireAdmin,
  async (req, res) => {
    try {
      const reviews = await readReviews();

      const reviewExists = reviews.some(
        ({ id }) => id === req.params.id,
      );

      if (!reviewExists) {
        return res.status(404).json({
          message: "Recensionen hittades inte.",
        });
      }

      const updatedReviews = reviews.filter(
        ({ id }) => id !== req.params.id,
      );

      await saveReviews(updatedReviews);

      res.status(204).end();
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Kunde inte radera recensionen.",
      });
    }
  },
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

await ensureReviewsFile();

app.listen(PORT, () => {
  console.log(
    `Web & Wonder kör på http://localhost:${PORT}`,
  );
});