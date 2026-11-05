> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Phase 1: Build the UI

> Start a Mini using an AI UI builder, strip external branding, and set up a standardized Next.js environment locally.

You can start a Mini from **Lovable**, **Figma Make**, **Google Stitch**, or any other AI UI builder. Pick the tab that matches your tool below to begin the scaffolding process.

> [tab] Lovable
>
> **1. Connect your Git repo**
>
> In your Lovable project, connect and sync a GitHub repo from the Lovable dashboard (`Project → GitHub → Connect`).
>
> **2. Clone it and strip Lovable branding**
>
> Open your AI IDE in an empty folder and run this exact prompt:
>
> ```text theme={null}
> Clone this git repo [public git URL], remove any and all Lovable
> assets like logo, favicon, metadata, and dependencies, then set it
> up as a Next.js (App Router) + TypeScript + Tailwind project,
> preserving the UI exactly as-is, and run it on local host.
> ```
>
> We standardize on Next.js across all Minis, regardless of which tool generated the original UI.
>
> **3. Verify it runs**
>
> ```bash theme={null}
> npm install
> npm run dev
> ```
>
> Confirm the app boots on `http://localhost:3000` with no Lovable watermark, favicon, or `<meta>` tags left behind.

> [tab] Figma Make
>
> **1. Export the code**
>
> In Figma Make, download the generated code as a `.zip` file.
>
> **2. Unzip and open in your IDE**
>
> ```bash theme={null}
> unzip figma-make-export.zip -d my-mini
> cd my-mini
> ```
>
> Open the `my-mini` folder in your AI IDE.
>
> **3. Run locally**
>
> Prompt your IDE:
>
> ```text theme={null}
> Set this project up as a Next.js (App Router) + TypeScript +
> Tailwind project, preserving the UI exactly as-is, and run it on
> local host.
> ```
>
> Then verify:
>
> ```bash theme={null}
> npm install
> npm run dev
> ```

> [tab] Google Stitch
>
> **1. Get your Stitch project key**
>
> Open your Stitch project → copy the account/project key.
>
> **2. Install the Stitch MCP in your IDE**
>
> Add the Stitch MCP server to your IDE's MCP configuration and paste in the project key when prompted.
>
> **3. Build the implementation**
>
> Once the MCP connection is live, run this prompt:
>
> ```text theme={null}
> Use the Stitch MCP to list and load my Stitch project, analyze
> every screen, component, design token, typography, spacing,
> colors, responsiveness, and interactions, then build a
> production-ready, pixel-perfect Next.js (App Router) + TypeScript
> + Tailwind + shadcn/ui implementation using reusable components
> and accessibility best practices. Treat Stitch as the single
> source of truth, ask if anything is ambiguous instead of
> guessing, and verify the final implementation against the
> original design until there are no significant visual
> differences.
> ```
>
> **4. Run and compare**
>
> ```bash theme={null}
> npm install
> npm run dev
> ```
>
> Compare pixel-for-pixel against Stitch and iterate with the IDE until satisfied.

> [!WARNING]
>
> **Test Thoroughly**: Test the frontend thoroughly locally before moving to Phase 2. Reworking UI after a Docker deploy is much slower than reworking it in local dev.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.