import Image from "next/image";

export function InstitutionalMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-white/20 bg-white p-1 shadow-sm">
        <Image
          src="/escudo-institucional.png"
          alt="Emblema institucional del portal SIGJ"
          fill
          sizes="48px"
          className="object-contain p-1"
          priority
        />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#cdb374]">República Judicial</p>
          <p className="mt-1 text-sm font-semibold text-white">Tribunal Superior de Justicia</p>
        </div>
      )}
    </div>
  );
}
