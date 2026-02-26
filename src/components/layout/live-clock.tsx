"use client";

import { useEffect, useState } from "react";

export function LiveClock() {
  const [time, setTime] = useState("00:00:00");

  useEffect(() => {
    function updateTime() {
      setTime(new Date().toLocaleTimeString());
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-xs font-mono text-muted-foreground/60 tabular-nums">
      {time}
    </span>
  );
}
