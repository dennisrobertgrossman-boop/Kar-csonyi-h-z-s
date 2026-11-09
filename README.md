# Neon Noël – family Christmas gift draw

Static cyberpunk-style website (works on GitHub Pages). Each person enters a personal code and sees whom they buy a gift for. Wishlists are shown at the bottom.

## How it works
- `people.json` – names and wishlists (edit this).
- `node tools/generate.js` – draws a valid assignment (single cycle: nobody draws themselves, everyone draws once and is drawn once), creates a code per person, and writes:
  - `data.js` – **public**, assignments encrypted (PBKDF2-SHA256 + AES-256-GCM); the code is the only key.
  - `codes.txt` – **secret**, git-ignored: each person's code. Send each person only their own line.
- Re-running the generator creates a **new** draw and new codes. After codes are handed out, change wishlists in `people.json` and run `node tools/generate.js --wishlists` (draw and codes stay unchanged).

## Publish
Commit `index.html`, `style.css`, `app.js`, `data.js`, then enable GitHub Pages (Settings → Pages → deploy from branch).
