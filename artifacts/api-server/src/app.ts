import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOAD_DIR } from "./lib/storage";

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

// Serve the admin panel static files so the browser stays on one origin
// and relative /api calls work without cross-origin port issues.
// process.cwd() is artifacts/api-server when run via pnpm filter.
const adminDir = path.join(process.cwd(), "../admin-panel");
app.use(express.static(adminDir));

export default app;
