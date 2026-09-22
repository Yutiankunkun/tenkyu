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
const MAX_PAGES = 160; // evening peak filled all 120 pages (3582 rooms) on 2026-09-22
const BACKFILL = 400; // upper bound per run; the time budget below is what actually stops it
const FANS_REFRESH = 100;
const LEVEL_REFRESH = 40;
const STALE_MIN = 20;
const RUN_BUDGET_MS = 4 * 60 * 1000; // backfill stops here; refresh + cleanup follow (~1–2 min); workflow timeout 12 min
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

// ---------------------------------------------------------------- 1b. room details (tags, keyframe, real start)
const DETAIL_BATCH = 80; // endpoint verified with 90 uids per request

/** "2026-09-21 20:00:05" (Asia/Shanghai) → ISO instant; Bilibili sends "0000-00-00 00:00:00" or 0 when unknown. */
function liveTimeToIso(v) {
  if (typeof v === "number") return v > 0 ? new Date(v * 1000).toISOString() : null;
  const m = typeof v === "string" && /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v);
  if (!m || m[1] === "0000") return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s) - 8 * 3600 * 1000).toISOString();
}

async function fetchDetails(uids) {
  const out = [];
  let requests = 0;
  for (let i = 0; i < uids.length; i += DETAIL_BATCH) {
    if (overBudget()) break;
    const chunk = uids.slice(i, i + DETAIL_BATCH);
    const body = new URLSearchParams();
    for (const u of chunk) body.append("uids[]", String(u));
    let j;
    try {
      const res = await fetch("https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids", {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(15000),
      });
      j = await res.json();
      if (j.code === -352 || j.code === -412) riskControl = true;
    } catch {
      j = { code: -2 };
    }
    requests++;
    if (j.code !== 0) {
      console.log(`details: chunk ${i / DETAIL_BATCH + 1} code ${j.code} ${j.message ?? ""} — stopping details`);
      break;
    }
    const rooms = Array.isArray(j.data) ? j.data : Object.values(j.data ?? {});
    for (const r of rooms) {
      if (!r.uid) continue;
      const tags = String(r.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 20)
        .slice(0, 12);
      out.push({ uid: r.uid, tags, keyframe: r.keyframe || null, started_at: liveTimeToIso(r.live_time) });
    }
    await sleep(SPACING_MS);
  }
  return { rows: out, requests };
}

// ---------------------------------------------------------------- 2. profiles
// Level + fans come from the LIVE host (api.live.bilibili.com), which tolerated 2 000+ calls at
// 0.15 s from a home IP on 2026-09-22, while api.bilibili.com's `card` went -352 after ~330.
//   get_anchor_in_room?roomid=  → info.platform_user_level (= account level; 433/433 agreed
//                                 with card), uname, face. Works for offline rooms. A bad room
//                                 id returns SOME account (room 1 = 哔哩哔哩直播) → verify info.uid.
//   Master/info?uid=            → follower_num (= relation/stat follower, verified), master_level,
//                                 uname, face. Unknown uid → code 0 with uname "".
// `card` stays as the fallback for rows without a room id (or when the anchor uid mismatches).
function deletedFromCard(j) {
  // -404 「啥都木有」 = no such user; a deleted account also shows as name 账号已注销.
  if (j.code === -404) return true;
  const name = j.data?.card?.name ?? "";
  return name === "账号已注销";
}

/**
 * Profile patch for one streamer. Returns null on risk control / network (stop the phase),
 * `{ retry: true }` when nothing usable came back (leave the row for a later run),
 * otherwise `{ patch, deleted }`.
 */
async function fetchProfile(uid, room_id) {
  const patch = { level_fetched_at: iso(Date.now()) };
  let gotLevel = false;
  if (room_id) {
    const a = await bili(`https://api.live.bilibili.com/live_user/v1/UserInfo/get_anchor_in_room?roomid=${room_id}`);
    await sleep(SPACING_MS);
    if (a.code === -1 || a.code === -2) return null;
    const info = a.code === 0 ? a.data?.info : null;
    if (info && Number(info.uid) === Number(uid) && typeof info.platform_user_level === "number") {
      patch.level = info.platform_user_level;
      if (info.uname) patch.uname = info.uname;
      if (info.face) patch.face = info.face;
      gotLevel = true;
    }
  }
  if (!gotLevel) {
    const card = await bili(`https://api.bilibili.com/x/web-interface/card?mid=${uid}`);
    await sleep(SPACING_MS);
    if (card.code === -1 || card.code === -2) return null;
    if (deletedFromCard(card)) {
      patch.deleted_at = iso(Date.now());
      return { patch, deleted: true };
    }
    if (card.code !== 0) return { retry: true };
    const c = card.data.card;
    patch.level = c.level_info?.current_level ?? null;
    if (typeof c.fans === "number") {
      patch.fans = c.fans;
      patch.fans_fetched_at = iso(Date.now());
    }
    if (c.name) patch.uname = c.name;
    if (c.face) patch.face = c.face;
  }
  const m = await bili(`https://api.live.bilibili.com/live_user/v1/Master/info?uid=${uid}`);
  await sleep(SPACING_MS);
  if (m.code === -1 || m.code === -2) return null;
  if (m.code === 0) {
    const d = m.data ?? {};
    if (d.info?.uname === "账号已注销") {
      patch.deleted_at = iso(Date.now());
      return { patch, deleted: true };
    }
    if (typeof d.follower_num === "number" && d.info?.uname) {
      // uname "" means Bilibili knows no such uid; its follower_num 0 is not a measurement.
      patch.fans = d.follower_num;
      patch.fans_fetched_at = iso(Date.now());
    }
    patch.master_level = d.exp?.master_level?.level ?? null;
    if (!patch.uname && d.info?.uname) patch.uname = d.info.uname;
    if (!patch.face && d.info?.face) patch.face = d.info.face;
  }
  return { patch, deleted: false };
}

async function backfill() {
  const rows = await rest(
    `bili_streamer?select=uid,room_id&level=is.null&deleted_at=is.null&order=first_seen_at.desc&limit=${BACKFILL}`,
  );
  let done = 0;
  let deleted = 0;
  for (const { uid, room_id } of rows) {
    if (overBudget()) break; // the next run continues where this one stopped
    const r = await fetchProfile(uid, room_id);
    if (r === null) break; // risk control / network: stop this phase
    if (r.retry) continue; // transient; leave level null so a later run retries
    if (r.deleted) deleted++;
    await rest(`bili_streamer?uid=eq.${uid}`, { method: "PATCH", body: r.patch, prefer: "return=minimal" });
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
  const rows = await rest(
    `bili_streamer?select=uid,room_id&level=not.is.null&deleted_at=is.null&level_fetched_at=lt.${since}&order=level_fetched_at.asc&limit=${LEVEL_REFRESH}`,
  );
  let done = 0;
  let deleted = 0;
  for (const { uid, room_id } of rows) {
    if (overBudget()) break;
    const r = await fetchProfile(uid, room_id);
    if (r === null) break;
    if (r.retry) continue;
    if (r.deleted) deleted++;
    await rest(`bili_streamer?uid=eq.${uid}`, { method: "PATCH", body: r.patch, prefer: "return=minimal" });
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
let detailed = 0;
if (s.ok && s.rooms.size > 0) {
  const rows = [...s.rooms.values()];
  await rpc("upsert_bili_streamers", { rows: rows.map(({ uid, uname, face, room_id }) => ({ uid, uname, face, room_id })) });
  upserted = await rpc("upsert_live_now", { rows: rows.map(({ uid, room_id, title, cover, online, area }) => ({ uid, room_id, title, cover, online, area })) });
  // Tags / keyframe / real start time for every live room (batch endpoint, 30 per request).
  const det = await fetchDetails(rows.map((r) => r.uid));
  if (det.rows.length) {
    try {
      detailed = (await rpc("upsert_live_details", { rows: det.rows })) ?? 0;
    } catch (e) {
      console.log(`upsert_live_details unavailable (${e instanceof Error ? e.message.slice(0, 80) : e}); apply migration 0004`);
    }
  }
  // Rooms not seen for STALE_MIN minutes: archived into live_session, then dropped (one RPC).
  // Until migration 0003 is applied the RPC does not exist → plain delete, no history.
  try {
    removed = (await rpc("close_stale_live", { stale_minutes: STALE_MIN })) ?? 0;
  } catch (e) {
    console.log(`close_stale_live unavailable (${e instanceof Error ? e.message.slice(0, 80) : e}); deleting stale rows without archiving`);
    const stale = await rest(`live_now?seen_at=lt.${iso(Date.now() - STALE_MIN * 60 * 1000)}`, {
      method: "DELETE",
      prefer: "return=representation",
    });
    removed = Array.isArray(stale) ? stale.length : 0;
  }
}
const b = await backfill();
const f = await refreshFans();
const l = await refreshLevels();
const hidden = await hideDeletedClaimed();

console.log(
  `sweep ${s.ok ? "ok" : "FAILED"}: ${s.rooms.size} live rooms in ${s.pages} pages; live_now +${upserted} -${removed}; details ${detailed}; ` +
    `backfill ${b.done} (deleted ${b.deleted}); fans refreshed ${f}; levels refreshed ${l.done} (deleted ${l.deleted}); ` +
    `claimed hidden ${hidden}; risk_control=${riskControl}; ${Math.round((Date.now() - t0) / 1000)}s`,
);

// A failed sweep (Bilibili error / risk control) is worth an email: GitHub notifies the
// repo owner on a failed workflow run. Maintenance phases above still ran.
if (!s.ok || riskControl) {
  console.error("sweep did not complete — failing the run so GitHub Actions sends a notification");
  process.exit(1);
}
