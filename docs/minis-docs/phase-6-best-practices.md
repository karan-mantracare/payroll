> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Phase 6: Best Practices & Maintenance

> Keep your project clean, manage registry storage limits, and optimize Docker artifacts.

As your Mini matures and you deploy more updates, maintaining a clean and optimized environment becomes critical. This phase covers essential practices for managing your artifacts and ensuring your builds remain efficient.

### Managing Harbor Registry Storage

Our Harbor container registry (`bunker.mantracare.com`) has a strict **5 GiB storage limit** for the `lovable` project directory. If you frequently push new Docker images without cleaning up, you will hit this limit and subsequent deployments will fail.

**How to clean up old artifacts:**

1. Navigate to [https://bunker.mantracare.com/](https://bunker.mantracare.com/) and log in with your credentials.
2. Open the **lovable** project folder and find your specific project slug (e.g., `provider_pathways`).
3. Check the number of artifacts. If there are more than 2-3 versions, it's time to clean up.
4. Click on your repository to view the artifact list.
5. Select all the old, untagged, or unused artifacts that you want to delete.
6. Click on the **Actions** dropdown and select **Delete**.

> [!WARNING]
>
> **Delete sanely!** This is an irreversible process. If you accidentally delete the artifact that is currently running in production, you will need to rerun your CI pipeline to build and push a new Docker image. Always ensure you are keeping the `latest` tag and the currently deployed version.

### Vibe Coding & Codebase Cleanliness

When moving fast with "vibe coding" (relying heavily on AI for generation), it's easy for code to become messy.

* **Next.js Structure:** Keep your components modular. Don't bloat your `page.tsx` files. Extract UI components, utilities, and hooks into their respective folders.
* **Design Cleanliness:** Stick to the established design system (Tailwind classes, shadcn/ui). Avoid arbitrary, hardcoded spacing or colors (e.g., `h-[43px]`).
* **Database Securities:** Never trust client-side data. Always validate payloads via Zod on your backend routes, and never expose database credentials or service roles to the frontend.

### Row Level Security (RLS)

If using Supabase or Postgres, **Row Level Security (RLS)** is non-negotiable. RLS ensures that users can only read, update, or delete rows that belong to them.

* Always enable RLS on every table.
* Write specific policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
* Test that unauthenticated users cannot access sensitive tables.

### State Management: URL Params vs. Cookies vs. DB

Knowing where to store data prevents security risks and UX bugs:

* **URL Params (`?upa_id=123`):** Use for shareable state, filtering, pagination, or routing context. Never put sensitive data (like tokens or PII) in the URL.
* **Cookies / Session Storage:** Use for transient authentication state, UI preferences (like dark mode), or temporary session context before a user commits an action.
* **Database:** Use for permanent records, user profiles, completed activities, and anything that must persist across devices.

### AI IDE & Model Selection Guide

When using Antigravity and other AI tools, optimize your credits and limits:

* **Gemini Flash 3.6:** Perfect for minor tasks, quick refactors, and simple file edits.
* **Gemini 3.1 Pro:** The heavy lifter. Use this for complex backend implementations, architectural changes, and difficult logic.
* **Claude Models:** Best for UI/UX and design changes. However, **limits are very low**, so use Claude sparingly and only when you need high-tier design intuition.
* **Opencode:** If using Opencode, max out the free DeepSeek model to get the bulk of the grunt work done.
* **Claude.ai (Web):** Use the free web interface to brainstorm prompting techniques, debug blockers, or plan out architecture. Do not waste your limited AI IDE credits on brainstorming!

### Third-Party Code Generators

* **Figma Make:** We are on the free plan. Add **all** your requirements into a single, comprehensive prompt because it won't stop until the prompt's work is done. You can't easily iterate.
* **Lovable:** We have a paid plan here, but credits still matter. A single Mini-app should take **less than 5 credits**. Focus Lovable purely on UI/Frontend generation. **Do not** ask Lovable to write backend logic; let Antigravity handle the backend in your IDE.

### Prompting Best Practices

* **Never write API keys or secrets in prompts.** They can get logged or leaked. Pass them via `.env` files and tell the AI to look for the environment variable.
* Be explicit about constraints (e.g., "Use Tailwind, no custom CSS", or "Only edit the `src/components` folder").
* Provide context, but don't overwhelm the context window with irrelevant files.

### Glossary & Tooling

#### What is MCP?

**Model Context Protocol (MCP)** is a standardized way for AI models to interact with your local environment, internal tools, and external services safely. By using MCP servers, your AI IDE can securely fetch documentation, interact with design systems, or query internal APIs without needing hardcoded credentials in the prompt.

#### What is a Skill?

A **Skill** is a reusable set of instructions, context, or rules you can teach your AI IDE.

* **How to use them:** You can create markdown files in a `.agents/skills` directory (or globally) that define specific patterns (e.g., "How we do i18n", "Our API standards").
* **Why add them:** Adding skills prevents you from having to copy-paste the same long prompt for every new component. The AI automatically loads the skill when it matches the context of your request.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.