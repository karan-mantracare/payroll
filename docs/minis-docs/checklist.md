> ## Documentation Index
> Fetch the complete documentation index at: https://minis-workflow.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# End-to-End Checklist

> Use this as your final pre-launch pass on every new Mini.

Use this as your final pre-launch pass on every new Mini:

* [ ] UI finalized and tested locally (Lovable / Figma Make / Stitch) before any deploy work
* [ ] Repo created, pushed, `USERNAME`/`PASSWORD` secrets added
* [ ] `next.config.js` and `Dockerfile` reference the **same** slug
* [ ] Manual Docker build/push succeeded once, then CI workflow added and green
* [ ] Minis project created with **underscore** slug, port `80`, correct image, deployed and reviewed
* [ ] Neon project created (Postgres 18, Singapore region), tables created with `created_at`/`updated_at`/`user_id`
* [ ] Auth handshake implemented with blocking loader, `sessionStorage`, RLS enabled in Neon
* [ ] `DATABASE_URL` set as a Minis environment variable, never hardcoded client-side
* [ ] No mixed-content / HTTP reload issues when embedded in `web.mantracare.com`
* [ ] Exit + navigate WebView messaging implemented and origin-checked
* [ ] i18n implemented module-by-module, verified via `?lang=` switching
* [ ] Pathway completion webhook wired and tested via admin "tracking required" flow
* [ ] Insights webhook payload shape confirmed with Garv and implemented
* [ ] History page reads real per-user data back from the DB
* [ ] Share button implemented
* [ ] Mixpanel tracking live, WoW qualifying metrics defined, growth loop documented

***

> [!NOTE]
>
> Questions on the Insights webhook contract or pathway edge cases → ping **Garv**. Everything else in this doc should be self-sufficient; if you find a gap, update the documentation rather than solving it silently, so the next engineer doesn't have to rediscover it.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.