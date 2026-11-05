> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Phase 4: Ecosystem Integration

> Handle HTTPS/iframe quirks, WebView navigation, translations, and platform webhooks to integrate your Mini.

Your Mini now has a working UI, auth, and a database. This phase covers the integration issues you *will* hit once it's embedded in the rest of our ecosystem.

### Issue 1: Mixed content / blank screen inside web.mantracare.com

**Symptom:** The Mini runs fine standalone, but shows a **blank screen** once loaded inside `web.mantracare.com`, with a console error like:

```text theme={null}
framework-f29e48ae95cae5a3.js:9 Mixed Content: The page at
'https://web.mantracare.com/app/content/therapy' was loaded over HTTPS,
but requested an insecure frame
'http://platform.mantracare.com/therapy/?token=1bd6bb90-3ee0-11f1-835b-afb734c527e4&lang=en'.
This request has been blocked; the content must be served over HTTPS.
```

**Root cause:** The browser blocks an HTTPS parent page from embedding an `http://` iframe. Somewhere in your app's redirect/reload logic, the URL is being reconstructed without an explicit scheme (or with a hardcoded `http://`), so a client-side reload or `window.location` reassignment drops back to plain HTTP.

**Diagnosis:**

1. Open DevTools → **Network** tab on the failing page.
2. Reproduce the issue and look for a request/navigation that reloads to an `http://platform.mantracare.com/...` URL. This is almost always a redirect fired *after* initial load (e.g., from the auth handshake's `history.replaceState`, a router redirect, or an SDK default).

**Fix:** Ensure every place your code constructs a URL for navigation or reload uses an explicit `https://` scheme (or a scheme-relative/relative path, never a hardcoded `http://`), and confirm nothing in your code calls `window.location.protocol = 'http:'` or similarly forces an insecure reload. Once every internal reload target is HTTPS-only, the mixed-content block resolves.

### Issue 2: Exit / back button & WebView navigation

Minis run in three contexts: standalone browser, iframe inside `web.mantracare.com`, and React Native WebView inside the mobile app. Your exit button needs to detect all three:

```tsx theme={null}
function handleExit() {
  // 1. React Native WebView
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ action: "exit" })
    );
    return;
  }

  // 2. iframe inside web.mantracare.com
  if (window.parent !== window) {
    window.parent.postMessage(
      { action: "exit" },
      "https://web.mantracare.com"
    );
    return;
  }

  // 3. Standalone browser
  window.location.href = "https://web.mantracare.com";
}
```

To navigate to a specific screen inside the native app (e.g. after task completion):

```tsx theme={null}
window.ReactNativeWebView?.postMessage(
  JSON.stringify({
    action: "navigate",
    screen: "Home", // RN screen name
    params: { /* optional params */ },
  })
);
```

> [!NOTE]
>
> The `postMessage` origin check (`'https://web.mantracare.com'`) is not optional. Omitting it lets any embedding origin receive your exit event.

### Issue 3: Internationalization (i18n)

We translate Minis with **i18next + Azure AI Translator**, generated **offline, per module**, never at runtime.

> [!WARNING]
>
> Never attempt to extract/translate an entire large platform codebase in one pass. Always go **one module at a time**. Translating everything globally causes missing keys, incomplete extraction, and unstable generation.

**Step 1. Add your Azure Translator credentials to `.env`:**

```bash theme={null}
# .env (never commit this file, add it to .gitignore)
AZURE_TRANSLATOR_KEY=your-key-here
AZURE_TRANSLATOR_REGION=eastus
```

**Step 2. Run the i18n implementation prompt** in your AI IDE:

```text theme={null}
You are a senior full-stack engineer responsible for implementing a
scalable, production-grade internationalization (i18n) system using
i18next and Azure AI Translator.

The application is a large platform composed of many smaller
mini-projects/modules merged into a single codebase. Because the
platform is large, translation extraction and generation MUST happen
ONE PROJECT/MODULE AT A TIME, not globally at once. Attempting to
translate the entire platform together causes missing keys, incomplete
extraction, failed translations, and unstable generation. The
architecture must be modular, isolated, incremental, and project-scoped.

# Core Objectives
- Each mini-project/module manages its own translations independently
- Translation extraction and generation happen per-project
- Locale files remain isolated per module
- Runtime NEVER calls translation APIs
- URL params control language switching (?lang=xx)
- Existing UI remains visually identical, no regressions, no content gaps
- No hardcoded strings remain in UI

# Environment Setup (ALREADY CONFIGURED, DO NOT MODIFY)
Environment variables already exist in .env:
AZURE_TRANSLATOR_KEY=...
AZURE_TRANSLATOR_REGION=eastus

STRICT REQUIREMENTS:
- NEVER hardcode API keys
- NEVER print API keys
- NEVER expose API keys to frontend bundles
- NEVER commit .env
- ONLY use environment variables inside local Node.js scripts
- Translation scripts are development-only tools

# Architecture requirement, per-module locale isolation
Example structure:
src/
  modules/
    dashboard/i18n/{en,es,ja}.json
    activities/i18n/{en,ko}.json
    profile/i18n/{en}.json
    rewards/i18n/{en}.json

Each module must be independently translatable without affecting other
modules.

# Supported languages
en (default), es, fr, de, pt, ru, zh-Hans, zh-Hant, ja, ko, ar, hi, bn,
id, tr, vi, it, pl, th, tl, nl, sv, no, da, fi, cs, el, ro, hu, uk, he,
ms, ta, te, ur, with room to add more later.

# Phase 1: i18n integration
Install and configure i18next, react-i18next, i18next-parser.
- Language controlled via URL param ?lang=xx
- Default and fallback language: en
- Dynamic runtime language switching
- Namespace/project-based, lazy-loaded translation files
- DO NOT modify layouts, component hierarchy, styling, spacing,
  rendering flow, responsiveness, business logic, or routing, only
  replace visible strings with translation keys. UI must be visually
  identical before and after.

# Phase 2: Project-by-project extraction (VERY IMPORTANT)
Never scan the whole repo at once. Per module: select it, scan only
that module, extract all user-facing text (headings, subtitles,
buttons, labels, placeholders, tabs, navigation, dialogs, modals,
onboarding, errors, validation messages, tooltips, descriptions, cards,
empty states, dynamic labels, everything visible, including nested,
shared, conditionally-rendered, and dynamically-injected content), wrap
every string with t("key"), generate that module's locale files,
translate independently, then move to the next module.

# Phase 3: Translation generation
Use Azure AI Translator, per-module. Read the module's en.json, generate
translations locally via Node.js scripts, preserve nested JSON
structure, interpolation variables, placeholders, and formatting.
Batch requests efficiently, avoid duplicate calls, retry failed
requests safely, support resume/restart and partial runs, and never
regenerate already-completed modules.

# Runtime rules
Production runtime must NEVER call Azure APIs. After generation,
translations are static JSON, the app works offline, and runtime only
consumes local locale files. Translation scripts are dev-only tooling.

# Validation
No missing keys, no untranslated English content, correct fallback
behavior, working RTL rendering, working ?lang= switching, no crashes
on missing locale files, and zero UI/layout regressions. The app must
behave identically before and after i18n integration.

# Deliverables
Complete modular i18n integration, per-project locale architecture,
isolated namespaces, translation generation scripts, local JSON
translation files, URL-based language switching, zero runtime
translation API usage, and a production-safe implementation.
```

**Step 3. Ship the translations:**

```bash theme={null}
# Confirm .env is ignored before you commit anything
cat .gitignore | grep -q "^\.env$" || echo ".env" >> .gitignore

git add .
git commit -m "Add i18n: <module-name> locales (es, fr, de, ...)"
git push
```

Wait for GitHub Actions to go green, then pause/play the project on the Minis platform to pull the latest artifact, and confirm switching `?lang=xx` in the URL actually changes the rendered language before moving to the next module.

### Issue 4: Activity completion webhook (pathways)

For activities assigned via **pathways**, we trigger a completion webhook on click of the completion button.

**Endpoint:** `POST https://api.mantracare.com/webhook/pathway`

**Payload:**

```json theme={null}
{
  "intent": "complete_activity",
  "upa_id": 101112,
  "uid": "abc123:def456"
}
```

* `intent` is always `"complete_activity"` for this flow.
* `upa_id` and `uid` come from the URL query params and should be captured into session storage on load:

```text theme={null}
?upa_id=167311&uid=52926
```

Implementation prompt for your IDE:

```text theme={null}
I want to set up a webhook that makes a POST request so that when an
activity is assigned to a user as a daily activity, clicking the
completion button triggers the webhook.

Base URL: https://api.mantracare.com/webhook/pathway

Example request payload:
{
  "intent": "complete_activity",
  "upa_id": 101112,
  "uid": "abc123:def456"
}

`intent` is fixed. `upa_id` and `uid` must be read from URL query
params and persisted to sessionStorage on load, reference format:
?upa_id=167311&uid=52926

Only send the POST request once both upa_id and uid are available. If
either is missing, console.log a clear warning instead of firing the
request.
```

Minimal reference implementation (inside a `"use client"` component):

```tsx theme={null}
"use client";
import { useEffect } from "react";

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const upaId = params.get("upa_id");
  const uid = params.get("uid");

  if (upaId) sessionStorage.setItem("upa_id", upaId);
  if (uid) sessionStorage.setItem("uid", uid);
}, []);

async function completeActivity() {
  const upa_id = sessionStorage.getItem("upa_id");
  const uid = sessionStorage.getItem("uid");

  if (!upa_id || !uid) {
    console.log("Missing upa_id or uid, cannot fire completion webhook yet.");
    return;
  }

  await fetch("https://api.mantracare.com/webhook/pathway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "complete_activity",
      upa_id: Number(upa_id),
      uid,
    }),
  });
}
```

Once implemented, build a new Docker image, push it, and pull the latest artifact on the Minis platform. Then in the admin dashboard, edit the activity, enable **tracking required**, and test the full pathway flow. Clicking the completion button should fire the webhook successfully.

### Issue 5: Pushing data to the Insights tab

**Endpoint:** `POST https://api.mantracare.com/webhook/assessment/v2`

> [!NOTE]
>
> This webhook is being updated so `entry_id` becomes nullable. You won't need to send it; it'll be generated backend-side. You need to send a JSON payload containing all the questions and answers the user selected, which creates a record renderable on the frontend history/insights page. **Confirm the exact current field names/shape with Garv before wiring this up**, as the payload contract is actively evolving.

### Issue 6: History page shows empty despite DB writes

**Symptom:** Activity data is saving correctly to the DB, but the Mini's **history page** renders empty.

**Root cause:** There's no backend API actually reading that user's saved records back out; writes work, reads don't exist yet.

**Fix:** Build a backend endpoint that queries the database filtered by the authenticated `user_id` and returns that user's historical entries, then have the history page call it on mount. Be intentional about what you surface here; the goal is a genuinely useful insight, not just a dump of raw rows.

### Issue 7: Full pathway webhook reference

The pathway webhook (`POST /webhook/pathway`) supports more than just completion. Use this as your reference for the full intent set.

**Request shape:**

```json theme={null}
{
  "intent": "complete_activity",
  "uid": "encrypted_user_id",
  "pathway_id": 123,
  "activity_id": 456,
  "service_id": 789,
  "upa_id": 101112
}
```

| Field | Required? | Notes |
| - | - | - |
| `intent` | Optional (default `complete_activity`) | See intents table below |
| `uid` | Optional (required for some intents) | Encrypted user ID, format `<iv_hex>:<encrypted_data_hex>` |
| `pathway_id` | Optional (required for some intents) | Non-negative integer |
| `activity_id` | Optional (required for some intents) | Non-negative integer |
| `service_id` | Optional (required for some intents) | Non-negative integer |
| `upa_id` | Optional (required for `complete_activity`) | User Pathway Activity ID, non-negative integer |

**Intents:**

> [accordion] assign\_pathway: assigns a pathway to a user
>
> Required: `pathway_id`, `uid`, `service_id`
>
> ```json theme={null}
> {
>   "intent": "assign_pathway",
>   "uid": "abc123:def456",
>   "pathway_id": 123,
>   "service_id": 789
> }
> ```

> [accordion] assign\_activity: assigns an activity within a pathway
>
> Required: `activity_id`, `pathway_id`, `service_id`, `uid`
>
> ```json theme={null}
> {
>   "intent": "assign_activity",
>   "uid": "abc123:def456",
>   "pathway_id": 123,
>   "activity_id": 456,
>   "service_id": 1
> }
> ```

> [accordion] assign\_and\_complete\_activity: assigns and immediately completes
>
> Required: `pathway_id`, `uid`, `activity_id`, `service_id`
>
> ```json theme={null}
> {
>   "intent": "assign_and_complete_activity",
>   "uid": "abc123:def456",
>   "pathway_id": 123,
>   "activity_id": 456,
>   "service_id": 1
> }
> ```

> [accordion] complete\_activity (default): marks an activity complete
>
> Required: `upa_id`. Optional: `uid` (if provided, must match the user tied to `upa_id`).
>
> ```json theme={null}
> { "intent": "complete_activity", "upa_id": 101112 }
> ```
>
> With verification:
>
> ```json theme={null}
> {
>   "intent": "complete_activity",
>   "upa_id": 101112,
>   "uid": "abc123:def456"
> }
> ```

**Responses:**

```json Success (200) theme={null}
{
  "success": true,
  "message": "Activity successfully assigned and completed"
}
```

```json Error (400/500) theme={null}
{
  "success": false,
  "message": "Invalid data",
  "error": {
    // Zod validation error details
  }
}
```

**Validation rules:**

* All numeric fields must be non-negative integers (`0` is valid).
* `uid` must be a validly encrypted string: `<iv_hex>:<encrypted_data_hex>` (16-byte IV in hex, followed by the encrypted user ID in hex).
* Required fields are enforced per-intent (see table above).
* If `uid` is supplied alongside `upa_id` for `complete_activity`, it must match the user tied to that `upa_id`, or you'll get an `"User id mismatch"` error.
* If `intent` is omitted, it defaults to `complete_activity`.
* Numeric string IDs (e.g. `"123"`) are coerced to numbers automatically.

> [accordion] Common validation error messages
>
> * `"To assign pathway, pathway id is required"`, missing `pathway_id` for `assign_pathway`
> * `"To assign pathway, user id is required"`, missing `uid` for `assign_pathway`
> * `"To assign pathway, service id is required"`, missing `service_id` for `assign_pathway`
> * `"To assign activity, activity id is required"`, missing `activity_id` for `assign_activity`
> * `"To complete activity, user activity id (upa_id) is required"`, missing `upa_id` for `complete_activity`
> * `"Invalid user id"`, failed to decrypt or malformed `uid`
> * `"User id mismatch: provided uid does not match activity user"`, `uid` doesn't match `upa_id`'s owner

The webhook transparently handles both regular users and provider users.

### Issue 8: Share button

Add a share button at the end of the activity flow (prompt your IDE to implement standard Web Share API with a URL/clipboard fallback). This is a deliberate virality lever; don't skip it, it's part of the standard Mini spec, not a nice-to-have.

### Issue 9: Cloudinary Image & Asset Hosting

**Why Cloudinary?**
When your Mini is integrated into the broader ecosystem, relying on locally hosted images (e.g., inside a `public/` folder) can lead to broken assets, CORS issues, and slow loading times across different environments (web, iframes, React Native WebViews). To ensure seamless delivery and reliable URLs, all image assets, icons, and logos must be hosted externally on **Cloudinary**.

**How to set it up:**

1. **Create an account:** Go to [Cloudinary](https://cloudinary.com/) and sign up for a free account.
2. **Get your credentials:** Navigate to your Cloudinary dashboard to find your API Environment variable (Cloud Name, API Key, and API Secret).
3. **Configure your environment:** Add the credentials to your local `.env` file (never commit this file).

```bash theme={null}
# .env
CLOUDINARY_URL=cloudinary://<your_api_key>:<your_api_secret>@<cloud_name>
```

**Automating the migration:**
Instead of manually uploading every image and updating your codebase line-by-line, use your AI IDE to automate this process.

**Run the following implementation prompt** in your AI IDE:

```text theme={null}
You are a senior full-stack engineer. Our project requires all local
image assets, logos, and media to be hosted on Cloudinary for reliable
cross-platform delivery.

# Core Objectives
1. Locate all local image assets in the repository (e.g., public/ folder,
   src/assets/, etc.).
2. Write a one-off Node.js script to upload all these local images to
   Cloudinary. Use the `CLOUDINARY_URL` environment variable for
   authentication.
3. The script should output a mapping of local file paths to their new
   secure Cloudinary URLs (`https://res.cloudinary.com/...`).
4. Once the images are uploaded, update all references in the codebase
   (components, CSS, config files) to use the new Cloudinary URLs
   instead of local paths.

# Environment Setup
Assume `CLOUDINARY_URL` is already available in the `.env` file. Do NOT
hardcode credentials anywhere in the script or codebase.

# Deliverables
- A utility script to upload images to Cloudinary.
- Updated codebase where all `<img>` tags, CSS `background-image` properties,
  and asset imports point to the new Cloudinary URLs.
- The UI should remain visually identical with no broken images.
```

> [!TIP]
>
> **Design consistency:** Stay as close as possible to our existing design system while building the UI. Deviating early causes rework later once the Mini gets embedded next to other platform surfaces.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.