"use client";

export function StreamGridSkeleton() {
  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-1 px-1 shrink-0">
        <div className="h-7 w-7 rounded-md bg-surface-2 animate-pulse" />
        <div className="h-7 w-7 rounded-md bg-surface-2 animate-pulse" />
        <div className="h-4 w-12 rounded bg-surface-2/60 animate-pulse ml-2" />
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-1 gap-1.5">
        <div
          className="rounded-xl border border-white/8 bg-surface-1 animate-pulse"
          style={{ aspectRatio: "16/9" }}
        />
      </div>
    </div>
  );
}
