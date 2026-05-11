# 2026-05-11 PDF font export fix

- Added cross-origin headers for `/fonts/:path*` so Puppeteer PDF export and downloaded HTML opened from a local file can load custom font assets.
- This fixes fallback-to-system-font rendering for custom stacks such as `"CodeNewRoman Nerd Font Mono", "Resource Han Rounded CN", "Noto Sans SC"`.
