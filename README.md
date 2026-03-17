# Magic Badge

![Badge Magic – LED Badge Designer](repo-image.png)

**Design and send messages to FOSSASIA LED name badges from your browser.** No app required—create animated text, pick from hundreds of pixel-art icons, and preview on a live 11×44 grid before connecting via Web Bluetooth or the Badge Magic app.

## What’s in this repo

- **Web app** (`app.js`, `index.html`) – Design badges in the browser: enter text, choose effects and speed, pick from hundreds of pixel-art icons, and see a live LED-style preview. Uses the **Web Bluetooth API** to connect and send data to compatible LED badges directly from the browser—no native app install required.
- **SVG assets** – Pixel-art icons in `assets/vectors/` are bundled into `svgAssets.js` for the icon picker.
- **badge-magic-android/** – [Badge Magic](https://github.com/fossasia/badgemagic-app) Android (and cross‑platform) app for saving and sending badges to devices over Bluetooth. See that folder’s README for build and run instructions.

## Web Bluetooth

This project uses the [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) to discover and connect to FOSSASIA LED badges from the browser. When you click **Connect & Send**, the page requests a Bluetooth device; after you pick your badge, it sends the current design (text, effects, icon) over BLE. No app store install is required—just open the site over **HTTPS** (or `localhost`) in a [supported browser](https://caniuse.com/web-bluetooth) (e.g. Chrome, Edge, Opera on desktop and Android).

## Quick start (web)

1. Serve the project root over HTTP (e.g. `npx serve .` or any static server). For Web Bluetooth, use HTTPS or `localhost`.
2. Open the page and use the controls to set message, effect, speed, and optional icon.
3. Use the preview to see the result, then click **Connect & Send** to pair with your badge via Web Bluetooth, or export and use the Badge Magic app to send.

## GitHub Pages

You can host the web app on [GitHub Pages](https://pages.github.com/) for free.

1. Push this repo to GitHub.
2. Open the repo **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose your default branch (e.g. `main`) and **/ (root)** as the folder, then Save.
5. After the first deploy, the site will be at `https://<username>.github.io/<repo-name>/`.

A `.nojekyll` file in the root tells GitHub Pages to serve the site as static files (no Jekyll build).

## Regenerating icon assets

Icons in `assets/vectors/*.svg` are compiled into `svgAssets.js`:

```bash
node scripts/generate-svg-assets.js
```

Run this after adding or changing SVGs in `assets/vectors/`.

## Credits

- **Icons**: [Pixelarticons](https://github.com/halfmage/pixelarticons) by halfmage (MIT License).
- **Badge Magic app**: [FOSSASIA Badge Magic](https://github.com/fossasia/badgemagic-app) (Apache License 2.0). The app is based on the work of [Nilhcem](https://github.com/Nilhcem). See `badge-magic-android/README.md` for full credits.

## License

This project (the Magic Badge web app and scripts in this repository) is licensed under the MIT License. See [LICENSE](LICENSE) for the full text.

This project uses and references the following works. Each retains its original license.

| Reference | Repository | License |
|-----------|------------|--------|
| This project (web app, scripts) | — | [MIT](LICENSE) |
| Pixel-art icons (SVGs in `assets/vectors/`, bundled in `svgAssets.js`) | [halfmage/pixelarticons](https://github.com/halfmage/pixelarticons) | [MIT](https://github.com/halfmage/pixelarticons/blob/main/LICENSE) |
| Badge Magic app (in `badge-magic-android/`) | [fossasia/badgemagic-app](https://github.com/fossasia/badgemagic-app) | [Apache-2.0](https://github.com/fossasia/badgemagic-app/blob/main/LICENSE) |

- **Pixelarticons (MIT)**  
  Copyright (c) halfmage. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the condition that the above copyright notice and this permission notice be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.

- **Badge Magic (Apache-2.0)**  
  Copyright FOSSASIA and contributors. Licensed under the Apache License, Version 2.0. See the [project LICENSE](https://github.com/fossasia/badgemagic-app/blob/main/LICENSE) for the full text.
