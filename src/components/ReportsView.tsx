import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  BarChart3,
} from 'lucide-react';
import {
  calculateExpenseReport,
  calculateLineItemMetrics,
  formatCurrency,
} from '../shared/calculations.ts';
import { UserWorkspaceData } from '../shared/types.ts';

interface ReportsViewProps {
  workspace: UserWorkspaceData;
  showToast: (msg: string) => void;
}

const CHART_COLORS = [
  '#0f172a',
  '#b45309',
  '#047857',
  '#1d4ed8',
  '#be123c',
  '#6d28d9',
  '#0e7490',
  '#a16207',
  '#374151',
  '#c2410c',
];

export const ReportsView: React.FC<ReportsViewProps> = ({ workspace, showToast }) => {
  const [scopeFilter, setScopeFilter] = useState<'Both' | 'Marriage' | 'Engagement'>('Both');

  const coupleTitle = useMemo(() => {
    const b =
      workspace.eventParticulars.brideName || workspace.engagementParticulars.brideName || '';
    const g =
      workspace.eventParticulars.groomName || workspace.engagementParticulars.groomName || '';
    if (b && g) return `${b} & ${g} — ${scopeFilter} Expense Report`;
    return `PlanEase — ${scopeFilter} Function Expense & Budget Report`;
  }, [workspace.eventParticulars, workspace.engagementParticulars, scopeFilter]);

  const filteredItems = useMemo(() => {
    if (scopeFilter === 'Both') return workspace.expenseItems;
    return workspace.expenseItems.filter((i) => i.scope === scopeFilter);
  }, [workspace.expenseItems, scopeFilter]);

  const declaredBudget = useMemo(() => {
    if (scopeFilter === 'Marriage') return Number(workspace.eventParticulars.totalBudget) || 0;
    if (scopeFilter === 'Engagement')
      return Number(workspace.engagementParticulars.totalBudget) || 0;
    return (
      (Number(workspace.eventParticulars.totalBudget) || 0) +
      (Number(workspace.engagementParticulars.totalBudget) || 0)
    );
  }, [scopeFilter, workspace.eventParticulars.totalBudget, workspace.engagementParticulars.totalBudget]);

  const report = useMemo(
    () => calculateExpenseReport(workspace.marriageCategories, filteredItems, declaredBudget),
    [workspace.marriageCategories, filteredItems, declaredBudget]
  );

  // Active categories with spending or budget for charts
  const activeCategories = report.categoryBreakdown.filter(
    (c) => c.budgetedTotal > 0 || c.actualTotal > 0
  );

  const maxCatVal = Math.max(
    1,
    ...activeCategories.map((c) => Math.max(c.budgetedTotal, c.actualTotal))
  );

  // Build SVG Donut slices for Category-wise Actual Spend
  const donutSlices = useMemo(() => {
    const spendCats = activeCategories.filter((c) => c.actualTotal > 0);
    const total = spendCats.reduce((s, c) => s + c.actualTotal, 0);
    if (total <= 0) return [];
    let cumulativeAngle = 0;
    return spendCats.map((cat, idx) => {
      const fraction = cat.actualTotal / total;
      const startAngle = cumulativeAngle;
      const sliceAngle = fraction * 360;
      cumulativeAngle += sliceAngle;
      return {
        ...cat,
        color: CHART_COLORS[idx % CHART_COLORS.length],
        fraction,
        startAngle,
        endAngle: cumulativeAngle,
      };
    });
  }, [activeCategories]);

  const handleDownloadCSV = () => {
    const safeTitle = coupleTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const lines: string[] = [];
    lines.push(`"${coupleTitle}"`);
    lines.push(
      `"Generated At","${new Date().toISOString()}","Currency","${workspace.currency}"`
    );
    lines.push('');
    lines.push(
      '"SUMMARY METRIC","AMOUNT"'
    );
    lines.push(`"Total Planned Budget","${report.effectiveTotalBudget}"`);
    lines.push(`"Total Actual Spent","${report.totalActualSpent}"`);
    lines.push(`"Total Advance Paid","${report.totalAdvancePaid}"`);
    lines.push(`"Total Balance Due","${report.totalBalanceDue}"`);
    lines.push(`"Net Variance (Budget - Actual)","${report.totalVariance}"`);
    lines.push(`"Budget Used (%)","${report.percentBudgetUsed}%"`);
    lines.push('');
    lines.push(
      '"CATEGORY SUMMARY","ITEMS","BUDGETED","ACTUAL SPENT","ADVANCE PAID","BALANCE DUE","VARIANCE","% OF SPEND"'
    );
    for (const c of report.categoryBreakdown) {
      lines.push(
        [
          `"${c.categoryName.replace(/"/g, '""')}"`,
          c.itemCount,
          c.budgetedTotal,
          c.actualTotal,
          c.advanceTotal,
          c.balanceDueTotal,
          c.varianceTotal,
          `"${c.percentOfSpend}%"`,
        ].join(',')
      );
    }
    lines.push('');
    lines.push(
      '"SCOPE","PARTICULAR","CATEGORY","VENDOR","CONTACT","BUDGETED","ACTUAL SPENT","VARIANCE","ADVANCE PAID","BALANCE DUE","DUE DATE","STATUS","NOTES"'
    );
    for (const item of filteredItems) {
      const m = calculateLineItemMetrics(item);
      lines.push(
        [
          `"${item.scope}"`,
          `"${item.particular.replace(/"/g, '""')}"`,
          `"${item.categoryName.replace(/"/g, '""')}"`,
          `"${item.vendorName.replace(/"/g, '""')}"`,
          `"${item.vendorContact.replace(/"/g, '""')}"`,
          m.budgeted,
          m.actual,
          m.variance,
          m.advance,
          m.balanceDue,
          `"${item.dueDate}"`,
          `"${item.isPaid ? 'Paid' : 'Pending'}"`,
          `"${item.notes.replace(/"/g, '""')}"`,
        ].join(',')
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Excel/CSV Expense Report downloaded.');
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
            {coupleTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {workspace.eventParticulars.venue
              ? `Venue: ${workspace.eventParticulars.venue}, ${workspace.eventParticulars.city}`
              : 'Complete category-wise breakdown, visual charts, and printable/Excel reports'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-neutral-800 rounded-lg">
            {(['Both', 'Marriage', 'Engagement'] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setScopeFilter(sc)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  scopeFilter === sc
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-neutral-400'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-3.5 py-2 border border-stone-300 dark:border-neutral-700 text-xs font-semibold rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPDF}
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF Report</span>
          </button>
        </div>
      </div>

      {/* Grand Totals KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Total Planned Budget</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">
            {formatCurrency(report.effectiveTotalBudget, workspace.currency)}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Total Actual Spent</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">
            {formatCurrency(report.totalActualSpent, workspace.currency)}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Total Advance Paid</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
            {formatCurrency(report.totalAdvancePaid, workspace.currency)}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Total Balance Due</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1 text-amber-800 dark:text-amber-400">
            {formatCurrency(report.totalBalanceDue, workspace.currency)}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Pending Payments</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-1">
            {report.totalPendingPaymentsCount} item(s)
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">% of Budget Used</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${
              report.percentBudgetUsed > 100 ? 'text-red-600' : ''
            }`}
          >
            {report.percentBudgetUsed}%
          </div>
        </div>
      </div>

      {/* Visual Charts Section: Category-Wise Pie/Donut Chart + Budget vs Actual Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category-Wise Spend Breakdown Chart (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 pb-3">
            <h2 className="text-base font-bold font-display flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-700" />
              <span>Category-Wise Spend Share</span>
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {formatCurrency(report.totalActualSpent, workspace.currency)}
            </span>
          </div>

          {donutSlices.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Add actual spent amounts in the Marriage or Engagement Ledger to visualize
              category-wise distribution.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Segmented Stacked Distribution Bar + Legend */}
              <div className="w-full h-5 rounded-lg overflow-hidden flex bg-stone-100 dark:bg-neutral-800">
                {donutSlices.map((s) => (
                  <div
                    key={s.categoryId}
                    style={{
                      width: `${Math.max(2, s.percentOfSpend)}%`,
                      backgroundColor: s.color,
                    }}
                    title={`${s.categoryName}: ${s.percentOfSpend}%`}
                    className="h-full transition-all"
                  />
                ))}
              </div>

              <div className="divide-y divide-stone-100 dark:divide-neutral-800 text-xs">
                {donutSlices.map((s) => (
                  <div key={s.categoryId} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate font-medium">{s.categoryName}</span>
                    </div>
                    <div className="font-mono tabular-nums shrink-0">
                      {formatCurrency(s.actualTotal, workspace.currency)} ({s.percentOfSpend}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Budget vs Actual Bar Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 pb-3">
            <h2 className="text-base font-bold font-display flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700 dark:text-amber-400" />
              <span>Budgeted vs. Actual Spent by Category</span>
            </h2>
            <span className="text-xs text-slate-500">Slate: Budget · Amber/Crimson: Actual</span>
          </div>

          {activeCategories.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No category budgets or expenses entered yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {activeCategories.map((cat) => {
                const budgetPct = Math.round((cat.budgetedTotal / maxCatVal) * 100);
                const actualPct = Math.round((cat.actualTotal / maxCatVal) * 100);
                return (
                  <div key={cat.categoryId} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{cat.categoryName}</span>
                      <span className="font-mono tabular-nums text-[11px]">
                        Budget: {formatCurrency(cat.budgetedTotal, workspace.currency)} · Actual:{' '}
                        <strong className={cat.isOverBudget ? 'text-red-600' : ''}>
                          {formatCurrency(cat.actualTotal, workspace.currency)}
                        </strong>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-stone-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${budgetPct}%` }}
                          className="h-full bg-slate-400 dark:bg-neutral-500"
                        />
                      </div>
                      <div className="w-full h-2 bg-stone-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${actualPct}%` }}
                          className={`h-full ${
                            cat.isOverBudget ? 'bg-red-600' : 'bg-amber-600 dark:bg-amber-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category-Wise Final Totals Table */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl overflow-x-auto">
        <div className="p-4 border-b border-stone-200 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-base font-bold font-display">
            Category-Wise Financial Breakdown & Grand Totals
          </h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {filteredItems.length} total line item(s)
          </span>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-800/50 text-slate-500">
              <th className="py-3 px-4 font-semibold">Category</th>
              <th className="py-3 px-4 font-semibold text-right">Items</th>
              <th className="py-3 px-4 font-semibold text-right">Budgeted Total</th>
              <th className="py-3 px-4 font-semibold text-right">Actual Spent</th>
              <th className="py-3 px-4 font-semibold text-right">Advance Paid</th>
              <th className="py-3 px-4 font-semibold text-right">Balance Due</th>
              <th className="py-3 px-4 font-semibold text-right">Variance (B - A)</th>
              <th className="py-3 px-4 font-semibold text-right">% of Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
            {report.categoryBreakdown.map((row) => (
              <tr
                key={row.categoryId}
                className={
                  row.isOverBudget ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                }
              >
                <td className="py-2.5 px-4 font-semibold">{row.categoryName}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums">{row.itemCount}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                  {formatCurrency(row.budgetedTotal, workspace.currency)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                  {formatCurrency(row.actualTotal, workspace.currency)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(row.advanceTotal, workspace.currency)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-800 dark:text-amber-400">
                  {formatCurrency(row.balanceDueTotal, workspace.currency)}
                </td>
                <td
                  className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                    row.isOverBudget
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {formatCurrency(row.varianceTotal, workspace.currency)}
                  {row.isOverBudget ? ' (Over)' : ''}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                  {row.percentOfSpend}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300 dark:border-neutral-700 bg-stone-50 dark:bg-neutral-800 font-bold">
              <td className="py-3 px-4">GRAND TOTAL</td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {filteredItems.length}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatCurrency(report.totalAllocatedBudget, workspace.currency)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatCurrency(report.totalActualSpent, workspace.currency)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatCurrency(report.totalAdvancePaid, workspace.currency)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-800 dark:text-amber-400">
                {formatCurrency(report.totalBalanceDue, workspace.currency)}
              </td>
              <td
                className={`py-3 px-4 text-right font-mono tabular-nums ${
                  report.totalVariance < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(report.totalVariance, workspace.currency)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
