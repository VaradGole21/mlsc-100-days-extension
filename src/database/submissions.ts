import Dexie from "dexie";
import { db } from "./db";
import type { SubmissionRecord, DailyStatsRecord } from "./db";

function getDateKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayRange(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(year, month - 1, day).getTime();
  const end = new Date(year, month - 1, day + 1).getTime() - 1;
  return { start, end };
}

export async function saveSubmissions(
  records: SubmissionRecord[]
): Promise<{ inserted: number; duplicates: number }> {
  let inserted = 0;
  let duplicates = 0;

  const affectedDates = new Map<string, Set<string>>();

  await db.transaction(
    "rw",
    db.submissions,
    db.dailyStats,
    async () => {
      for (const record of records) {
        const existing = await db.submissions.get(record.id);

        if (existing) {
          duplicates++;
          continue;
        }

        await db.submissions.add({
          ...record,
          syncedToCloud: false,
          createdAtMs: Date.now(),
        });

        inserted++;

        const dateKey = getDateKey(record.timestampMs);
        if (!affectedDates.has(record.username)) {
          affectedDates.set(record.username, new Set());
        }
        affectedDates.get(record.username)!.add(dateKey);
      }

      for (const [username, dates] of affectedDates) {
        for (const dateKey of dates) {
          await recalculateDailyStats(username, dateKey);
        }
      }
    }
  );

  return { inserted, duplicates };
}

async function recalculateDailyStats(username: string, date: string) {
  const { start, end } = getDayRange(date);

  const records = await db.submissions
    .where("[username+timestampMs]")
    .between([username, start], [username, end], true, true)
    .toArray();

  const stats: DailyStatsRecord = {
    dateKey: `${username}:${date}`,
    totalSubmissions: records.length,
    acceptedSubmissions: records.filter(
      (record) => record.status.toLowerCase() === "accepted"
    ).length,
    uniqueProblems: new Set(records.map((record) => record.problemSlug)).size,
    updatedAtMs: Date.now(),
  };

  await db.dailyStats.put(stats);
}

export async function getRecentSubmissions(username: string, limit = 50) {
  return db.submissions
    .where("[username+timestampMs]")
    .between([username, Number.MIN_SAFE_INTEGER], [username, Number.MAX_SAFE_INTEGER])
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getProblemSubmissions(
  username: string,
  problemSlug: string
) {
  const records = await db.submissions
    .where("problemSlug")
    .equals(problemSlug)
    .filter((record) => record.username === username)
    .toArray();

  return records.sort((a, b) => b.timestampMs - a.timestampMs);
}

export async function getUnsyncedSubmissions(username: string) {
  return db.submissions
    .where("[username+timestampMs]")
    .between([username, Number.MIN_SAFE_INTEGER], [username, Number.MAX_SAFE_INTEGER])
    .filter((record) => !record.syncedToCloud)
    .toArray();
}

export async function markSubmissionsSynced(ids: string[]) {
  await db.transaction("rw", db.submissions, async () => {
    for (const id of ids) {
      const record = await db.submissions.get(id);
      if (record) {
        await db.submissions.update(id, { syncedToCloud: true });
      }
    }
  });
}

export async function getDailyActivity(username: string) {
  return db.dailyStats
    .where("dateKey")
    .startsWith(`${username}:`)
    .sortBy("dateKey");
}

export async function getSubmissionStatistics(username: string) {
  const records = await db.submissions
    .where("username")
    .equals(username)
    .toArray();

  const accepted = records.filter(
    (record) => record.status.toLowerCase() === "accepted"
  ).length;

  return {
    totalSubmissions: records.length,
    acceptedSubmissions: accepted,
    rejectedSubmissions: records.length - accepted,
    uniqueProblems: new Set(records.map((record) => record.problemSlug)).size,
    acceptanceRate: records.length
      ? Math.round((accepted / records.length) * 100)
      : 0,
  };
}



export async function getAllSubmissions(username: string) {
  return db.submissions
    .where("username")
    .equals(username)
    .toArray()
    .then(records => records.sort((a, b) => b.timestampMs - a.timestampMs));
}
