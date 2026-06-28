import { siteUrl } from "@/lib/site-url";

export function VerificationQr({
  code,
  size = 132,
}: {
  code: string;
  size?: number;
}) {
  const bits = pseudoQrBits(code);

  return (
    <div className="inline-grid gap-2 text-center">
      <svg
        role="img"
        aria-label={`Código QR de verificación ${code}`}
        width={size}
        height={size}
        viewBox="0 0 13 13"
        className="rounded bg-white p-1 shadow-sm"
      >
        <rect width="13" height="13" fill="white" />
        {bits.map(([x, y], index) => (
          <rect key={`${x}-${y}-${index}`} x={x} y={y} width="1" height="1" fill="#111827" />
        ))}
        <Finder x={0} y={0} />
        <Finder x={8} y={0} />
        <Finder x={0} y={8} />
      </svg>
      <div className="max-w-[180px]">
        <p className="break-all font-mono text-[10px] font-semibold text-[#153553]">
          {code}
        </p>
        <p className="mt-1 break-all text-[9px] leading-3 text-muted-foreground">
          {siteUrl(`/verificar/${code}`)}
        </p>
      </div>
      <style>{`:where(svg[aria-label*="${code.slice(0, 6)}"]) rect{shape-rendering:crispEdges}`}</style>
    </div>
  );
}

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width="5" height="5" fill="#111827" />
      <rect x={x + 1} y={y + 1} width="3" height="3" fill="white" />
      <rect x={x + 2} y={y + 2} width="1" height="1" fill="#111827" />
    </>
  );
}

function pseudoQrBits(code: string) {
  const text = `${code}|${siteUrl(`/verificar/${code}`)}`;
  let seed = 0;
  for (let index = 0; index < text.length; index += 1) {
    seed = (seed * 31 + text.charCodeAt(index)) >>> 0;
  }
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < 13; y += 1) {
    for (let x = 0; x < 13; x += 1) {
      const inFinder =
        (x < 5 && y < 5) ||
        (x > 7 && y < 5) ||
        (x < 5 && y > 7);
      if (inFinder) continue;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      if ((seed & 3) < 2) cells.push([x, y]);
    }
  }
  return cells;
}
