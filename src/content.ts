type ContentSubmission = {
  submission_id: string;
  problem_title: string;
  problem_slug: string;
  status: string;
  language?: string;
  timestamp: number;
  runtime?: string;
  memory?: string;
};

function getUsernameFromPage(): string | null {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/u/"], a[href^="/profile/"]'));
  for (const a of links) {
    const match = a.getAttribute("href")?.match(/^\/(?:u|profile)\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  const scripts = Array.from(document.scripts).map(s => s.textContent || "").join("\n");
  const match = scripts.match(/"username"\s*:\s*"([^"]+)"/);
  return match?.[1] || null;
}

async function fetchSubmissionPage(offset: number, limit: number): Promise<any> {
  const url = `https://leetcode.com/api/submissions/?offset=${offset}&limit=${limit}`;
  const response = await fetch(url, { credentials: "include", headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error(`LeetCode returned HTTP ${response.status}`);
  const data = await response.json();
  if (!data || (!Array.isArray(data.submissions_dump) && !Array.isArray(data.submissions))) {
    throw new Error("Unexpected LeetCode response format. History was not marked complete.");
  }
  return data;
}


function normalize(raw: any): ContentSubmission | null {
  const id = raw?.id ?? raw?.submissionId;

  const title =
    raw?.title ??
    raw?.question?.title ??
    raw?.titleSlug;

  // LeetCode's legacy endpoint uses title_slug.
  const slug =
    raw?.title_slug ??
    raw?.titleSlug ??
    raw?.question?.titleSlug;

  const ts = Number(
    raw?.timestamp ?? raw?.submitTime ?? 0
  );

  if (id == null || !slug || !ts) return null;

  const statusRaw = String(
    raw?.status_display ??
    raw?.statusDisplay ??
    raw?.status ??
    "Unknown"
  );

  return {
    submission_id: String(id),
    problem_title: String(title || slug),
    problem_slug: String(slug),
    status: statusRaw,
    language:
      raw?.lang_name ??
      raw?.lang ??
      raw?.language ??
      undefined,
    timestamp: ts,
    runtime: raw?.runtime ?? undefined,
    memory: raw?.memory ?? undefined
  };
}


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MLSC_GET_PROFILE") return;
  const username = getUsernameFromPage();
  sendResponse({ ok: true, username, url: location.href });
  return true;
});


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MLSC_SYNC") return;

  (async () => {
    const username = getUsernameFromPage();

    if (!username) {
      throw new Error(
        "Could not detect the logged-in username. Open your LeetCode profile page while signed in."
      );
    }

    const all: ContentSubmission[] = [];
    const stopAtId = message.stopAtSubmissionId
      ? String(message.stopAtSubmissionId)
      : null;

    const maxPages = Math.max(1, Math.min(Number(message.maxPages || 5), 25));
    const startPage = Math.max(0, Number(message.startPage || 0));

    let reachedCheckpoint = false;
    let hasMore = true;
    let pagesFetched = 0;

    for (let page = startPage; page < startPage + maxPages; page++) {
      const raw = await fetchSubmissionPage(page * 20, 20);
      pagesFetched++;

      const items = Array.isArray(raw?.submissions_dump)
        ? raw.submissions_dump
        : Array.isArray(raw?.submissions)
          ? raw.submissions
          : [];

      for (const item of items) {
        const submission = normalize(item);

        if (!submission) continue;

        if (stopAtId && submission.submission_id === stopAtId) {
          reachedCheckpoint = true;
          break;
        }

        all.push(submission);
      }

      const hasNext = typeof raw.has_next === "boolean"
        ? raw.has_next
        : items.length === 20;

      if (reachedCheckpoint || !hasNext) {
        hasMore = false;
        break;
      }

      if (items.length === 0) {
        throw new Error("LeetCode reported more history but returned an empty page. Sync paused safely.");
      }

      if (page < startPage + maxPages - 1) {
        await new Promise(resolve => setTimeout(resolve, 900));
      }
    }

    sendResponse({
      ok: true,
      username,
      submissions: all,
      count: all.length,
      reachedCheckpoint,
      pagesFetched,
      nextPage: startPage + pagesFetched,
      hasMore
    });
  })().catch(error =>
    sendResponse({
      ok: false,
      error: error?.message || "Sync failed"
    })
  );

  return true;
});
