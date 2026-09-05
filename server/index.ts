import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Trust reverse proxy (Replit, etc.)
app.set("trust proxy", 1);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ─── Rate Limiting ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "محاولات كثيرة جداً، حاول مجدداً بعد 15 دقيقة" },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { message: "تجاوزت الحد المسموح، حاول مجدداً بعد ساعة" },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { message: "طلبات كثيرة جداً، حاول مجدداً بعد دقيقة" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health",
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/contact", contactLimiter);
app.use("/api/", apiLimiter);

// ─── Logger ───────────────────────────────────────────────
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Sensitive fields to redact from logs
const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set(["password", "token", "secret", "authorization", "cookie"]);

function sanitizeForLog(obj: any, depth = 0): any {
  if (depth > 3 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.slice(0, 5).map(v => sanitizeForLog(v, depth + 1));
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : sanitizeForLog(v, depth + 1);
  }
  return result;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const sanitized = sanitizeForLog(capturedJsonResponse);
        const str = JSON.stringify(sanitized);
        logLine += ` :: ${str.length > 200 ? str.slice(0, 200) + "…" : str}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Auto-run migrations on startup
  try {
    const { execSync } = await import("child_process");
    execSync("npm run db:push --silent 2>&1", { stdio: "pipe" });
    log("DB schema synced ✓");
  } catch (e: any) {
    log(`DB push warning: ${e.message?.slice(0, 100)}`, "db");
  }

  // Expire stale offers on startup and every hour
  const { storage } = await import("./storage");
  const runExpire = async () => {
    const n = await storage.expireStaleOffers();
    if (n > 0) log(`Expired ${n} stale offer(s)`, "cron");
  };
  runExpire();
  setInterval(runExpire, 60 * 60 * 1000);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err?.message ?? err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

httpServer.listen(port, () => {
  log(`serving on port ${port}`);
});
})();
