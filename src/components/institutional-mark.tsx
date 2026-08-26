import Image from "next/image";
import { cn } from "@/lib/utils";

export function InstitutionalMark({
  compact = false,
  dark = true,
}: {
  compact?: boolean;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-full bg-white p-1.5 shadow-sm ring-1 ring-[#cfb16c]/70">
        <Image
          src="/department-seal.png"
          alt="Sello ficticio Department of Justice Roleplay"
          width={48}
          height={48}
          className="h-full w-full object-contain"
          priority
        />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#cdb374]">
            Roleplay Department
          </p>
          <p className={cn("mt-1 font-serif text-sm font-semibold", dark ? "text-white" : "text-[#102d49]")}>
            Department of Justice RP
          </p>
        </div>
      )}
    </div>
  );
}
