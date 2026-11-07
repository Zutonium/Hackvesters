import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/dash/primitives";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/lib/data-context";
import { gbp, pct } from "@/lib/format";
import bundledDaily from "@/data/daily.json";
import { applyDailyUpload, type DailyData } from "@/lib/timeline";
import { applyUpload, UPLOAD_FORMATS, type UploadKind } from "@/lib/upload";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Data — Grind and Crumb" },
      {
        name: "description",
        content: "Upload updated sales, waste, rota or cost files to refresh every Grind and Crumb dashboard figure.",
      },
      { property: "og:title", content: "Grind and Crumb — Upload New Data" },
      { property: "og:description", content: "Refresh the dashboard with updated CSV files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

function downloadTemplate(kind: UploadKind) {
  const f = UPLOAD_FORMATS[kind];
  const blob = new Blob([f.columns.join(",") + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.file.replace(".csv", "_template.csv");
  a.click();
  URL.revokeObjectURL(url);
}

function UploadPage() {
  const { data, dailyOverride, replaceData, reset, uploads, isModified } = useDashboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a CSV file.");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const before = data.chain.total_profit;
      const res = applyUpload(data, text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const daily =
        res.kind === "sales" || res.kind === "waste"
          ? applyDailyUpload(dailyOverride ?? (bundledDaily as DailyData), text)
          : null;
      replaceData(res.data, `${file.name} · ${UPLOAD_FORMATS[res.kind].label}`, daily);
      const msg = `${UPLOAD_FORMATS[res.kind].label} updated for ${res.storesUpdated.length} store${res.storesUpdated.length === 1 ? "" : "s"} (${res.rows.toLocaleString("en-GB")} rows). Chain profit is now ${gbp(res.data.chain.total_profit)} (was ${gbp(before)}).`;
      setLast(msg);
      toast.success("Dashboard refreshed");
    } catch {
      toast.error("We couldn't read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  return (
    <>
      <PageHeader
        eyebrow="Upload"
        title="Upload new data"
        description="Add updated CSV files to refresh the figures across every page of the dashboard."
        actions={
          isModified && (
            <Button variant="outline" onClick={reset} className="gap-1.5">
              <RotateCcw className="size-4" /> Back to original data
            </Button>
          )
        }
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "surface flex flex-col items-center gap-4 border-2 border-dashed px-6 py-14 text-center transition",
          dragging && "border-brand bg-brand-soft",
        )}
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          <UploadCloud className="size-7" />
        </div>
        <div>
          <h2 className="text-2xl">Drop a CSV file here</h2>
          <p className="mt-1 text-sm text-muted-foreground">or choose one from your computer</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Processing…" : "Choose file"}
        </Button>
        {last && (
          <p className="flex max-w-2xl items-start gap-2 rounded-lg bg-positive-soft px-4 py-3 text-left text-sm text-positive">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {last}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(UPLOAD_FORMATS) as UploadKind[]).map((k) => {
          const f = UPLOAD_FORMATS[k];
          return (
            <div key={k} className="surface flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="size-5 text-brand" />
                <div className="flex-1">
                  <h3 className="text-lg">{f.label}</h3>
                  <p className="num text-xs text-muted-foreground">{f.file}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => downloadTemplate(k)} className="gap-1.5">
                  <Download className="size-3.5" /> Template
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.columns.map((c) => (
                  <code key={c} className="num rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
                    {c}
                  </code>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Panel title="This session" subtitle="Uploads stay in this browser tab until you reset or reload">
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No uploads yet — you're viewing the original data (profit {gbp(data.chain.total_profit)},{" "}
            {pct(data.chain.overall_margin)} margin).
          </p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {uploads.map((u, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-positive" /> {u}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
