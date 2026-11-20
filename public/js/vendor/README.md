# Vendored QR libraries

These files are loaded on demand by `public/js/qr.js`. They are checked in so the app has **no runtime npm dependencies** and works offline.

| File | Library | Version | License |
| --- | --- | --- | --- |
| `qrcode-generator.js` | [QR Code Generator for JavaScript](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | 1.4.4 | MIT (notice kept in the source header; see `LICENSE-qrcode-generator.txt`) |
| `jsqr.js` | [jsQR](https://github.com/cozmo/jsQR) by Cosmo Wolfe and Jefff Nelson | 1.4.0 | Apache-2.0 (see `LICENSE-jsqr.txt`) |

The QR codes encode a member code such as `GB-0001`. The scanner reads that text locally in the browser; no images or member data leave the device.
