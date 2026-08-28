import Image from "next/image";
import { cn } from "@/lib/utils";

export function InstitutionalMark({
  compact = false,
  dark = false,
  small = false,
}: {
  compact?: boolean;
  dark?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <div className={cn("grid shrink-0 place-items-center bg-white p-1 ring-1 ring-slate-300", small ? "size-10" : "size-12 sm:size-16")}>
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
        <div className="min-w-0 leading-tight">
          <p className={cn("text-[11px] font-semibold uppercase tracking-[.18em]", dark ? "text-slate-300" : "text-[#5b7287]")}>
            United States
          </p>
          <p className={cn("mt-1 max-w-[230px] truncate font-serif text-xl font-semibold tracking-tight sm:max-w-none sm:text-2xl", dark ? "text-white" : "text-[#112f4e]")}>
            U.S. Department of Justice
          </p>
        </div>
      )}
    </div>
  );
}
