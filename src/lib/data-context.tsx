import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import raw from "@/data/dashboard.json";
import type { DailyData } from "./timeline";
import type { DashboardData } from "./types";

export const baseData = raw as unknown as DashboardData;

type Ctx = {
  data: DashboardData;
  /** day-by-day figures replaced by an upload this session (null = bundled data) */
  dailyOverride: DailyData | null;
  isModified: boolean;
  uploads: string[];
  replaceData: (d: DashboardData, label: string, daily?: DailyData | null) => void;
  reset: () => void;
};

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData>(baseData);
  const [dailyOverride, setDailyOverride] = useState<DailyData | null>(null);
  const [uploads, setUploads] = useState<string[]>([]);

  const replaceData = useCallback((d: DashboardData, label: string, daily?: DailyData | null) => {
    setData(d);
    if (daily) setDailyOverride(daily);
    setUploads((u) => [...u, label]);
  }, []);
  const reset = useCallback(() => {
    setData(baseData);
    setDailyOverride(null);
    setUploads([]);
  }, []);

  const value = useMemo(
    () => ({ data, dailyOverride, isModified: uploads.length > 0, uploads, replaceData, reset }),
    [data, dailyOverride, uploads, replaceData, reset],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDashboard must be used inside DataProvider");
  return ctx;
}
