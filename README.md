# Code Scan PWA

A simple Progressive Web App to scan numbers (like USSD codes or phone numbers) using your device's camera, crop the relevant area, and attempt to auto-dial.

**Live Demo:** [https://codescan.deno.dev/](https://codescan.deno.dev/)

**Note:**

The auto dial features uses `tel:` protcol, this works on android with firefox but not with chorme.

## Features

*   Scan numbers via device camera (`getUserMedia`).
*   Capture photo from video stream.
*   Crop captured image for accuracy using `Cropper.js`.
*   In-browser OCR with `Tesseract.js`.
*   Extracts number sequences (digits, `*`, `#`).
*   Attempts auto-dial using `tel:` URI.
*   Basic PWA features (manifest, service worker for offline cache).
*   Retake photo option.

## Tech Stack

*   HTML, CSS, JavaScript
*   WebRTC (`getUserMedia`)
*   Tesseract.js (OCR)
*   Cropper.js (Image Cropping)
*   PWA (Manifest, Service Worker)
*   Deno (for dev server)
*   Deno Deploy (Hosting)

## Running Locally

1.  **Prerequisites:** [Deno](https://deno.com/) installed.
2.  **Clone:** `git clone <your-repository-url>`
3.  **Navigate:** `cd codescan`
4.  **Run Server:** `deno run --allow-net --allow-read src/server.ts`
5.  **Access:** Open `http://localhost:8000` in your browser.
