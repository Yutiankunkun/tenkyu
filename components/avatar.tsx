type Props = { src: string; name: string; color?: string; size?: number };

// Plain <img>: avatars live on Bilibili's CDN, which 403s foreign referers, so we send none.
export function Avatar({ src, name, color, size = 48 }: Props) {
  const style = { width: size, height: size, borderColor: color };
  const border = color ? "border-2" : "";
  if (!src) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-full bg-surface text-muted ${border}`} style={style} aria-hidden>
        {name.slice(0, 1) || "?"}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} referrerPolicy="no-referrer" className={`shrink-0 rounded-full bg-surface object-cover ${border}`} style={style} />
  );
}
