---
name: Expo dependency firewall
description: Environment limitation affecting the imported Expo workspace install.
---

The imported API and admin workflows can be installed and run independently of
the mobile workspace. A full frozen pnpm install currently reaches the package
firewall but is rejected while downloading Expo CLI's transitive `tar` package;
the API/database dependency closure succeeds.

**Why:** Keeping the existing Expo SDK and lockfile intact avoids an unrelated
dependency migration while still making the backend and admin console usable.

**How to apply:** Retry the full mobile install in a later session before
changing Expo versions or the lockfile; do not treat the API/admin setup as
blocked by this limitation.