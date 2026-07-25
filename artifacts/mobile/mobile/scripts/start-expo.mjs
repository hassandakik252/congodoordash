import { spawn } from "child_process";
import process from "process";

const env = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`,
  EXPO_PUBLIC_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
  EXPO_PUBLIC_REPL_ID: process.env.REPL_ID,
  REACT_NATIVE_PACKAGER_HOSTNAME: process.env.REPLIT_DEV_DOMAIN,
};

const args = [
  "exec", "expo", "start",
  "--localhost",
  "--port", process.env.PORT || "8081",
];

const child = spawn("pnpm", args, {
  stdio: ["pipe", "inherit", "inherit"],
  env,
});

child.on("error", (err) => {
  console.error("Failed to start Expo:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

function sendDownArrowEnter() {
  try {
    child.stdin.write("\x1b[B\r");
  } catch (_) {}
}

const intervals = [3000, 5000, 8000, 12000, 18000, 25000];
intervals.forEach((ms) => setTimeout(sendDownArrowEnter, ms));

setInterval(sendDownArrowEnter, 30000);
