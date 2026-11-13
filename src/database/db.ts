import Dexie, { type Table } from "dexie";

export interface ProfileRecord {
  id: string;
  leetcodeUsername: string;
  displayName?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SubmissionRecord {
  id: string;
  username: string;
  problemSlug: string;
  problemTitle: string;
  status: string;
  language?: string;
  timestampMs: number;
  runtime?: string;
  memory?: string;
  syncedToCloud: boolean;
  createdAtMs: number;
}

export interface ProblemRecord {
  slug: string;
  title: string;
  difficulty?: string;
  topics: string[];
  url: string;
  updatedAtMs: number;
}

export interface ChallengeDayRecord {
  dayNumber: number;
  problemSlug: string;
  unlockDate?: string;
  solutionUnlocked: boolean;
}

export interface ProgressRecord {
  dayNumber: number;
  status: "locked" | "unlocked" | "attempted" | "completed";
  attempts: number;
  completedAtMs?: number;
  problemSlug?: string;
  notes?: string;
  updatedAtMs: number;
}

export interface DailyStatsRecord {
  dateKey: string;
  totalSubmissions: number;
  acceptedSubmissions: number;
  uniqueProblems: number;
  updatedAtMs: number;
}

export interface SyncStateRecord {
  key: string;
  username?: string;
  lastSubmissionId?: string;
  lastSyncAtMs?: number;
  status: "idle" | "syncing" | "success" | "error";
  error?: string;
}

export interface SettingRecord {
  key: string;
  value: unknown;
  updatedAtMs: number;
}

class MLSCDatabase extends Dexie {
  profiles!: Table<ProfileRecord, string>;
  submissions!: Table<SubmissionRecord, string>;
  problems!: Table<ProblemRecord, string>;
  challengeDays!: Table<ChallengeDayRecord, number>;
  progress!: Table<ProgressRecord, number>;
  dailyStats!: Table<DailyStatsRecord, string>;
  syncState!: Table<SyncStateRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("mlsc-local");

    this.version(1).stores({
      profiles: "id, leetcodeUsername",
      submissions: "&id, problemSlug, status, timestampMs, language, [problemSlug+timestampMs], [status+timestampMs]",
      problems: "slug, difficulty",
      challengeDays: "dayNumber, problemSlug",
      progress: "dayNumber, status",
      dailyStats: "dateKey",
      syncState: "key, username",
      settings: "key"
    });

    this.version(2).stores({
      profiles: "id, leetcodeUsername",
      submissions: "&id, username, problemSlug, status, timestampMs, language, [username+timestampMs], [problemSlug+timestampMs], [status+timestampMs]",
      problems: "slug, difficulty",
      challengeDays: "dayNumber, problemSlug",
      progress: "dayNumber, status",
      dailyStats: "dateKey",
      syncState: "key, username",
      settings: "key"
    });
  }
}

export const db = new MLSCDatabase();

export async function getDatabaseCounts() {
  const [profiles, submissions, problems, challengeDays, progress] =
    await Promise.all([
      db.profiles.count(),
      db.submissions.count(),
      db.problems.count(),
      db.challengeDays.count(),
      db.progress.count()
    ]);

  return { profiles, submissions, problems, challengeDays, progress };
}
