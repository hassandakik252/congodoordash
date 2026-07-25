import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOAD_DIR } from "./lib/storage";
import { captureException } from "./lib/monitoring";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS: if CORS_ORIGINS (comma-separated) is set, restrict browser origins to
// that allowlist; otherwise reflect the request origin (dev default). Native
// mobile requests send no Origin header and are always allowed.
const corsOrigins = process.env["CORS_ORIGINS"]
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve locally-stored uploads (no-op when a cloud STORAGE_DRIVER is used).
app.use("/uploads", express.static(UPLOAD_DIR));

app.use("/api", router);

// Global error handler — structured log + optional monitoring, JSON 500.
// (Express 5 forwards rejected async handlers here.)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "Unhandled route error");
  captureException(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal_error", message: "Une erreur interne est survenue." });
});

export default app;
