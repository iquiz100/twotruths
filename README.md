# Two Truths — couples quiz

A no-login, two-link couples quiz. One person sets it up, gets a link for
themselves and a link for their partner, each answers privately on their own
phone, and once both are done each of you gets a private results page
showing only what you're both open to.

It's a static site (plain HTML/CSS/JS, no build step) that stores answers in
Firebase Firestore. That combination is what lets it run on GitHub Pages
with no server of your own.

## How it works, in short

- `index.html` — create a session, get two links (yours + your partner's).
- `quiz.html` — the consent screen, then one question at a time.
- `results.html` — waits until both people are done, then shows matches.

There's no username/password anywhere. **The link itself is the
credential** — anyone with a link can view or answer that session. Treat
links like you'd treat a shared private photo: fine to send directly to
your partner, not fine to post publicly. See "Privacy model" below for the
exact guarantees this does and doesn't give you.

## 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (any name, Google Analytics not needed — you can skip it).
2. In the project, click **Build → Firestore Database → Create database**. Choose **Production mode**, pick any region.
3. Once created, go to **Rules** and replace the contents with everything in `firestore.rules` from this project, then **Publish**. This is what makes the "unguessable link" model actually hold — it blocks anyone from listing/enumerating all sessions, while still letting anyone with a specific session ID read or write it.
4. Back in **Project settings → General**, scroll to "Your apps," click the **</> (Web)** icon, register an app (any nickname), and skip hosting setup — you don't need it.
5. Copy the `firebaseConfig` object it gives you.

## 2. Fill in your config

Open `js/firebase-config.js` and paste your values in:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

This file is fine to be public in your repo — it identifies your Firebase
project, it isn't a secret. Access control comes from the Firestore rules
you published in step 1, not from hiding this file.

## 3. Test locally before deploying

Because the pages `fetch()` the JSON question files, opening `index.html`
directly from your filesystem (`file://...`) won't work — browsers block
that. Run a tiny local server from the project folder instead:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Create a session, open your link and
your partner's link in two different browser tabs (or your phone, on the
same wifi, using your computer's local IP instead of `localhost`), answer
both, then open the results link.

## 4. Deploy to GitHub Pages

1. Push this folder to a new GitHub repo.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment," choose **Deploy from a branch**, branch
   `main`, folder `/ (root)`. Save.
4. GitHub gives you a URL like `https://yourusername.github.io/your-repo/`.
   That's your site — `index.html` is the homepage automatically.

Every link the app generates is built relative to the page you're on, so it
automatically works whether you're testing at `localhost:8000` or live at
`yourusername.github.io/your-repo/` — nothing to change.

## The answer scale

| Code | Label | Meaning |
|---|---|---|
| `YR` | Yes | Actively want this, in real life |
| `YF` | Yes (fantasy) | Want this, but only as a fantasy — not IRL |
| `OR` | Open | Neutral-to-positive on trying this IRL |
| `OF` | Open (fantasy) | Neutral-to-positive on this as a fantasy only |
| `No` | No | Not interested |
| `Never` | Never | A hard limit |

**Matching logic** (`js/matching.js`), per question:

| You | Partner | Shown as |
|---|---|---|
| `YR`/`OR` | `YR`/`OR` | **Real match** |
| `YR`/`OR`/`YF`/`OF` | `YF`/`OF` (either side) | **Fantasy match** |
| anything | `No` or `Never` | Not shown |
| `No` or `Never` | anything | Not shown |

`No` and `Never` behave identically in the shared results — neither one
tells your partner anything, and neither surfaces the item. The difference
only shows up in the **private "For your eyes only" section** on your own
results page: anything your partner marked `Never` is listed there, for
you alone, so you know not to raise it. Your partner never knows whether or
that you've seen it.

If you'd rather that private section show a count instead of the actual
item text (more private, less useful for actually avoiding the topic),
that's a one-line change in `js/results.js` — swap the loop that renders
`hardLimits` items for a single count message.

## Adding more questions

Edit `data/questions.json`. Each entry is:

```json
{ "id": "unique_id", "category": "Category Name", "text": "The question text", "note": "optional safety note" }
```

- `id` must be unique across the whole file (used as a Firestore field key).
- `category` must exactly match a string in `data/categories.json` to be
  grouped correctly; anything that doesn't match gets grouped under "More"
  at the end, so typos won't break anything, just misplace the question.
- `note` is optional — shown in amber under the question text, meant for
  brief safety reminders (see the kink-adjacent questions for examples).

Reorder categories, or add new ones, by editing `data/categories.json` —
the array order is the display order everywhere.

There are ~30 sample questions across all 11 categories right now, enough
to test the full pipeline end to end. Add the rest whenever you're ready;
no code changes needed.

## Privacy model — what this does and doesn't protect

- No login exists. A session's two links are the only way in.
- Firestore rules block listing all sessions, so someone can't browse or
  discover sessions without a specific link.
- A session ID is a 24-character random string — not brute-forceable in
  practice.
- That said: this is security through obscurity, not encryption. Anthropic/
  Firebase, you as the site operator (via the Firebase console), or anyone
  who obtains a specific link can read that session's answers. If someone
  screenshots or forwards a link, they can access it. There's no way to
  "revoke" a link short of deleting the session document.
- Data persists in Firestore indefinitely unless you delete it. If you want
  auto-expiry, Firestore supports TTL policies on a timestamp field
  (`createdAt` is already there) — worth setting up later if you're running
  this for real users rather than testing.

## Costs

Firebase's free "Spark" tier covers this comfortably for personal or
small-scale use (50K reads/20K writes per day). You'd only need to upgrade
if usage got significant.
