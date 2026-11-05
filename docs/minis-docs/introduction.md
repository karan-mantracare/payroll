> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# The Minis Workflow

> End-to-end guide to building, deploying, and shipping vibe-coded apps ('Minis') across the MantraCare ecosystem: from first prompt to production analytics.

> [!NOTE]
>
> **Handed over by:** Aditya · **Audience:** Product team · **Purpose:** This is the canonical, copy-paste-ready reference for shipping a Mini end to end.

## What is a Mini?

A **Mini** is a small, independently-deployed, "vibe-coded" web app (built with AI tools like Lovable, Figma Make, or Google Stitch) that gets containerized, deployed on our internal Minis platform (`minis.mantracare.com`), authenticated against our main platform, and embedded into our ecosystem, either standalone, inside `web.mantracare.com`, or inside the mobile app's WebView.

The workflow has **six phases**:

> [card] [1. Build the UI](https://minis-workflow.mintlify.site/phases/phase-1-build.md)
>
> Generate the frontend with Lovable, Figma Make, or Google Stitch, and get it running locally.

> [card] [2. Ship the container](https://minis-workflow.mintlify.site/phases/phase-2-ship.md)
>
> Push to GitHub, configure CI, containerize, and deploy on the Minis platform.

> [card] [3. Wire up data](https://minis-workflow.mintlify.site/phases/phase-3-database-auth.md)
>
> Connect Neon Postgres and implement our token-based auth handshake.

> [card] [4. Integrate](https://minis-workflow.mintlify.site/phases/phase-4-integration.md)
>
> Handle HTTPS/iframe quirks, WebView navigation, translations, and platform webhooks.

> [card] [5. Instrument](https://minis-workflow.mintlify.site/phases/phase-5-analytics)
>
> Add Mixpanel analytics and turn usage data into retention and sales actions.

> [card] [6. Best Practices](https://minis-workflow.mintlify.site/phases/phase-6-best-practices.md)
>
> Maintain a clean codebase, optimize AI limits, and manage registry storage.

***

## Prerequisites

> [accordion] Accounts & access you need before starting
>
> * A personal GitHub account created with your company email (no org access needed, repos are created and owned by you)
> * Access to `bunker.mantracare.com` (our private Docker registry, used to store secrets for CI)
> * Access to [minis.mantracare.com](https://minis.mantracare.com), get this from **Abhishek** (tech lead)
> * A [Neon](https://neon.com) account
> * A Mixpanel project token (from your Mixpanel dashboard)
> * An AI IDE, Cursor, Windsurf, Claude Code, or similar

> [accordion] Tools installed locally
>
> * Node.js 20+ and npm
>
> * Git
>
> > [!TIP]
> >
> > Docker itself is not required locally! GitHub Actions builds and pushes the Docker image for you (see [Phase 2](https://minis-workflow.mintlify.site/phases/phase-2-ship.md)).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.