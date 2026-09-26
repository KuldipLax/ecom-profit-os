# Calculation Methods

Calculation version: **1.0.0**

All production calculations are centralized in `lib/profit-engine/calculation.ts`, with COGS resolution in `lib/profit-engine/cogs.ts` and projection logic in `lib/forecast-engine/index.ts`.

## Order state

### RTO

An order is in the RTO bucket when normalized status is one of:

- `RTO_PROCESSING`
- `RTO_IN_TRANSIT`
- `RTO_DELIVERED`

### Effective delivered

By default:

`Effective Delivered = Actual COD Delivered + Prepaid orders treated as effective delivered`

This is configurable per business. Cancelled and RTO orders are never effective delivered.

## Revenue

### Gross Sale

`Gross Sale = sum of unique order gross sale by Order Date`

Cancelled orders remain visible in Gross Sale because the metric represents order-level sales booked in the selected order-date period.

### Net Sale (Shipped)

`Net Sale (Shipped) = sum Gross Sale of orders in shipped/forward/RTO/undelivered shipping states`

### Delivered Revenue

`Delivered Revenue = sum of effective-delivered order gross sale - refund amount`

A cancelled order contributes zero delivered revenue.

## COGS

For each effective-delivered order line:

`Line COGS = quantity × applicable unit COGS`

COGS resolution priority:

`Variant > Product > Category > Default`

Only cost records with `effective_from <= order date` are eligible. Historical orders therefore do not change when a new cost record is created.

RTO orders do not consume COGS in P&L.

## Shipping

A shipped order can have multiple source shipment rows. Source rows are normalized and rolled into the unique order before P&L calculation.

Default practical shipping cost:

`Practical Shipping Cost = MAX(Total Freight, Unbilled Charges)`

Alternative `sum` behavior is explicitly configurable per business.

The engine never adds both freight and unbilled charges under the default rule.

## Checkout fee

Default:

`Checkout Fee = 2% × applicable order value`

The rule supports percentage, flat and hybrid modes plus minimum/maximum caps.

## Payment gateway

Default:

`Prepaid PG Fee = 2% × prepaid order value`

`COD PG Fee = 0`

This rule is configurable. Direct gateway API data may override manual calculations when the connected provider supports it.

## Marketing

### Effective Marketing Cost

`Meta GST = Meta Spend × Meta GST rate`

`Effective Marketing Cost = Meta Spend + Meta GST`

Default rate = 18%.

Marketing cost is applied once to the analysis period. The official order profitability table deliberately does not invent Meta allocation per order.

## Net Profit

`Net Profit = Delivered Revenue - COGS - Shipping - Checkout Fee - PG Fee - Effective Marketing Cost`

Equivalent:

`Net Profit = Delivered Revenue - COGS - Shipping - Checkout - PG - Meta Spend - Meta GST`

## Order contribution before marketing

`Contribution Before Marketing = Delivered Revenue - COGS - Shipping - Checkout - PG - Manual Adjustments`

This is the appropriate order-level metric when Meta spend is period-level.

## Ratios

`Delivery Rate = Effective Delivered Orders / denominator`

The implementation uses shipped orders when any exist in the period; otherwise total orders.

`RTO Rate = RTO Orders / Total Orders`

`ROAS = Delivered Revenue / Effective Marketing Cost`

Marketing profitability tables also show provider-attributed conversion-value ROAS as `Conversion Value / Raw Meta Spend`; this is an analytics view and does not change the canonical P&L.

`Profit Margin = Net Profit / Delivered Revenue`

`AOV = Gross Sale / Total Orders`

`Profit per Delivered Order = Net Profit / Effective Delivered Orders`

`Marketing Cost per Delivered Order = Effective Marketing Cost / Effective Delivered Orders`

Division by zero returns 0 in summary metrics.

## Forecast

Forward pipeline defaults to `IN_TRANSIT`, `REACHED_DESTINATION`, and `UNDELIVERED`; the business `forward_statuses` setting can replace or extend this set.

The current projection uses the supplied rolling-period effective delivery rate:

`Estimated Delivered Orders = Forward Orders × Delivery Rate`

`Estimated RTO Orders = Forward Orders - Estimated Delivered Orders`

`Projected Revenue = sum(Forward Order Values) × Delivery Rate`

Forward-order values are not rounded before multiplication.

Additional projected costs use recent actual cost rates from the selected historical period, while the forecast result is always marked `estimateOnly: true`.

## Precision

Decimal.js is configured to preserve 40 significant digits internally. Values are converted to JavaScript numbers only at API serialization boundaries and formatted to two decimals for currency display.

## Snapshots

Every persisted `profit_snapshots` row contains:

- `calculation_version`
- `rules_used`
- `generated_at`
- metrics

This permits future calculation versions without rewriting historic snapshots.
