# Neon Noël – family Christmas gift draw

Static cyberpunk-style website (works on GitHub Pages). Each person enters a personal code and sees whom they buy a gift for. Wishlists are shown at the bottom.

## Files
- `people.json` – names, partners (`"partner"`, must be mutual) and wishlists.
- `tools/generate.js` – draws and writes `data.js` (public, encrypted) and `codes.txt` (secret, git-ignored; names and codes only, no pairings).
- `tools/verify.js` – checks the draw without revealing it.

## Rules enforced
Nobody draws themselves or their partner; nobody draws a person who draws them back; everyone draws exactly one name and is drawn exactly once.

## Workflow
1. `node tools/generate.js` – makes the draw and the codes. If a draw already exists it REFUSES (to protect issued codes); `--new-draw` overrides this deliberately and saves the old files as `*.bak`.
2. `node tools/verify.js` – must end with `ALL CHECKS PASSED` (add `--show` to print pairings; this spoils the surprise).
3. Send each person only their own line from `codes.txt`.
4. Later wishlist changes: edit `people.json`, run `node tools/generate.js --wishlists` (draw and codes stay), then `node tools/verify.js`.
5. Commit and push `data.js` (never `codes.txt`).
