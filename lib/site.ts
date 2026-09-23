export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenkyu.app";

// Tian pastes the Tally application form URL here (vetted onboarding).
export const APPLY_FORM_URL: string | null = null;

// Removal / correction requests from streamers (Tian pastes a Tally form URL here). Until then
// the check page falls back to a GitHub issue template (the repo is public).
export const REMOVAL_FORM_URL: string | null = null;
export const REMOVAL_ISSUE_URL = "https://github.com/Yutiankunkun/tenkyu/issues/new?template=removal-request.yml";
