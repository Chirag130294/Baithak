# Baithak security checklist (v1.7.0)

The Firebase web key in `js/config.js` is a public identifier, not a password. What actually protects the data is
(1) the database rules, (2) App Check, and (3) the long random room codes. Do these once, in this order. Each step is free.

## 1. Publish the new rules (2 minutes)
Firebase console > Build > Realtime Database > **Rules** > paste the whole of `database.rules.json` > **Publish**.
What they now do: new rooms need the long code; one account can create one room per 10 seconds; reactions are capped at about
4 a second per room and only work in rooms that exist; presence is checked; profiles have a size cap; private rooms (PIN) are
unreadable without the PIN. Tip: open the **Rules Playground** tab and try a read of `/rooms/KF-4821` while signed out; old open rooms still read, as before.

## 2. Turn on App Check (10 minutes)
1. Go to https://www.google.com/recaptcha/admin and create a **reCAPTCHA v3** site. Add your site's domain (for example `yourname.github.io`) and `localhost`. Copy the **site key** and the **secret key**.
2. Firebase console > Build > **App Check** > Apps > your web app > **reCAPTCHA** > paste the **secret key** > Save.
3. Put the **site key** in `js/config.js`: `export const appCheckSiteKey = 'PASTE_SITE_KEY';`. Upload, wait for the deploy.
4. Open the app, use it for a day. In App Check > APIs you will see "verified requests". Only when nearly all requests are verified, click **Enforce** on **Realtime Database**.
   Do the same for Authentication if the console offers it for your project (it may ask you to upgrade to Identity Platform; skip that if it does, it is not needed).
5. On your own computer, `localhost` prints an App Check **debug token** in the browser console the first time. Add it under App Check > Apps > Manage debug tokens, or testing on localhost will be refused once enforcement is on.

If enforcement ever locks everyone out, click **Unenforce** in the same place. The app itself keeps working while App Check is not enforced.

## 3. Restrict the API key (3 minutes)
Google Cloud console > APIs & Services > **Credentials** > the "Browser key" > Application restrictions: **Websites** > add
`https://YOURNAME.github.io/*` and `http://localhost:*/*`. Also Firebase > Authentication > Settings > **Authorized domains**: keep only your site and localhost.

## 4. Billing
Stay on the **Spark** plan: it cannot charge you; it only stops when a free limit is hit. If you ever move to Blaze, set a **budget alert** first (Google Cloud > Billing > Budgets).

## 5. Panic button
If someone abuses the database, paste this in Rules and Publish. Everything becomes read-only within seconds; fix things calmly after.
```
{ "rules": { ".read": true, ".write": false } }
```

## 6. Optional: only signed-in (non-guest) people may host
In `database.rules.json`, on the `rooms/$code` `.write` line, add `&& auth.token.firebase.sign_in_provider !== 'anonymous'` before the closing quote.
Then guests can watch and react but not create rooms. Change `features.guest` in `config.js` only if you also want to hide the guest button.

## What each protection really does (honest limits)
| Protection | Stops | Does not stop |
|---|---|---|
| Long room codes (about 850 billion) | Guessing a room by trying codes | Someone you shared the code with |
| App Check | Scripts and copied sites calling your database | A person using your real site by hand |
| Rules: 1 room / 10 s, reaction cap | Mass room and reaction spam from one account | Slow abuse by many accounts (App Check covers that) |
| Wrong-code lockout (1, 3, 6, 12, 30, 60 min) | Typo hammering and lazy scripts | A determined person who clears site data; it lives on the phone |
| Room PIN (4 to 6 digits) | Strangers who only have the code or QR | Someone who has the code and guesses PINs for a long time. Use 6 digits for sensitive rooms |
| Old 4-digit rooms (KF-4821) | n/a | They stay guessable. They are old rooms; new rooms never use that format |

Notes: a watcher who unlocks a private room is signed in as an anonymous guest. The "room exists" message differs from the PIN screen, so a PIN room reveals that its code exists; with 8-character codes that is not guessable.
