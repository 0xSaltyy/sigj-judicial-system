import Image from "next/image";

export function CorteSupremaLogo({
  width = 132,
  className = "",
}: {
  width?: number;
  className?: string;
}) {
  return (
    <Image
      src="/corte-suprema.png"
      alt="República de Colombia · Corte Suprema de Justicia"
      width={325}
      height={344}
      className={`mx-auto h-auto object-contain ${className}`}
      style={{ width }}
      priority
    />
  );
}
