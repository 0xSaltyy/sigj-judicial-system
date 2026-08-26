import Image from "next/image";
import { cn } from "@/lib/utils";

export function InstitutionalMark({
  compact = false,
  dark = false,
}: {
  compact?: boolean;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="grid size-16 shrink-0 place-items-center bg-white p-1 ring-1 ring-slate-200">
        <Image
          src="/department-seal.png"
          alt="Department of Justice seal"
          width={64}
          height={64}
          className="h-full w-full object-contain"
          priority
        />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className={cn("text-[11px] font-semibold uppercase tracking-[.18em]", dark ? "text-slate-300" : "text-[#5b7287]")}>
            United States
          </p>
          <p className={cn("mt-1 font-serif text-2xl font-semibold tracking-tight", dark ? "text-white" : "text-[#112f4e]")}>
            U.S. Department of Justice
          </p>
        </div>
      )}
    </div>
  );
}
