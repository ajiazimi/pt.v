# PT. Vier Virya Ventures — Enterprise IT Infrastructure Portal

Production web application for **PT. Vier Virya Ventures** built with Vite, TypeScript, and a code-split Three.js WebGL dot-matrix globe.

## Local Development & Build

```bash
npm install
npm run dev      # Starts Vite dev server on http://0.0.0.0:3000
npm run lint     # Runs TypeScript type-checking (tsc --noEmit)
npm run build    # Produces production bundle in ./dist
npm run preview  # Previews production build with security headers
```

---

## Security Headers & Disclosure Policy

Security headers are enforced in two layers:
1. **Production Edge (`vercel.json`)** for Vercel deployments.
2. **Vite Server & Preview Middleware (`vite.config.ts`)** for local development and `vite preview`.

Configured response headers:
- `Content-Security-Policy`: Strict `script-src 'self'` (zero `'unsafe-inline'` scripts; pre-paint initializer lives in `public/assets/theme-init.js` and application logic in `src/site.js`).
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `SAMEORIGIN`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`
- `Cross-Origin-Opener-Policy`: `same-origin`
- `Cross-Origin-Resource-Policy`: `same-origin`
- `Cross-Origin-Embedder-Policy`: `credentialless`
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload` (Vercel HTTPS)

Security disclosure contact metadata is published at `/.well-known/security.txt` (`public/.well-known/security.txt`). Keep its `Expires` timestamp under 12 months ahead and optionally clear-sign it with your organization's PGP key (`gpg --clearsign public/.well-known/security.txt`).

---

## DNS & Email Authentication Configuration (SPF, DMARC, DKIM)

DNS and email authentication records cannot be applied from application code and must be configured in your domain registrar or DNS provider (such as Cloudflare, PANDI registrar panel, Route 53, or hosting DNS).

### 1. Vercel Custom Domain Records

Ensure the root domain and `www` subdomain in Vercel use the **same domain/TLD** (for example, `pt-v.co.id` and `www.pt-v.co.id`):

| Type | Name / Host | Value |
| :--- | :--- | :--- |
| `A` | `@` | `216.198.79.1` |
| `CNAME` | `www` | Target provided in **Vercel Dashboard → Project → Settings → Domains** |

> If using Cloudflare, set the `A` and `CNAME` records to **DNS Only (grey cloud)** until Vercel shows **Valid Configuration**, then switch to **Proxied (orange cloud)** with Cloudflare **SSL/TLS → Full (strict)**.

---

### 2. SPF Record (`v=spf1`)

SPF specifies which mail servers are authorized to send email on behalf of your domain. Only publish **one** `v=spf1` TXT record on `@`.

**Option A — Domain sends email via Google Workspace:**

| Type | Name / Host | Value |
| :--- | :--- | :--- |
| `TXT` | `@` | `v=spf1 include:_spf.google.com ~all` |

**Option B — Domain sends email via Microsoft 365:**

| Type | Name / Host | Value |
| :--- | :--- | :--- |
| `TXT` | `@` | `v=spf1 include:spf.protection.outlook.com ~all` |

**Option C — Domain does NOT send any email:**

| Type | Name / Host | Value |
| :--- | :--- | :--- |
| `TXT` | `@` | `v=spf1 -all` |

> **Important:** Keep total SPF DNS lookups at or below 10. Once all legitimate senders are verified, tighten `~all` (softfail) to `-all` (hardfail).

---

### 3. DKIM Key (`<selector>._domainkey`)

DKIM cryptographically signs outgoing emails so receiving servers verify authenticity and detect tampering.

1. Open your email provider's admin console (for example, **Google Workspace Admin → Apps → Google Workspace → Gmail → Authenticate email**, or **Microsoft 365 Defender → Email authentication → DKIM**).
2. Generate a **2048-bit** DKIM key for your domain.
3. Publish the generated TXT record in your DNS zone:

| Type | Name / Host | Value |
| :--- | :--- | :--- |
| `TXT` | `google._domainkey` *(or provider selector)* | `v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>` |

4. Return to your mail provider's console and click **Start authentication / Enable DKIM**.

---

### 4. DMARC Record (`_dmarc`)

DMARC builds on SPF and DKIM to tell receiving mail servers how to handle spoofed or unauthenticated messages and where to send aggregate reports.

Start in monitoring mode (`p=none`) for 1–2 weeks to verify legitimate mail passes SPF/DKIM alignment, then enforce `p=quarantine` and finally `p=reject`:

**Recommended Enforced Record:**

| Type | Name / Host | Value |
| :--- | :--- | :--- |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:info@vierventures.com; fo=1; adkim=s; aspf=s; pct=100` |

> Replace `info@vierventures.com` with your monitored DMARC mailbox if using a dedicated reporting address. Once aggregate reports confirm zero legitimate failures, upgrade `p=quarantine` to `p=reject`.

---

### 5. DNSSEC, WAF, OCSP Stapling & Edge Hardening

- **DNSSEC**: Enable **DNSSEC** in your DNS provider (e.g., Cloudflare **DNS → Settings → Enable DNSSEC**) and submit the generated `DS` record at your domain registrar.
- **WAF & Server Header Masking**: Proxying your domain through **Cloudflare** (after Vercel domain verification) enables Cloudflare Web Application Firewall (WAF) rules, edge OCSP stapling, and overrides Vercel's `Server: Vercel` response header.

---

### 6. Verification Commands

Run after DNS propagation (typically 5–30 minutes):

```bash
# Check SPF record
dig +short TXT yourdomain.com

# Check DMARC record
dig +short TXT _dmarc.yourdomain.com

# Check DKIM record (replace selector with your provider's selector, e.g. google)
dig +short TXT google._domainkey.yourdomain.com

# Check DNSSEC DS record
dig +short DS yourdomain.com

# Check live HTTP security headers
curl -sI https://yourdomain.com/
```
