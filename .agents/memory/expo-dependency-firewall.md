---
name: Expo dependency firewall
description: Environment limitation affecting the imported Expo workspace install.
---

The imported workspace now installs successfully. The package firewall rejected
the lockfile's older transitive `tar` and `shell-quote` versions, so the root
pnpm manifest pins compatible newer patches without changing the Expo SDK.

**Why:** Keeping the existing Expo SDK and direct dependencies intact avoids an
unrelated dependency migration while satisfying the package firewall.

**How to apply:** If another firewall rejection appears, inspect the direct
parent and prefer a compatible root pnpm override before changing Expo
versions. The current mobile typecheck and iOS/Android bundle build pass.