import { importLeetCodeSubmissions } from "./database/import";

const ALARM_NAME = "mlsc-auto-sync";

const SYNC_INTERVAL_MINUTES = 5;

let syncing = false;

async function setupAlarm() {
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void setupAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  void setupAlarm();
});

void setupAlarm();

async function automaticSync() {
  if (syncing) return;
  syncing = true;

  try {
    const stored = await chrome.storage.local.get(["syncCheckpoints", "autoSyncEnabled"]);
    if (stored.autoSyncEnabled === false) return;
    const checkpoints = stored.syncCheckpoints || {};

    const tabs = await chrome.tabs.query({
      url: "https://leetcode.com/*",
    });

    if (tabs.length === 0 || !tabs[0].id) return;

    const tabId = tabs[0].id;

    const profile: any = await chrome.tabs.sendMessage(tabId, {
      type: "MLSC_GET_PROFILE",
    });

    if (!profile?.username) return;

    const username = profile.username;
    const lastId = checkpoints[username] || null;

    const result: any = await chrome.tabs.sendMessage(tabId, {
      type: "MLSC_SYNC",
      maxPages: 5,
      stopAtSubmissionId: lastId,
    });

    if (!result?.ok) {
      throw new Error(result?.error || "LeetCode sync failed");
    }

    if (!result.submissions?.length) return;

    const saved = await importLeetCodeSubmissions(
      username,
      result.submissions
    );

    checkpoints[username] = result.submissions[0].submission_id;

    await chrome.storage.local.set({
      syncCheckpoints: checkpoints,
      username,
    });

    console.log(
      `[MLSC] Automatic local sync complete: ${username}, ${saved.inserted} new submissions`
    );
  } catch (error) {
    console.error("[MLSC] Automatic sync failed:", error);
  } finally {
    syncing = false;
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void automaticSync();
  }
});
