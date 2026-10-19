# ASCII Dissolve Studio

Browser-based creative tools for turning images into ASCII gradients and exporting animated transitions.

## Run locally

No installation or build step is required. From this folder, run:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 for the image studio, or http://localhost:8080/transition/ for transitions. Stop the server with Ctrl+C.

## Files to edit

- `index.html`: image studio markup and English interface labels.
- `app.js`: image rendering, controls, notifications and exports. Dynamic English strings are here.
- `style.css`: image studio styling.
- `transition/index.html`: transition interface and English labels.
- `transition/transition.js`: transition rendering, notifications and exports.
- `transition/transition.css`: transition styling.
- `vendor/mp4-muxer.js`: bundled third-party MP4 muxer. Its license is included alongside it.
- `vercel.json`: static deployment configuration.

## Features and browser requirements

The image studio supports linear, diagonal, radial and wave gradients, character palettes, adjustable colors, PNG, text and MP4 exports. The transition tool exports animated MP4 transitions. Images are processed locally in the browser; this source has no backend and needs no API key.

MP4 export depends on browser support for WebCodecs and an available video encoder. Test it in a recent Chromium browser. This handoff has been checked for source completeness, but browser compatibility has not been retested for this handoff.

## English localization

Both tools in this repository are localized into English, including visible labels, accessibility labels, page metadata, dynamic help text, notifications and export status messages. Internal selectors and control values are preserved.

This localization is a separate copy. It has not been deployed to the live site.

## Source provenance

This repository contains an English-localized copy of the local project sources associated with https://ascii-dissolve-studio.vercel.app/ in the local deployment record. These sources were imported from the local project; the live deployment could not be compared with this copy during preparation. Repository: https://github.com/VictorOrs/ascii-dissolve-studio.

Environment files, Vercel account metadata and deployment identifiers are intentionally excluded. `SOURCE-SHA256.json` records checksums for the localized source files. No first-party license is assigned by this repository; the included vendor library retains its own license.
