import { formatCurrency } from "@/lib/utils/format";

type Row = {
  date: string;
  grossSale: number;
  deliveredRevenue: number;
  netProfit: number;
  marketing: number;
  deliveryRate?: number;
  rtoRate?: number;
};

function pathFor(values: number[], min: number, max: number) {
  if (!values.length) return "";
  const w = 1000;
  const h = 300;
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * w;
      const y = h - ((value - min) / span) * h;
      return index === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function dateLabel(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function SourceProfitTrend({ data }: { data: Row[] }) {
  const moneyValues = data.flatMap((row) => [row.grossSale, row.deliveredRevenue, Math.max(0, row.netProfit), row.marketing]);
  const moneyMax = Math.max(40000, ...moneyValues, 1);
  const moneyMin = Math.min(0, ...moneyValues);
  const pctMin = 0;
  const pctMax = 100;

  const indexes = data.length
    ? [0, Math.floor((data.length - 1) * 0.25), Math.floor((data.length - 1) * 0.5), Math.floor((data.length - 1) * 0.75), data.length - 1]
    : [];
  const uniqueIndexes = [...new Set(indexes)];

  return (
    <div className="chart" aria-label="Sales profit and cost trend">
      <div className="chart-axis-y">
        {[moneyMax, moneyMax * 0.75, moneyMax * 0.5, moneyMax * 0.25, 0].map((v, i) => (
          <span key={i}>{formatCurrency(v)}</span>
        ))}
      </div>
      <div className="chart-axis-pct">
        <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
      </div>
      <div className="chart-grid" />
      {data.length ? (
        <div className="chart-line">
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
            <path d={pathFor(data.map((r) => r.grossSale), moneyMin, moneyMax)} fill="none" stroke="#aeb5bd" strokeWidth="2.2" />
            <path d={pathFor(data.map((r) => r.deliveredRevenue), moneyMin, moneyMax)} fill="none" stroke="#6f95be" strokeWidth="2" />
            <path d={pathFor(data.map((r) => r.netProfit), moneyMin, moneyMax)} fill="none" stroke="#1f252b" strokeWidth="2.6" />
            <path d={pathFor(data.map((r) => r.marketing), moneyMin, moneyMax)} fill="none" stroke="#c69d63" strokeWidth="1.8" strokeDasharray="5 6" opacity=".9" />
            <path d={pathFor(data.map((r) => r.rtoRate ?? 0), pctMin, pctMax)} fill="none" stroke="#c46f73" strokeWidth="1.7" strokeDasharray="4 5" opacity=".9" />
            <path d={pathFor(data.map((r) => r.deliveryRate ?? 0), pctMin, pctMax)} fill="none" stroke="#5e9c79" strokeWidth="1.7" strokeDasharray="4 5" opacity=".9" />
          </svg>
        </div>
      ) : (
        <div className="empty-center"><div className="empty-badge">No data for this period</div></div>
      )}
      <div className="chart-axis-x">
        {uniqueIndexes.map((index) => <span key={index}>{dateLabel(data[index].date)}</span>)}
      </div>
    </div>
  );
}
