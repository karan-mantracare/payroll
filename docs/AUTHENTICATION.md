# MantraCare HRMS & Payroll — Authentication Architecture

> **Component:** Authentication Handshake, Session Management, and Token Protection  
> **Handshake Partner:** `https://api.mantracare.com/user/user-info`  
> **Session Cookie:** `mc_payroll_session`

---

## 1. Handshake Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Employee / Admin Browser
    participant Gateway as Programs Gateway
    participant PayrollUI as Payroll Frontend (AuthGate)
    participant PayrollAPI as Payroll Handshake API (/api/auth/handshake)
    participant PlatformAPI as MantraCare Programs API (/user/user-info)
    participant TursoDB as Turso libSQL Database

    User->>Gateway: Open https://programs.mantracare.com/payrol/dash?token=MC_TOKEN_123
    Gateway->>PayrollUI: Load Next.js App Router (basePath: /payrol)
    Note over PayrollUI: AuthGate blocks UI rendering with Full-Screen Security Loader
    PayrollUI->>PayrollAPI: POST /payrol/api/auth/handshake { token: "MC_TOKEN_123" }
    
    Note over PayrollAPI: 1. Hash token (SHA-256)<br/>2. Check replay store (used_tokens)
    alt Token already used / Replay attempt
        PayrollAPI-->>PayrollUI: 401 Unauthorized { code: "TOKEN_ALREADY_USED" }
        PayrollUI->>User: Redirect to /token (Access Denied)
    end

    PayrollAPI->>PlatformAPI: POST https://api.mantracare.com/user/user-info { token: "MC_TOKEN_123" }
    
    alt Platform API failure / Invalid token
        PlatformAPI-->>PayrollAPI: 400 / 401 Error
        PayrollAPI-->>PayrollUI: 401 Unauthorized { code: "INVALID_PLATFORM_TOKEN" }
        PayrollUI->>User: Redirect to /token (Access Denied)
    else Platform API returns 200 OK
        PlatformAPI-->>PayrollAPI: { user_id: "MC_USER_88", email: "alice@mantracare.com", name: "Alice Admin" }
    end

    Note over PayrollAPI: 3. Verify user in HRMS mapping table
    PayrollAPI->>TursoDB: SELECT * FROM users JOIN employees WHERE platform_user_id = 'MC_USER_88'
    
    alt Unmapped or Inactive Employee
        PayrollAPI-->>PayrollUI: 403 Forbidden { code: "NOT_AN_AUTHORIZED_EMPLOYEE" }
        PayrollUI->>User: Display "Account Not Enrolled in HRMS" Screen
    else Active Employee Found
        TursoDB-->>PayrollAPI: { user_id, employee_id, roles, scopes, status: "ACTIVE" }
        Note over PayrollAPI: 4. Record token hash in used_tokens<br/>5. Mint encrypted session in auth_sessions<br/>6. Set HttpOnly, Secure, SameSite=Lax cookie
        PayrollAPI->>TursoDB: INSERT INTO used_tokens; INSERT INTO auth_sessions;
        PayrollAPI-->>PayrollUI: 200 OK { authenticated: true, user: { name, email, roles, permissions } }
        Note over PayrollUI: 7. Strip ?token= from address bar via history.replaceState<br/>8. Unblock UI and render protected portal routes
        PayrollUI->>User: Render /payrol/dash or /payrol/admin
    end
```

---

## 2. Security Guarantees & Threat Mitigations

### 2.1 Replay Attack Protection
Every platform token presented to `/payrol/api/auth/handshake` is hashed using SHA-256 and checked against the `used_tokens` table.
* Once a token is redeemed, it is permanently marked as used with an expiration timestamp (`expires_at = now + 5 minutes`).
* Re-submitting an already used token fails immediately with `401 Unauthorized`.

### 2.2 Server-Side Session Boundary (HttpOnly Cookies)
* We never store sensitive credentials or authorization decisions in browser `sessionStorage` or `localStorage`.
* The server issues a cryptographically signed and encrypted session token stored in the `mc_payroll_session` cookie with:
  * `HttpOnly`: Prevents client-side script (XSS) access.
  * `Secure`: Transmitted strictly over HTTPS in production.
  * `SameSite=Lax`: Prevents CSRF attacks during cross-site requests while supporting standard top-level navigation.
  * `Path=/payrol`: Restricted strictly to the Payroll application root.

### 2.3 Immediate Address Bar Sanitization
Immediately after the token is sent to the handshake endpoint, the client executes:
```ts
const cleanUrl = window.location.pathname + window.location.hash;
window.history.replaceState(null, "", cleanUrl);
```
This guarantees that:
* The token is not retained in browser history.
* The token does not leak via the `Referer` header to external CDNs, fonts, or tracking scripts.
* Bookmarking the page does not save an expired single-use token.

### 2.4 Token Expiry & Session Revocation
* Bootstrap tokens expire after 5 minutes if not redeemed.
* Active sessions expire after 8 hours of inactivity (`28800` seconds).
* Calling `/payrol/api/auth/logout` explicitly revokes the session record in `auth_sessions` and clears the cookie.
* Administrative session termination (e.g. employee termination, role revocation) invalidates all active sessions for that `user_id` instantly in Turso.

### 2.5 Separation of Platform Identity from HR Authorization
A valid login to the general MantraCare platform does **not** grant automatic access to HRMS. The user must exist in the HRMS database with:
1. An active employment status (`employees.status = 'ACTIVE'`).
2. An assigned internal role (`user_roles`).
3. Explicit portal permissions (`portal.admin.access` or `portal.employee.access`).
Users lacking an active HR mapping receive a clear `403 Forbidden` response and are prevented from viewing any HR or payroll data.
