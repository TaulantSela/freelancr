"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PlayerChapter = { id: string; title: string; start: number };

function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// The walkthrough video with its chapter list: a chapter seeks the video
// there and plays it; the one playing is marked.
export function DemoPlayer({
  mp4,
  webm,
  poster,
  chapters,
  labels,
}: {
  mp4: string;
  webm: string | null;
  poster: string;
  chapters: PlayerChapter[];
  labels: { chapters: string; fallback: string };
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);

  function seek(start: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = start;
    void v.play().catch(() => {});
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <video
        ref={video}
        className="w-full aspect-[16/10] rounded-lg border border-border bg-black"
        controls
        muted
        playsInline
        preload="metadata"
        poster={poster}
        onTimeUpdate={(e) => {
          const time = e.currentTarget.currentTime;
          let current = 0;
          chapters.forEach((c, i) => {
            if (time >= c.start) current = i;
          });
          setActive(current);
        }}
      >
        {webm && <source src={webm} type="video/webm" />}
        <source src={mp4} type="video/mp4" />
        {labels.fallback}
      </video>
      <nav aria-label={labels.chapters}>
        <h2 className="text-sm font-medium mb-2">{labels.chapters}</h2>
        <ol className="space-y-0.5">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => seek(c.start)}
                data-start={c.start}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "w-full flex items-baseline gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  i === active
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="font-mono text-xs tabular-nums w-9 shrink-0">{clock(c.start)}</span>
                <span>{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
