const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");
const classNames = require("classnames");

/** @type {import('next').NextConfig} */
module.exports = (phase) => ({
  reactStrictMode: true,
  headers: () => [
    {
      source: "/(.*)",
      locale: false,
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self' blob:",
            "style-src 'unsafe-inline' 'self'",

            // the ffmpeg-wasm library requires "blob:" to work, even though that's not a good idea
            // on safari, it even requires 'unsafe-eval', so I begrudgingly added it as well
            `script-src 'self' blob: 'unsafe-eval'`,
            // safari, again, requires the ws: protocol for live reloading in dev mode
            `connect-src ${classNames("'self' blob:", {
              "ws:": phase === PHASE_DEVELOPMENT_SERVER,
            })}`,

            "form-action 'none'",
            "frame-ancestors 'none'",
          ].join(";"),
        },
        {
          key: "Cross-Origin-Embedder-Policy",
          value: "require-corp",
        },
        {
          key: "Cross-Origin-Opener-Policy",
          value: "same-origin",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "deny",
        },
      ],
    },
  ],
});
