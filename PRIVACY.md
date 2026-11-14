# Privacy Policy – MLSC HDOLC

**Last updated:** November 14, 2026

## 1. Introduction

MLSC HDOLC is an independent browser extension designed to help users track their LeetCode submissions, analyze coding activity, and monitor progress through a 100-day coding challenge.

We respect user privacy. This policy explains what information the extension accesses, how it is stored, and how it is used.

## 2. Information Accessed

When you use MLSC HDOLC, the extension may access the following information from your LeetCode account:

- LeetCode username.
- Submission IDs and problem titles.
- Problem slugs and submission verdicts.
- Submission timestamps.
- Programming languages used.
- Runtime and memory information, when available.

The extension also stores information you enter or configure, including:

- Daily challenge completion status.
- Problem links or slugs.
- Personal notes.
- Theme and automatic synchronization preferences.
- Synchronization checkpoints.

## 3. How Information Is Used

The information accessed by the extension is used exclusively to provide its features:

- Display submission history and coding statistics.
- Calculate submission activity and solving consistency.
- Track progress through the 100-day challenge.
- Synchronize recent LeetCode submissions.
- Remember user preferences and synchronization progress.

## 4. Data Storage and Sharing

MLSC HDOLC follows a local-first storage approach.

Submission records and challenge progress are stored locally in your browser using IndexedDB. Extension settings and synchronization checkpoints are stored using Chrome-compatible local extension storage.

**MLSC HDOLC does not currently transmit your submission records, challenge progress, or personal notes to an MLSC server or any developer-controlled backend.**

The extension makes requests to LeetCode to retrieve submission information using your existing authenticated browser session.

We do not sell, rent, or share user information with advertisers or third-party analytics services.

## 5. Account Credentials and Authentication

MLSC HDOLC does not request or store your LeetCode password.

The extension uses the browser's existing authenticated LeetCode session to retrieve submission information. It does not directly read or extract browser cookies.

## 6. Third-Party Services

MLSC HDOLC interacts with LeetCode (https://leetcode.com/) to retrieve submission information.

LeetCode is an independent third-party service governed by its own privacy policy and terms of service. MLSC HDOLC is not affiliated with, endorsed by, or officially associated with LeetCode.

## 7. Data Retention and Deletion

Information remains in your browser's local extension storage until it is deleted.

You can remove locally stored extension data by uninstalling the extension or clearing its associated browser extension data.

MLSC HDOLC does not currently maintain a centralized database of user submissions or challenge progress.

## 8. Permissions

The extension requests the following permissions:

- **Storage:** To save extension settings and synchronization information locally.
- **Active Tab:** To interact with the active LeetCode tab when you use account detection or synchronization.
- **Alarms:** To schedule automatic submission checks when enabled.
- **LeetCode Host Access:** To retrieve submission information from LeetCode.

These permissions are used to provide the functionality described in this policy.

## 9. Changes to This Policy

This privacy policy may be updated when the extension's features or data practices change. Updates will be published in the project's GitHub repository.

## 10. Contact

For privacy-related questions, concerns, or requests, please contact the project maintainers through the GitHub repository:

https://github.com/VaradGole21/mlsc-100-days-extension

---

MLSC HDOLC is an independent community project. It is not affiliated with or endorsed by LeetCode.