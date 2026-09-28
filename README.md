# Tunesmith: AI music generator

A one-page web app for making songs with the [Suno API](https://docs.sunoapi.org). Each user **enters their own Suno API key** in the app. The app has no server-side key, and each generation uses the credits of the person whose key it is.

## Features

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

The browser sends the user's key in an `x-suno-key` header to the Netlify Function. The function passes it to Suno as `Authorization: Bearer …` and does not store or log it. The proxy is there because:

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

## Deploy to Netlify

1. In Netlify: **Add new site → Import an existing project**, then pick this repo and the `main` branch.
2. The build settings come from `netlify.toml` (publish `public`, functions in `netlify/functions`). You don't need a build command or any environment variables.
3. Deploy, open the site and paste your key from <https://sunoapi.org/api-key>.

## Run locally

```bash
npm i -g netlify-cli
netlify dev
```
