---
description: Run a Rappi-style design review on a specific route. Pass the route path as argument.
argument-hint: <ruta a revisar, ej. /dashboard o /partner/requests>
---

Delegate to the `rappi-design-reviewer` subagent. Target route: **$ARGUMENTS**

Context for the subagent:
- Dev server should already be running on `localhost:3000`. If not, start it.
- Authenticate as the correct role for the route:
  - `/admin*` → ADMIN account
  - `/dashboard*` → CLIENT account
  - `/partner*` → PARTNER account
- Test viewport: 375×812 (mobile-first).
- Compare against Rappi-style principles: category-and-card layout, bottom navigation (no sidebar in mobile), bottom sheets for actions, single CTA per screen, trust signals visible, time-based status, skeletons over spinners, ≥44px touch targets, distance as text never embedded map.

Output: the subagent's structured review report.
