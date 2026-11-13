import { db } from "./db";
import type { SubmissionRecord } from "./db";
import { saveSubmissions } from "./submissions";

export interface LeetCodeSubmission {
  submission_id: string;
  problem_title: string;
  problem_slug: string;
  status: string;
  language?: string;
  timestamp: number;
  runtime?: string;
  memory?: string;
}

export async function importLeetCodeSubmissions(
  username: string,
  submissions: LeetCodeSubmission[]
) {
  const now = Date.now();
  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    throw new Error("LeetCode username is missing.");
  }

  await db.profiles.put({
    id: normalizedUsername.toLowerCase(),
    leetcodeUsername: normalizedUsername,
    createdAtMs: now,
    updatedAtMs: now,
  });

  const records: SubmissionRecord[] = submissions.map((submission) => {
    const timestamp = Number(submission.timestamp);

    if (!submission.submission_id || !submission.problem_slug || !timestamp) {
      throw new Error("A submission is missing its ID, problem slug, or timestamp.");
    }

    return {
      id: `${normalizedUsername.toLowerCase()}:${submission.submission_id}`,
      username: normalizedUsername,
      problemSlug: submission.problem_slug,
      problemTitle: submission.problem_title || submission.problem_slug,
      status: submission.status || "Unknown",
      language: submission.language,
      timestampMs: timestamp < 1_000_000_000_000
        ? timestamp * 1000
        : timestamp,
      runtime: submission.runtime,
      memory: submission.memory,
      syncedToCloud: false,
      createdAtMs: now,
    };
  });

  const result = await saveSubmissions(records);

  return {
    username: normalizedUsername,
    fetched: submissions.length,
    inserted: result.inserted,
    duplicates: result.duplicates,
  };
}
