import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' https://d8j0ntlcm91z4.cloudfront.net",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function buildSecurityHeaders(isAiStudioDev: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': `${CONTENT_SECURITY_POLICY}; ${
      isAiStudioDev
        ? "frame-ancestors 'self' https://aistudio.google.com https://*.google.com"
        : "frame-ancestors 'self'"
    }`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  };

  if (!isAiStudioDev) {
    headers['X-Frame-Options'] = 'SAMEORIGIN';
  }

  return headers;
}

function securityHeadersMiddleware(isAiStudioDev: boolean): Plugin {
  const devHeaders = buildSecurityHeaders(isAiStudioDev);
  const previewHeaders = buildSecurityHeaders(false);

  return {
    name: 'vv-security-headers',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [key, value] of Object.entries(devHeaders)) {
          res.setHeader(key, value);
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [key, value] of Object.entries(previewHeaders)) {
          res.setHeader(key, value);
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  const isAiStudioDev = process.env.DISABLE_HMR === 'true';

  return {
    base: './',
    plugins: [react(), tailwindcss(), securityHeadersMiddleware(isAiStudioDev)],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 650,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: !isAiStudioDev,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: isAiStudioDev ? null : {},
    },
  };
});
