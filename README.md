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

## v1.5: speed, setup flow, card buddies, sound, Kali Tiri teams

**Speed**
- The offline cache now saves every file of a release in one go (the GitHub workflow stamps the file list), so repeat opens read from the phone instead of asking the network for ~70 files one by one.
- A room only loads its own game (not all six), a new room is created in one database write (no code-exists check, no second download), and the first screen no longer waits for a slow profile.
- A branded splash shows instantly; connections to Google/Firebase start early.

**Setup is three short steps** (Players, Game rules, Name and create) that slide, with no full-screen redraw, so typing and adding players never flashes.

**Names** are tidied everywhere: `chirag` / `RITU` become `Chirag` / `Ritu`. Names that already have mixed capitals (`McDonald`) and Gujarati are left alone.

**Card buddies** (original animated card characters): Peek, Kiss (then shy), Confused, Sleepy, Angry, Thinking, Walk, Cheer. They are reactions (a banner shows who is sending what to whom, and the buddy plays on the target's name) and they react inside Kachuful: angry on a miss, cheering on a perfect round, confused when bids equal the cards, a walking dealer, thinking and then sleeping when idle, confetti and a fanfare at the end.

**Sound** is generated by the browser (no audio files, nothing to download). One switch in Customize.

**Customize** (profile and room menu): theme, colour, text size, spacing, animations, vibration, sound, reactions, keep screen on. Install prompt: after first sign-in, at game end, or after a viewer has watched for a minute, with Remind me later (3, 7, then 30 days) and No thanks.

**Kali Tiri**: 4 to 15 players; any number of partners per round (everyone else is the opposition); 1, 2 or 3 decks (3 decks = 450 to 750); optional Bidder bonus and optional "Trump team loses points if it fails", each with an example popup; the highest bidder picks the trump on big card buttons (including No trump); a round can be saved with the result still open.

**Deploy:** replace the files, then paste ALL of `database.rules.json` into Firebase, Realtime Database, Rules and Publish (the reaction list grew). Reload each phone once.

## v1.5.1
- Dense ranking everywhere (1,1,2,2,3...) in scoring and the shared picture.
- Collapsed Standings shows Top 4 pills; a new leader pushes the old one along (animated).
- Reaction ribbon ("Chirag blew a kiss to Ritu") now sits below the header for host and viewers.
- Shared game-over picture: podium with medals, then every player and score.

## v1.6.0 (checkpoint A: look system + live board)
- Four colour skins (Felt Green, Midnight Gold, Clean Light, Arcade Purple) and a Look switch: Sleek (compact, default) or Classic (big buttons). Both in Customize.
- Swipeable one-row action rail (Seats, Undo, Pause, End game) instead of two rows of big buttons.
- Standings with gold/silver/bronze rank badges, round book shows the last 2 rounds ("Show all"), shared Game-over banner, pinned Save button in the round sheet.
- Fixes: bottom tab bar no longer sits below the screen; Kachuful bottom dock no longer pushed off screen; setup panes no longer slide sideways when a field is focused.

## v1.6.0 (complete)
- Home, Login, Profile and room menus compacted so each fits one phone screen; menus are tidy list rows with a pinned Close.
- Players screen: regulars are a swipeable row at the top that narrows as you type; names suggest themselves in grey like a spreadsheet (Tab, right arrow, Enter or the tick accepts).
- Game over: winner banner with a podium that rises place by place (ties share a place), then the full standings.
- Loading visuals: cards are dealt in on the splash, shimmering wordmark and glow; skin-aware skeletons.
- Tests updated for the rail and new class names.

## v1.7.0 (security hardening)
- **Room codes are now 8 letters and numbers**, shown like `KF-7H4K-9QXM` (no 0/O/1/I/L). Older 4-digit rooms still open. The rules refuse new rooms with any other shape.
- **Wrong-code lockout**: 3 wrong codes lock joining for 1 minute, the next 3 for 3, then 6, 12, 30, 60 minutes. Rooms you opened before always still work. It lives on the phone (a speed bump, not a vault).
- **Private rooms**: the host can set a 4 to 6 digit PIN when creating a room. The database itself hides a private room until the right PIN is entered.
- **App Check** support (paste the site key into `js/config.js`) and **hardened rules**: one new room per account per 10 seconds, reaction rate cap, presence and profile checks.
- New `SECURITY.md` with the exact console steps. **Republish `database.rules.json`** after uploading this version.
