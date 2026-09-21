// Connectivity probe: can this machine reach Bilibili's endpoints the collector needs?
// Prints one line per endpoint with the API code. Exit 0 always (it is a probe).
const UA = { "User-Agent": "Mozilla/5.0" };

async function probe(name, url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let code = "?";
    let extra = "";
    try {
      const j = JSON.parse(text);
      code = j.code;
      extra = j.message ?? "";
      if (j.data?.count !== undefined) extra += ` count=${j.data.count}`;
      if (j.data?.card?.level_info) extra += ` level=${j.data.card.level_info.current_level}`;
      if (j.data?.exp?.master_level) extra += ` master_level=${j.data.exp.master_level.level}`;
      if (j.data?.follower !== undefined) extra += ` follower=${j.data.follower}`;
    } catch {
      extra = text.slice(0, 80);
    }
    console.log(`${name}: http=${res.status} code=${code} ${extra} (${Date.now() - t0}ms)`);
  } catch (e) {
    console.log(`${name}: ERROR ${e instanceof Error ? e.message : e}`);
  }
}

await probe(
  "area-list",
  "https://api.live.bilibili.com/room/v3/area/getRoomList?platform=web&parent_area_id=9&area_id=0&sort_type=online&page=1&page_size=30",
);
await probe("card", "https://api.bilibili.com/x/web-interface/card?mid=46334350");
await probe("master-info", "https://api.live.bilibili.com/live_user/v1/Master/info?uid=46334350");
await probe("relation-stat", "https://api.bilibili.com/x/relation/stat?vmid=46334350");
