type Props = { src: string; name: string; color: string; size?: number };

// Plain <img>: avatars may live on Bilibili's CDN, which 403s foreign referers,
// so we send none. next/image would need remotePatterns per host — not worth it in v1.
export function Avatar({ src, name, color, size = 48 }: Props) {
  const style = { width: size, height: size, borderColor: color };
  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border-2 bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
        style={style}
        aria-hidden
      >
        {name.slice(0, 1) || "?"}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full border-2 object-cover"
      style={style}
    />
  );
}
