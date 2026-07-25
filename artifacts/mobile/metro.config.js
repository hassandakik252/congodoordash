const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");

const config = getDefaultConfig(__dirname);

// Proxy /api requests to the Express API server (port 5000) so that Expo Web
// never makes cross-origin requests — eliminating CORS entirely for browsers.
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url && req.url.startsWith("/api")) {
      const options = {
        hostname: "localhost",
        port: 5000,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: "localhost:5000" },
      };
      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });
      proxyReq.on("error", () => {
        res.writeHead(502);
        res.end("API unavailable");
      });
      req.pipe(proxyReq, { end: true });
    } else {
      middleware(req, res, next);
    }
  };
};

module.exports = config;
