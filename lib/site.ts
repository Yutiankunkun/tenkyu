export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenkyu.app";

// Removal / correction requests from streamers (Tian pastes a Tally form URL here). Until then
// the check page falls back to a GitHub issue template (the repo is public).
export const REMOVAL_FORM_URL: string | null = null;
export const REMOVAL_ISSUE_URL = "https://github.com/Yutiankunkun/tenkyu/issues/new?template=removal-request.yml";

// Drawer footer links (Holodex keeps Twitter / Ko-fi / GitHub there; we keep the author's Bilibili and the repo).
export const AUTHOR_BILIBILI_URL = "https://space.bilibili.com/357561447";
export const GITHUB_URL = "https://github.com/Yutiankunkun/tenkyu";
