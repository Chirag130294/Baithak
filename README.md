# Baithak · બેઠક (working name)

A phone-first game hub and score book. The host enters scores; friends watch live by room code, QR scan or link.
Games: **Kachuful**, **Score Book** (any game), **Rummy**, **Teen Patti**, **Bhabhi**. Free to host on GitHub Pages.

It works straight away in **demo mode** (saved on one phone). Follow step 2 to add Google / email login and live viewing on other phones.

## 1. Put it on GitHub Pages (free)
1. Create a GitHub repository and upload everything in this folder.
2. Repository **Settings → Pages → Source: GitHub Actions**.
3. Push to the `main` branch. The workflow in `.github/workflows/pages.yml` tests and publishes the site.
4. Your site appears at `https://<your-name>.github.io/<repo>/`.

## 2. Turn on login and live viewing (Firebase, free Spark plan)
1. https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started**. Enable **Google**, **Email/Password → "Email link (passwordless)"** and **Anonymous** (for guests).
   Authentication → Settings → **Authorized domains**: add `<your-name>.github.io`.
3. **Build → Realtime Database → Create database** (any region). Open **Rules**, paste the contents of `database.rules.json`, Publish.
   Anyone with a room code can read a room; only the host can change it.
4. **Project settings → Your apps → Web (</>)**: register an app, copy the config.
5. Paste it into `js/config.js` (`firebaseConfig`), commit and push.

Phone-number (SMS) login needs Firebase's pay-as-you-go **Blaze** plan, so it is off. Set `phoneLogin: true` in `js/config.js` only if you enable it.

## Install on a phone
- **Android (Chrome):** menu → *Install app* (the app also shows an Install button).
- **iPhone (Safari):** Share → *Add to Home Screen*.

## How games are kept separate
Each game is its own folder in `js/games/<id>/` (engine, screen, Gujarati words). The hub only talks to a game through
the small contract described at the top of `js/core/games.js`.
- **Add a game:** copy a folder (Score Book is the simplest), change it, add its id to `GAME_IDS`.
- **Roll back / remove a game:** delete its folder or its id. The hub and other games are untouched. A game that fails to load is skipped.
- Old saved rooms carry a `v` version in their data, so a game can migrate them later.

## Develop
```
npm test            # rules tests (Node 22, no installs needed)
node tools/serve.mjs   # http://localhost:8080
python3 tests/smoke.py # phone-size browser test (needs Playwright + the server running)
```
No build tools or dependencies. The QR code generator is built in (`js/core/qr.js`).
QR scanning uses the phone's built-in `BarcodeDetector` (Chrome/Android); on browsers without it, use the camera app or type the code.

## Kachuful rules built in
Rounds go 1 → max → 1, then 2 → max → 1 (the bottom 1 is not repeated), until the host ends the game. Max = 52 ÷ players (5 players = 10).
Trump rotates Kali → Chatai → Fuli → Lal. Dealer moves one seat each round and bids last, and cannot make bids equal the cards.
Score: bid 0 and win 0 = 10; exact bid n = 11 × n; miss = 0 (all editable).

## Notes
- Gujarati wording needs a read by a native speaker.
- Not yet built: co-hosts who can enter scores from their own phone (needs a rules change), SMS login.
