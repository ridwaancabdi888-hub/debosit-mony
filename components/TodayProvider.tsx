"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { todayIso } from "@/lib/dates";
import { useIsomorphicLayoutEffect } from "@/lib/useIsomorphicLayoutEffect";

/**
 * "Today" for status and countdown purposes.
 *
 * Seeded with the server's date so the markup is stable, then corrected to the
 * browser's local date before paint — otherwise a UTC server would show the
 * wrong "Due Today" to a user several hours ahead. Re-checked whenever the tab
 * regains focus, so a dashboard left open overnight rolls over on its own.
 */
const TodayContext = createContext<string | null>(null);

export function TodayProvider({
  serverToday,
  children,
}: {
  serverToday: string;
  children: ReactNode;
}) {
  const [today, setToday] = useState(serverToday);

  useIsomorphicLayoutEffect(() => {
    const sync = () => {
      const current = todayIso();
      setToday((previous) => (previous === current ? previous : current));
    };

    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return <TodayContext.Provider value={today}>{children}</TodayContext.Provider>;
}

export function useToday(): string {
  const today = useContext(TodayContext);
  if (!today) throw new Error("useToday must be used inside <TodayProvider>");
  return today;
}
