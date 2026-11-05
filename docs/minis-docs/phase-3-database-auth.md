> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Phase 3: Database & Auth

> Connect Neon Postgres and implement our strict, provider-free token-based auth handshake.

We use **Neon** for Postgres and a custom, provider-free **token handshake** for auth (no Auth0/Clerk/Supabase-Auth; this is intentional, so read carefully).

### Step 1: Create your Neon project

1. Sign up at [neon.com](https://neon.com/signup?refcode=1M1SU1DH)
2. Create a new project:
   * **Project name:** your slug
   * **Postgres version:** 18
   * **Region:** Singapore (closest to India, until we have a dedicated region)

### Step 2: Initialize the schema via the Neon MCP

In your AI IDE, with the Neon MCP configured:

```text theme={null}
Using the Neon MCP, run `npx neon@latest init` for this project with
connection URL [your connection URL]. Create Neon configuration to save
everything with timestamps and userID, and create the relevant tables
in the DB using MCP. Only if the MCP fails, generate a SQL script and
run it in the Neon SQL editor to create the DB tables.
```

Every table you create for a Mini should, at minimum, carry `created_at`, `updated_at`, and a `user_id` column; this is what makes the auth + RLS story in the next step actually work.

### Step 3: Implement the auth handshake

> [!WARNING]
>
> **CRITICAL SECURITY STEP:** This is the single most important section for security. Read the whole thing before writing code. Half-implementing this (e.g., skipping the blocking loading state) creates a real data-leak window.

Run this prompt in your IDE:

```text theme={null}
Objective: Implement a secure, independent authentication handshake to
identify users and persist their session without using standard auth
providers.

1. The Handshake Protocol
On the root/entry component of the application:
- Extraction: On mount, check the URL query parameters for `token`.
- Validation: If found, perform a POST request to
  https://api.mantracare.com/user/user-info with the body
  {"token": "UUID"}.
- Resolution:
  - Success (200 OK): Store the returned user_id in sessionStorage (to
    prevent persistence across unauthorized tabs) and immediately clean
    the URL using history.replaceState (or your router's equivalent) to
    remove the token from the address bar.
  - Failure/Missing: If the token is missing from the URL or the API
    returns any error (400, 401, 500), execute a hard redirect via
    window.location.href = '/token'.

2. Security Hardening
- Blocking Navigation: Do not render any application UI or child routes
  until the handshake is complete. Show a full-screen loading state to
  prevent "flicker" of unauthorized data.
- Session Isolation: Use sessionStorage instead of localStorage, so
  closing the tab purges the user_id and forces a fresh handshake.
- Request Integrity: Ensure all subsequent Neon queries include a
  filter for the validated user_id.
- RLS Enforcement: Within Neon, ensure Row Level Security (RLS) is
  enabled. Since we aren't using Neon Auth, verify API calls to Neon
  are restricted to data belonging to the user_id in the session.

3. Database Persistence (Neon)
- Table: users
- Primary key: id (type BIGINT, identity: manual/external)
- The application must treat the user_id returned by the handshake as
  the source of truth. If no record exists for this id in the users
  table on a successful handshake, the frontend should trigger an
  initial "Profile Creation" / "User Initialization" upsert.
```

For reference, here's roughly what a compliant `AuthGate` component looks like. Use this to sanity-check what your IDE generates; don't just paste blind:

```tsx theme={null}
// app/auth/AuthGate.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";

type HandshakeState = "pending" | "authenticated" | "failed";

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HandshakeState>("pending");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      window.location.href = "/token";
      return;
    }

    fetch("https://api.mantracare.com/user/user-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Handshake failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        sessionStorage.setItem("user_id", data.user_id);
        // Strip the token from the URL without a full reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
        setState("authenticated");
      })
      .catch(() => {
        window.location.href = "/token";
      });
  }, []);

  if (state !== "authenticated") {
    // Full-screen blocking loader, never let child routes flash through
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}

function FullScreenLoader() {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <span>Loading your session…</span>
    </div>
  );
}
```

Wrap it around `{children}` in your root layout:

```tsx theme={null}
// app/layout.tsx
import { AuthGate } from "./auth/AuthGate";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
```

### Step 4: Never hardcode the DB URL client-side

Build a small backend (or use Neon's serverless driver from server-side functions only) for all database reads/writes. Add `DATABASE_URL` as an **environment variable on the Minis project** (`minis.mantracare.com → your project → Environment`); never bundle it into the frontend.

### Step 5: Ship it

```bash theme={null}
git add .
git commit -m "Add Neon DB + auth handshake"
git push
```

Wait for GitHub Actions to go green, then go to `minis.mantracare.com`, **pause** the project, and **play** it again to pull the latest Docker artifact.

### How the auth flow looks in production

Once auth is wired up, users reach your Mini through this chain:

```text theme={null}
web.mantracare.com/app/your_slug
        │
        │  (hits our auth API, obtains a token)
        ▼
platform.mantracare.com/your_slug?token=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> [!WARNING]
>
> Going straight to `platform.mantracare.com/your_slug` **without** a token will either infinite-loop trying to fetch one, or show "authentication failed, token missing." This is expected; always enter through `web.mantracare.com/app/your_slug`.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.