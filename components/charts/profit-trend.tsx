"use client";

import { useMemo } from "react";

type Point = {
  date: string;
  grossSale: number;
  deliveredRevenue: number;
  netProfit: number;
  marketing: number;
  rto?: number;
  deliveryRate?: number;
};

const SERIES = [
  { key: "grossSale", label: "Gross Sale", stroke: "#aeb5bd", dash: undefined, width: 2.2 },
  { key: "deliveredRevenue", label: "Delivered Revenue", stroke: "#6f95be", dash: undefined, width: 2.2 },
  { key: "netProfit", label: "Net Profit", stroke: "#1f252b", dash: undefined, width: 2.4 },
  { key: "marketing", label: "Marketing Cost", stroke: "#c69d63", dash: "5 6", width: 1.8 },
  { key: "rto", label: "RTO Rate", stroke: "#c46f73", dash: "4 5", width: 1.7 },
  { key: "deliveryRate", label: "Delivery Rate", stroke: "#5e9c79", dash: "4 5", width: 1.7 },
] as const;

function pathFor(data: Point[], key: string, usePercent = false) {
  if (!data.length) return "";
  const values = data.map((x) => Number((x as any)[key] ?? 0));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 1000;
      const ratio = (value - min) / span;
      const y = 270 - ratio * 225;
      return (index === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
    })
    .join(" ");
}

function labelDate(value: string) {
  const d = new Date(value + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function ProfitTrend({ data }: { data: Point[] }) {
  const labels = data.length
    ? [data[0], data[Math.floor((data.length - 1) / 2)], data[data.length - 1]]
    : [];
  const active = new Set(["grossSale", "deliveredRevenue", "netProfit"]);
  const hasData = data.some((x) => Number(x.grossSale ?? 0) !== 0 || Number(x.deliveredRevenue ?? 0) !== 0 || Number(x.netProfit ?? 0) !== 0 || Number(x.marketing ?? 0) !== 0);

  const paths = useMemo(
    () =>
      SERIES.map((series) => ({
        ...series,
        d: pathFor(data, series.key, series.key === "rto" || series.key === "deliveryRate"),
      })),
    [data],
  );

  return (
    <>
      <div className="chart">
        <div className="chart-axis-y">
          <span>₹40,000</span><span>₹30,000</span><span>₹20,000</span><span>₹10,000</span><span>₹0</span>
        </div>
        <div className="chart-axis-pct"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
        <div className="chart-grid" />
        <div className="chart-line">
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
            {paths.map((series) => (
              <path key={series.key} d={hasData ? series.d : ""} fill="none" stroke={series.stroke} strokeWidth={series.width} strokeDasharray={series.dash} opacity={active.has(series.key) ? 1 : 0.85} />
            ))}
          </svg>
          {!hasData && <div className="empty-center"><div className="empty-badge">No data for selected period</div></div>}
        </div>
        <div className="chart-axis-x">
          {labels.map((x, i) => <span key={i}>{labelDate(x.date)}</span>)}
        </div>
      </div>
      <div className="legend">
        {SERIES.map((series) => <span key={series.key}><i className="legend-dot" style={{ background: series.stroke }} /> {series.label}</span>)}
      </div>
    </>
  );
}
