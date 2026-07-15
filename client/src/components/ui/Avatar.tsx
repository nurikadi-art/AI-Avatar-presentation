import { LABEL_HEX, type LabelColor } from '@shared/types';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export function Avatar({
  name,
  color,
  size = 32,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const hex = LABEL_HEX[color as LabelColor] ?? LABEL_HEX.gray;
  return (
    <span
      className="inline-flex select-none items-center justify-center rounded-full font-medium text-paper"
      style={{ backgroundColor: hex, width: size, height: size, fontSize: size * 0.4 }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
