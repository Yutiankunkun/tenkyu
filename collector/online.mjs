// Online-count collector. Runs as its own self-chaining loop on GitHub Actions
// (.github/workflows/online.yml), independent of the sweep, because it is one request per
// live room: ~450 rooms at night, ~3 500 at the evening peak, at 0.15 s spacing.
//
// For every gated live room it reads getOnlineGoldRank.onlineNum (logged-in viewers, the
// figure Bilibili shows above the room's contribution rank) and writes it through the
// set_online_counts RPC (migration 0008). Rooms with the oldest data go first, so a run that
// hits the time budget simply leaves the freshest rooms for the next run.
//
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY. Exit 1 on Bilibili risk control so GitHub emails
// the owner; exit 0 otherwise (a missing RPC is logged and skipped).

const SUPABASE_URL = need("SUPABASE_URL").replace(/\/$/, "");
const KEY = need("SUPABASE_SECRET_KEY");

const UA = { "User-Agent": "Mozilla/5.0" };
const SPACING_MS = 150; // 2 024/2 025 rooms answered at this spacing on 2026-09-22 without risk control
const BATCH = 100; // rows per set_online_counts call
const STALE_MIN = 20; // same freshness rule as the board
const LEVEL_GATE = 3;
const RUN_BUDGET_MS = 9 * 60 * 1000; // workflow timeout is 12 min
const startedAt = Date.now();
const overBudget = () => Date.now() - startedAt > RUN_BUDGET_MS;

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env ${name}`);
    process.exit(2);
  }
  return v;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`supabase ${method} ${path.split("?")[0]} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** onlineNum for one room, or null on any non-success. Sets `riskControl` on -352 / -412 / HTTP 412. */
let riskControl = false;
async function fetchOnline(uid, roomId) {
  try {
    const res = await fetch(
      `https://api.live.bilibili.com/xlive/general-interface/v1/rank/getOnlineGoldRank?ruid=${uid}&roomId=${roomId}&page=1&pageSize=1`,
      { headers: UA, signal: AbortSignal.timeout(10000) },
    );
    if (res.status === 412) {
      riskControl = true;
      return null;
    }
    const j = await res.json();
    if (j.code === -352 || j.code === -412) {
      riskControl = true;
      return null;
    }
    const n = j.code === 0 ? j.data?.onlineNum : undefined;
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

let rpcMissing = false;
async function flush(rows) {
  if (rows.length === 0 || rpcMissing) return 0;
  try {
    return (await rest("rpc/set_online_counts", { method: "POST", body: { rows } })) ?? 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/404|set_online_counts/.test(msg)) {
      rpcMissing = true;
      console.log("set_online_counts unavailable — apply migration 0008; skipping writes this run");
      return 0;
    }
    throw e;
  }
}

// PostgREST caps a response at 1 000 rows regardless of `limit`, so page explicitly: the
// evening peak has ~2 500 gated rooms (first run 2026-09-24 saw exactly 1 000).
const since = new Date(Date.now() - STALE_MIN * 60 * 1000).toISOString();
const PAGE = 1000;
const rooms = [];
for (let offset = 0; ; offset += PAGE) {
  const chunk = await rest(
    `live_now?select=uid,room_id,online_fetched_at,bili_streamer!inner(level,deleted_at)` +
      `&seen_at=gt.${since}&bili_streamer.level=gte.${LEVEL_GATE}&bili_streamer.deleted_at=is.null` +
      `&order=online_fetched_at.asc.nullsfirst,uid.asc&limit=${PAGE}&offset=${offset}`,
  );
  rooms.push(...chunk);
  if (chunk.length < PAGE) break;
}

let visited = 0;
let written = 0;
let pending = [];
for (const r of rooms) {
  if (overBudget() || riskControl) break;
  const n = await fetchOnline(r.uid, r.room_id);
  visited++;
  if (n !== null) pending.push({ uid: r.uid, online_count: n });
  if (pending.length >= BATCH) {
    written += await flush(pending);
    pending = [];
  }
  await sleep(SPACING_MS);
}
written += await flush(pending);

console.log(
  `online: ${rooms.length} gated live rooms, visited ${visited}, written ${written}, ` +
    `risk_control=${riskControl}, rpc_missing=${rpcMissing}, ${Math.round((Date.now() - startedAt) / 1000)}s`,
);
if (riskControl) {
  console.error("Bilibili risk control — failing the run so GitHub Actions sends a notification");
  process.exit(1);
}
