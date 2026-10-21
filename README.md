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


## Audit log, locking and Oweize (v1.2)

1. **Publish the new rules.** Firebase console → Realtime Database → Rules → paste all of `database.rules.json` → Publish.
   Then reload the app on every phone once (old cached copies would be refused by the new rules).
2. **Audit log.** Every score, correction, bid lock, pause, player change and undo is saved to `audits/<room>` together with the score
   change in one atomic write. Entries can be added, never edited or deleted. Open it from the room menu → *Audit log*; export it as CSV.
3. **Lock.** When the game has ended the host taps *Finish and lock room*. After that the database refuses score changes and new log entries.
4. **Rooms are no longer deleted.** "Delete room" became "Remove from my list" (the room and its log stay).
5. **Oweize.** Teen Patti → Ledger → *Export for Oweize (CSV)* opens the phone share sheet with columns Date, Description, Cost, Who Paid, Who Owes.
   The exact Oweize import format could not be checked from here; if it wants other column names, edit `CSV_HEADER` in `js/core/export.js`.
6. **Honest limit.** Rules cannot force a score write to carry a log entry; the app always writes both together, and each entry stores
   a totals snapshot and a data hash so tampering shows up. Test the rules in the Rules Playground. A Firestore version is in `docs/firestore-alternative.md`.
7. **Install & footer.** Install button on Home/Me and the room menu; "Crafted by Chirag" sits above the bottom tabs on the Games screen.
8. **Keep screen on** (room menu) and **Max cards per hand** (Kachuful setup/settings) are included.

## v1.3: reasons, history and reactions

- **Changes need a reason.** Fixing a saved round/hand or undoing one asks "why?" (required). The old score stays in the Round book / Hands list,
  struck through with the reason, who did it and when; the new score sits just above. Totals only count the new score. This works while the room is
  unlocked, and every change is also written to the audit log with its reason. Currently done for **Kachuful** and **Teen Patti**.
- **After the game ends** the host only sees Modify (with reason), Share, Finish and lock, and Rematch. Undo, Pause, Seats, Scoring and End are hidden.
- **Reactions.** The 😄 button (bottom right, for host and viewers) opens 10 animated reactions: hammer, fire, celebrate, clap, splash, laugh, tomato,
  clown, dead, love. Hammer, splash, tomato and clown can be aimed at a player's name. **You must republish `database.rules.json`** (new `reactions` section).
  Reactions are tiny, hold no scores, and each phone deletes its own after 20 seconds.

## v1.4: all apps, Kali Tiri, motion, names, share picture

- **Six apps:** Kachuful, Teen Patti, **Kali Tiri (new)**, Rummy, Bhabhi, Score Book.
- **Same behaviour in every app:** undo and fixes need a written reason; the old score stays in the history, struck through, with the reason; only the new score counts; after the game ends only *Modify*, *Share picture*, *Finish and lock room* (and Rematch where it exists) are left.
- **Kali Tiri:** 4 to 6 players. Bidder + hidden partner = Trump team. Trump team makes its bid: each member scores the bid. Opposition wins: each of them scores **double** (multiplier is a setting). Optional "Trump team loses the bid when it fails". "2 decks bundle" switches the bid range to 300 to 500.
- **Kachuful:** unbid players count as 0 when you lock; after locking everyone is a Hit and you tap the players who missed (Settings can switch back to entering tricks). Dealer arc animation, trump card flip-and-fly reveal, white card thumbnail (red Lal/Chatai, black Kali/Fuli). Animations: Full / Light / Off in the room menu.
- **Names:** duplicates are refused with a "Use Name 2" suggestion; 20 letters counted properly for Gujarati and emoji; old duplicates show "(2)"; tap a shortened name to read it in full.
- **Share picture:** after a game ends everyone (host and viewers) can share a 1080x1350 post or 1080x1920 story with podium, standings, highlights, a QR to the site and a small "Crafted by Chirag".
- **Update banner:** when a new version is deployed, open apps show "A new version is ready. Reload".
- **Locked rooms:** the host gets "New game, same players".

### Deploy checklist (everything outstanding)
1. Upload the zip contents to GitHub (replace files, keep `js/config.js` with your Firebase config).
2. Firebase console, Realtime Database, Rules: paste all of `database.rules.json`, Publish (audit log, locking, reactions).
3. Open the site once on each phone and reload once.
4. Optional but recommended: test the rules in the Rules Playground (see section "Audit log, locking and Oweize").
