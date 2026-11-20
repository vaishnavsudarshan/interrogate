# Switching on accounts and shared stats

The game works without this. These steps turn on logging in, saved streaks, and the Owner stats page for every player. It takes about 10 minutes, all in the Firebase website. It's free.

## 1. Create the project

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project**. Name it after the game (you can rename it later).
3. Turn **off** Google Analytics when it asks. The game has its own stats page.

## 2. Register the website and copy its config

1. On the project's home page, click the **web icon `</>`** ("Add an app").
2. Give it any nickname. Leave "Firebase Hosting" unticked. Click **Register app**.
3. It shows a block of code containing `const firebaseConfig = { ... }`. Copy just the part in curly braces.
4. Send it to Claude, or paste it into `firebase-config.js` in place of `null`, like this:

```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

These values are meant to be public, so it's fine to share them.

## 3. Turn on sign-in methods

1. In the left menu, go to **Build → Authentication** and click **Get started**.
2. Under **Sign-in method**, enable **Google**. Pick your email as the support email and save.
3. Enable **Email/Password** too, and save. (Usernames use it behind the scenes. Players never see an email.)

## 4. Create the database

1. Go to **Build → Firestore Database** and click **Create database**.
2. Pick a location near you and start in **production mode**.

## 5. Paste the security rules

1. In Firestore, open the **Rules** tab.
2. Replace everything there with the contents of `firestore.rules` from this folder, and click **Publish**.

## 6. Make yourself the owner

1. Open the game, click **Log in**, and create your own account.
2. Open the **Owner stats** link at the bottom. It shows your user ID.
3. Send that ID to Claude, or put it in two places yourself:
   - `firebase-config.js`: `window.OWNER_UIDS = ["your-id"];`
   - In the Firestore **Rules** tab: replace `PASTE_YOUR_USER_ID_HERE` with your ID, then **Publish** again.

## 7. When the game goes online

Under **Authentication → Settings → Authorized domains**, add the game's domain. Localhost is already on the list, so testing on your computer works without this.

# Switching on the AI question reader (free)

The game understands common questions by itself. For everything else, it asks a free Cloudflare AI.

1. Cloudflare: **Compute → Workers & Pages → Create → Start with Hello World!**. Name it `interrogate-ai` and click **Deploy**.
2. Click **Edit code**. Delete everything, paste in all of `question-ai-worker.js`, and click **Deploy**.
3. Answer cache (keeps it free at scale): **Storage & databases → D1 → Create database**, name it `interrogate-cache`, create it.
4. Open the worker: **Settings → Bindings → Add**:
   - **Workers AI**, variable name `AI`.
   - **D1 database**, variable name `DB`, database `interrogate-cache`.
5. Copy the worker's address (ends in `.workers.dev`) and send it to Claude.

# If the game gets huge

- Firebase's free plan allows about 20,000 stat updates a day. If the Owner stats page stops growing, set `window.STATS_SAMPLE = 0.05;` in `firebase-config.js` to count 1 in 20 games. The page scales the numbers back up.
- Cloudflare Workers' free plan allows 100,000 AI-reader requests a day. Only questions the game can't match itself, and that no one has asked before about that day's secret, reach the AI.
