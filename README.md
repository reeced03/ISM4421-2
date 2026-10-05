# Tunesmith: AI music generator

A one-page web app for making songs with the [Suno API](https://docs.sunoapi.org). Users **sign in with their email** (a one-time link from Supabase, no password), then **enter their own Suno API key** in the app. The app has no server-side key, and each generation uses the credits of the person whose key it is.

## Features

- **Profiles**: display name, profile photo, short bio and favorite genres. New users are asked to set one up on first sign-in (they can skip it). Each profile is private to its owner.
- **Email sign-in** (Supabase passwordless email link). The same link creates the account on first use. Each signed-in user gets their own saved Suno key and song library in the browser.
- **Simple mode**: describe a song and Suno writes the lyrics and music.
- **Custom mode**: set a title, your own lyrics, style, vocal gender, styles to exclude, target length (10–360s), style weight, weirdness, audio weight and variety.
- **AI lyric writer**: give it a theme, pick one of the suggested lyric options, and it fills the lyrics field.
- **Instrumental toggle** and **model picker** (V6 by default; V6 Wild, V6 Mini and older models).
- **Live results**: each request makes 2 variations. They start streaming as soon as the first one is ready and switch to the final MP3 when finished.
- **Download MP3**, **copy lyrics**, and **extend** any track from a chosen point.
- **Credit balance** shown in the header.
- **Library** saved in your browser. Unfinished songs keep updating after a page reload. Suno keeps the files for 14 days.
- Works on phones and has light and dark themes.

## How it works

```
public/index.html          → the whole frontend (HTML/CSS/JS, no build step)
netlify/functions/suno.mjs → small proxy at /api/* → https://api.sunoapi.org
netlify.toml               → Netlify config
```

The browser sends the user's Supabase login token (`Authorization`) and Suno key (`x-suno-key`) to the Netlify Function. The function checks the login with Supabase first (it remembers a valid login for 60 seconds) and rejects requests that aren't signed in. It then passes the Suno key to Suno as `Authorization: Bearer …`. It does not store or log the token or the key. The proxy is there because:

- Suno requires a `callBackUrl`. The function gives Suno `/api/callback`, which simply acknowledges the callback, and the app checks the task status on a timer instead.
- It avoids browser CORS problems and cleans up request parameters (for example, it drops custom-mode-only fields when Simple mode is used).

| App route               | Suno endpoint                        |
|-------------------------|--------------------------------------|
| `POST /api/generate`    | `POST /api/v1/generate`              |
| `POST /api/extend`      | `POST /api/v1/generate/extend`       |
| `POST /api/lyrics`      | `POST /api/v1/lyrics`                |
| `GET /api/status`       | `GET /api/v1/generate/record-info`   |
| `GET /api/lyrics-status`| `GET /api/v1/lyrics/record-info`     |
| `GET /api/credits`      | `GET /api/v1/generate/credit`        |

The key is saved in `localStorage` when "Remember on this device" is checked. Otherwise it is kept in `sessionStorage` and cleared when the tab closes.

## Supabase (login)

- Project: `qnrjcyjipjtkitnzruiq`. Its URL and **publishable** key are in `public/index.html` and `netlify/functions/suno.mjs`. Both are public by design and safe to commit. No secret keys are used anywhere.
- Supabase Auth stores users in its own `auth.users` table.
- **Profiles** (`supabase/migrations/20261005194656_create_profiles_and_avatars.sql`, already applied to the project):
  - `public.profiles` has one row per user: `display_name` (1–50 chars), `bio` (up to 280), `favorite_genres` (up to 10), `avatar_path`. Its access rules (row-level security) let each user read, create and update **only their own** row. Signed-out visitors have no access. The row is deleted automatically if the user's account is deleted.
  - The private `avatars` storage bucket takes PNG/JPG/WebP/GIF images up to 2 MB. Each user can only read and write files in their own `avatars/<user id>/` folder. Photos are shown through signed links that expire.

**One-time dashboard setup (required):**

1. **Authentication → URL Configuration**
   - **Site URL:** `https://YOUR-SITE.netlify.app`
   - **Redirect URLs:** add `https://YOUR-SITE.netlify.app/**` and, for local testing, `http://localhost:8888/**`

   If you skip this, the sign-in links in emails point to `localhost:3000` and won't work.
2. **Email delivery:** Supabase's built-in email sender only delivers to members of your Supabase team, and only a few emails per hour. That's enough for you to test, but before other people can sign in you need to set up **Authentication → Emails → SMTP Settings** with a provider such as [Resend](https://resend.com/docs/send-with-supabase-smtp) (free tier). Until then, other people get the error "This email can't receive sign-in links yet."

## Deploy to Netlify

1. In Netlify: **Add new site → Import an existing project**, then pick this repo and the `main` branch.
2. The build settings come from `netlify.toml` (publish `public`, functions in `netlify/functions`). You don't need a build command or any environment variables.
3. Deploy, open the site and paste your key from <https://sunoapi.org/api-key>.

## Run locally

```bash
npm i -g netlify-cli
netlify dev
```
