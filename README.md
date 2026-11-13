# MLSC 100 Days - LeetCode Companion

A local-first Chrome extension for tracking LeetCode submissions and 100-day challenge progress.

## Features
- Control Center: account detection, manual and automatic sync, themes.
- Records: submission history, activity and solving statistics.
- 100 Days: daily progress, problem links and notes.
- Local IndexedDB storage.
- Resumable full-history sync.

## Installation
1. Install Node.js.
2. Clone this repository.
3. Run `npm install`.
4. Run `npm run build`.
5. Open `chrome://extensions` and enable Developer mode.
6. Click **Load unpacked** and select the generated `dist/` folder.
7. Sign in to LeetCode and open the extension.

## Limitations
- Uses LeetCode's legacy submissions API; compatibility may change.
- Challenge progress is currently local and manually tracked.
- Official MLSC website, API and central database integration are pending.
- Data does not sync across devices.

## Privacy
Submission data is stored locally. The extension uses the browser's existing session to request data from LeetCode and does not ask for your password.

## Build
`npm install && npm run build`

## Disclaimer
Independent community project. Not affiliated with or endorsed by LeetCode.
