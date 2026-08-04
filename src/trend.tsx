/** Окно, за которое смотрим бэклог на карточке проекта. */
export const TREND_DAYS = 7;

const W = 108;
const H = 26;
const PAD = 3;

/**
 * Куда идёт бэклог за неделю: линия из накопленной разницы «заведено минус
 * закрыто». Шкала своя у каждого проекта — сравнивать карточки между собой
 * тут нечего, важен только наклон линии внутри одной.
 * ponytail: свой polyline, графическая библиотека ради семи точек лишняя.
 */
export function Trend({ trend }: { trend: number[] }) {
  const net = trend.at(-1) ?? 0;
  // ноль в шкале всегда: без него ряд из одних минусов выглядел бы ростом
  const lo = Math.min(0, ...trend);
  const span = Math.max(0, ...trend) - lo || 1;
  const step = W / Math.max(1, trend.length - 1);
  const points = trend
    .map((value, i) => `${i * step},${PAD + (1 - (value - lo) / span) * (H - 2 * PAD)}`)
    .join(" ");

  const verdict =
    net > 0 ? `вырос на ${net}` : net < 0 ? `сократился на ${-net}` : "без изменений";

  return (
    <svg
      className={`trend ${net > 0 ? "up" : "down"}`}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`Бэклог за ${trend.length} дн.: ${verdict}`}
    >
      <polyline points={points} />
    </svg>
  );
}
