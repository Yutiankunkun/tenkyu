// 观星台 collector. Runs every ~10 min on GitHub Actions (see .github/workflows/collector.yml).
// No dependencies: Bilibili public endpoints in, Supabase PostgREST (service role) out.
//
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY, optional REVALIDATE_URL + REVALIDATE_SECRET.
// Exit code is 0 unless Supabase itself is unreachable — Bilibili hiccups are logged, not fatal.

const SUPABASE_URL = need("SUPABASE_URL").replace(/\/$/, "");
const KEY = need("SUPABASE_SECRET_KEY");
const REVALIDATE_URL = process.env.REVALIDATE_URL ?? "";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "";

const UA = { "User-Agent": "Mozilla/5.0" };
const SPACING_MS = 550;
const MAX_PAGES = 80;
const BACKFILL = 400; // upper bound per run; the time budget below is what actually stops it
const FANS_REFRESH = 100;
const LEVEL_REFRESH = 40;
const STALE_MIN = 20;
const RUN_BUDGET_MS = 6 * 60 * 1000; // workflow timeout is 8 min; leave headroom for refresh + cleanup
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
const iso = (d) => new Date(d).toISOString();

// ---------------------------------------------------------------- supabase
async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`supabase ${method} ${path.split("?")[0]} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const rpc = (name, args) => rest(`rpc/${name}`, { method: "POST", body: args });

// ---------------------------------------------------------------- bilibili
let riskControl = false;
async function bili(url) {
  if (riskControl) return { code: -1, message: "skipped (risk control earlier in this run)" };
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    const j = await res.json();
    if (j.code === -352 || j.code === -412 || res.status === 412) riskControl = true;
    return j;
  } catch (e) {
    return { code: -2, message: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------- 1. sweep
async function sweep() {
  const rooms = new Map();
  let pages = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const j = await bili(
      `https://api.live.bilibili.com/room/v3/area/getRoomList?platform=web&parent_area_id=9&area_id=0&sort_type=online&page=${page}&page_size=30`,
    );
    if (j.code !== 0) {
      console.log(`sweep: page ${page} code ${j.code} ${j.message ?? ""} — aborting sweep`);
      return { ok: false, rooms, pages };
    }
    const list = j.data?.list ?? [];
    pages = page;
    if (list.length === 0) break;
    for (const r of list) {
      if (!r.uid) continue;
      rooms.set(r.uid, {
        uid: r.uid,
        uname: r.uname ?? "",
        face: r.face ?? "",
        room_id: r.roomid ?? null,
        title: r.title ?? "",
        cover: r.user_cover || r.cover || r.system_cover || "",
        online: Number(r.online ?? 0),
        area: r.area_v2_name ?? r.area_name ?? "",
      });
    }
    await sleep(SPACING_MS);
  }
  return { ok: true, rooms, pages };
}

// ---------------------------------------------------------------- 2. profiles
function deletedFromCard(j) {
  // -404 「啥都木有」 = no such user; a deleted account also shows as name 账号已注销.
  if (j.code === -404) return true;
  const name = j.data?.card?.name ?? "";
  return name === "账号已注销";
}

async function backfill() {
  const uids = await rest(`bili_streamer?select=uid&level=is.null&deleted_at=is.null&order=first_seen_at.desc&limit=${BACKFILL}`);
  let done = 0;
  let deleted = 0;
  for (const { uid } of uids) {
    if (overBudget()) break; // the next run continues where this one stopped
    const card = await bili(`https://api.bilibili.com/x/web-interface/card?mid=${uid}`);
    await sleep(SPACING_MS);
    if (card.code === -1 || card.code === -2) break; // risk control / network: stop this phase
    const patch = { level_fetched_at: iso(Date.now()) };
    if (deletedFromCard(card)) {
      patch.deleted_at = iso(Date.now());
      deleted++;
    } else if (card.code === 0) {
      const c = card.data.card;
      patch.level = c.level_info?.current_level ?? null;
      patch.fans = typeof c.fans === "number" ? c.fans : null;
      patch.fans_fetched_at = iso(Date.now());
      if (c.name) patch.uname = c.name;
      if (c.face) patch.face = c.face;
      const m = await bili(`https://api.live.bilibili.com/live_user/v1/Master/info?uid=${uid}`);
      await sleep(SPACING_MS);
      if (m.code === 0) patch.master_level = m.data?.exp?.master_level?.level ?? null;
    } else {
      continue; // transient; leave level null so a later run retries
    }
    await rest(`bili_streamer?uid=eq.${uid}`, { method: "PATCH", body: patch, prefer: "return=minimal" });
    done++;
  }
  return { done, deleted };
}

async function refreshFans() {
  const since = iso(Date.now() - 24 * 3600 * 1000);
  const uids = await rest(
    `bili_streamer?select=uid&level=not.is.null&deleted_at=is.null&or=(fans_fetched_at.is.null,fans_fetched_at.lt.${since})&order=fans_fetched_at.asc.nullsfirst&limit=${FANS_REFRESH}`,
  );
  let done = 0;
  for (const { uid } of uids) {
    const j = await bili(`https://api.bilibili.com/x/relation/stat?vmid=${uid}`);
    await sleep(SPACING_MS);
    if (j.code === -1 || j.code === -2) break;
    if (j.code !== 0) continue;
    await rest(`bili_streamer?uid=eq.${uid}`, {
      method: "PATCH",
      body: { fans: j.data?.follower ?? null, fans_fetched_at: iso(Date.now()) },
      prefer: "return=minimal",
    });
    done++;
  }
  return done;
}

async function refreshLevels() {
  const since = iso(Date.now() - 7 * 24 * 3600 * 1000);
  const uids = await rest(
    `bili_streamer?select=uid&level=not.is.null&deleted_at=is.null&level_fetched_at=lt.${since}&order=level_fetched_at.asc&limit=${LEVEL_REFRESH}`,
  );
  let done = 0;
  let deleted = 0;
  for (const { uid } of uids) {
    const card = await bili(`https://api.bilibili.com/x/web-interface/card?mid=${uid}`);
    await sleep(SPACING_MS);
    if (card.code === -1 || card.code === -2) break;
    const patch = { level_fetched_at: iso(Date.now()) };
    if (deletedFromCard(card)) {
      patch.deleted_at = iso(Date.now());
      deleted++;
    } else if (card.code === 0) {
      const c = card.data.card;
      patch.level = c.level_info?.current_level ?? null;
      if (typeof c.fans === "number") {
        patch.fans = c.fans;
        patch.fans_fetched_at = iso(Date.now());
      }
      if (c.name) patch.uname = c.name;
      if (c.face) patch.face = c.face;
    } else {
      continue;
    }
    await rest(`bili_streamer?uid=eq.${uid}`, { method: "PATCH", body: patch, prefer: "return=minimal" });
    done++;
  }
  return { done, deleted };
}

// ---------------------------------------------------------------- 3. claimed cleanup
async function hideDeletedClaimed() {
  const gone = await rest(`bili_streamer?select=uid&deleted_at=not.is.null`);
  if (!gone.length) return 0;
  const list = gone.map((g) => g.uid).join(",");
  const changed = await rest(`streamer?bili_uid=in.(${list})&status=neq.hidden`, {
    method: "PATCH",
    body: { status: "hidden" },
    prefer: "return=representation",
  });
  const n = Array.isArray(changed) ? changed.length : 0;
  if (n > 0 && REVALIDATE_URL && REVALIDATE_SECRET) {
    for (const tag of ["streamers", ...changed.map((c) => `schedule:${c.handle}`)]) {
      await fetch(`${REVALIDATE_URL}?tag=${encodeURIComponent(tag)}`, {
        method: "POST",
        headers: { "x-secret": REVALIDATE_SECRET },
        signal: AbortSignal.timeout(15000),
      }).catch(() => {});
    }
  }
  return n;
}

// ---------------------------------------------------------------- main
const t0 = Date.now();
const s = await sweep();
let upserted = 0;
let removed = 0;
if (s.ok && s.rooms.size > 0) {
  const rows = [...s.rooms.values()];
  await rpc("upsert_bili_streamers", { rows: rows.map(({ uid, uname, face, room_id }) => ({ uid, uname, face, room_id })) });
  upserted = await rpc("upsert_live_now", { rows: rows.map(({ uid, room_id, title, cover, online, area }) => ({ uid, room_id, title, cover, online, area })) });
  const stale = await rest(`live_now?seen_at=lt.${iso(Date.now() - STALE_MIN * 60 * 1000)}`, {
    method: "DELETE",
    prefer: "return=representation",
  });
  removed = Array.isArray(stale) ? stale.length : 0;
}
const b = await backfill();
const f = await refreshFans();
const l = await refreshLevels();
const hidden = await hideDeletedClaimed();

console.log(
  `sweep ${s.ok ? "ok" : "FAILED"}: ${s.rooms.size} live rooms in ${s.pages} pages; live_now +${upserted} -${removed}; ` +
    `backfill ${b.done} (deleted ${b.deleted}); fans refreshed ${f}; levels refreshed ${l.done} (deleted ${l.deleted}); ` +
    `claimed hidden ${hidden}; risk_control=${riskControl}; ${Math.round((Date.now() - t0) / 1000)}s`,
);
