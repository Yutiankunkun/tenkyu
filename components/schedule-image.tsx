"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishedSchedule, PublishedWeek } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/types";

type Props = { handle: string; displayName: string; themeColor: string; avatarUrl: string };

const W = 1280;
const H = 720;

/** 周报图: draws the streamer's week on a canvas with the page's own CJK font. */
export function ScheduleImage({ handle, displayName, themeColor, avatarUrl }: Props) {
  const [data, setData] = useState<PublishedSchedule | null>(null);
  const [week, setWeek] = useState(0);
  const [png, setPng] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch(`/data/${handle}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: PublishedSchedule) => setData(d))
      .catch(() => setError("日程数据加载失败"));
  }, [handle]);

  async function render() {
    if (!data || !canvasRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const url = await drawWeek(canvasRef.current, {
        week: data.weeks[week],
        displayName,
        themeColor,
        avatarUrl,
        handle,
        subtitle: week === 0 ? "本周直播" : "下周直播",
      });
      setPng(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-line text-sm">
          {(["本周", "下周"] as const).map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setWeek(i);
                setPng(null);
              }}
              className={`px-3 py-1.5 ${week === i ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={render}
          disabled={!data || busy}
          className="rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "生成中…" : "生成周报图"}
        </button>
        {png ? (
          <a
            href={png}
            download={`${handle}-${data?.weeks[week]?.week_start ?? "week"}.png`}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-fg/5"
          >
            下载 PNG
          </a>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <canvas ref={canvasRef} width={W} height={H} className="hidden" />
      {png ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png} alt="周报图预览" className="w-full rounded-lg border border-line" />
      ) : (
        <p className="text-sm text-muted">生成后可直接保存发到动态。手机上长按图片即可保存。1280×720，北京时间。</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// drawing
// ---------------------------------------------------------------------------
type DrawInput = {
  week: PublishedWeek;
  displayName: string;
  themeColor: string;
  avatarUrl: string;
  handle: string;
  subtitle: string;
};

function pageFontFamily(): string {
  const fam = getComputedStyle(document.body).fontFamily;
  return fam || "sans-serif";
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [91, 141, 239];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function md(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

async function drawWeek(canvas: HTMLCanvasElement, input: DrawInput): Promise<string> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 canvas");
  const font = pageFontFamily();
  const F = (weight: number, size: number) => `${weight} ${size}px ${font}`;
  // Make sure the CJK face is loaded for the weights we use (no-op if already cached).
  await Promise.all([document.fonts.load(F(700, 48)), document.fonts.load(F(500, 28)), document.fonts.load(F(400, 22))]);

  const { week, displayName, themeColor, handle, subtitle } = input;
  const avatar = input.avatarUrl ? await loadImage(`/api/img?u=${encodeURIComponent(input.avatarUrl)}`) : null;

  // background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = rgba(themeColor, 0.12);
  ctx.fillRect(0, 0, W, H);
  // soft blobs
  ctx.fillStyle = rgba(themeColor, 0.14);
  ctx.beginPath();
  ctx.arc(1180, 80, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(120, 680, 180, 0, Math.PI * 2);
  ctx.fill();

  // panel
  const P = { x: 48, y: 48, w: W - 96, h: H - 96, r: 28 };
  ctx.shadowColor = "rgba(0,0,0,0.08)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, P.x, P.y, P.w, P.h, P.r);
  ctx.fill();
  ctx.shadowColor = "transparent";

  // header
  const hx = P.x + 40;
  const hy = P.y + 40;
  const A = 96;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx + A / 2, hy + A / 2, A / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, hx, hy, A, A);
  } else {
    ctx.fillStyle = rgba(themeColor, 0.2);
    ctx.fillRect(hx, hy, A, A);
    ctx.fillStyle = themeColor;
    ctx.font = F(700, 44);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayName.slice(0, 1), hx + A / 2, hy + A / 2 + 2);
  }
  ctx.restore();
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(hx + A / 2, hy + A / 2, A / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#171717";
  ctx.font = F(700, 48);
  ctx.fillText(displayName, hx + A + 28, hy + 50);
  ctx.fillStyle = themeColor;
  ctx.font = F(500, 24);
  ctx.fillText(`${subtitle} · Weekly Schedule`, hx + A + 28, hy + 88);

  ctx.textAlign = "right";
  ctx.fillStyle = "#6b7280";
  ctx.font = F(500, 26);
  ctx.fillText(`${md(week.week_start)} – ${md(week.days[6].date)}`, P.x + P.w - 40, hy + 50);
  ctx.font = F(400, 20);
  ctx.fillText("北京时间", P.x + P.w - 40, hy + 84);

  // cards: 4 + 3
  const gx = P.x + 40;
  const gy = hy + A + 44;
  const gap = 20;
  const cw = (P.w - 80 - gap * 3) / 4;
  const ch = (P.y + P.h - 40 - 56 - gy - gap) / 2;
  week.days.forEach((d, i) => {
    const row = i < 4 ? 0 : 1;
    const col = i < 4 ? i : i - 4;
    const rowCount = row === 0 ? 4 : 3;
    const rowW = rowCount * cw + (rowCount - 1) * gap;
    const offset = (P.w - 80 - rowW) / 2;
    const x = gx + offset + col * (cw + gap);
    const y = gy + row * (ch + gap);

    ctx.fillStyle = d.off ? "#f5f5f5" : rgba(themeColor, 0.08);
    roundRect(ctx, x, y, cw, ch, 18);
    ctx.fill();
    ctx.strokeStyle = d.off ? "#e5e7eb" : rgba(themeColor, 0.35);
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, cw, ch, 18);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#171717";
    ctx.font = F(700, 30);
    ctx.fillText(WEEKDAY_LABELS[d.weekday], x + 22, y + 46);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9ca3af";
    ctx.font = F(400, 20);
    ctx.fillText(md(d.date), x + cw - 22, y + 44);

    ctx.textAlign = "left";
    if (d.off) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = F(500, 28);
      ctx.fillText("定休", x + 22, y + 100);
    } else {
      const shown = d.slots.slice(0, 2);
      shown.forEach((s, j) => {
        const ly = y + 92 + j * 54;
        ctx.fillStyle = themeColor;
        ctx.font = F(700, 26);
        ctx.fillText(`${s.start}–${s.end}`, x + 22, ly);
        ctx.fillStyle = "#374151";
        ctx.font = F(500, 22);
        ctx.fillText(s.type, x + 22, ly + 28);
      });
      if (d.slots.length > 2) {
        ctx.fillStyle = "#9ca3af";
        ctx.font = F(400, 20);
        ctx.fillText(`+${d.slots.length - 2}`, x + 22, y + ch - 18);
      }
    }
  });

  // footer
  ctx.textAlign = "left";
  ctx.fillStyle = "#6b7280";
  ctx.font = F(500, 22);
  ctx.fillText(`tenkyu.app/${handle}`, P.x + 40, P.y + P.h - 26);
  ctx.textAlign = "right";
  ctx.font = F(400, 20);
  ctx.fillText("完整日程与临时变动以此页为准", P.x + P.w - 40, P.y + P.h - 26);

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("导出失败：图片可能被跨域头像污染"));
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}
