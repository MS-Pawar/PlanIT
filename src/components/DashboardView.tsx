import React from 'react';
import {
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  HeartHandshake,
  Plus,
  ArrowUpRight,
  MapPin,
  Clock,
  CalendarHeart,
  Mail,
} from 'lucide-react';
import {
  calculateEventCountdown,
  calculateExpenseReport,
  createDefaultSubEvents,
  formatCurrency,
  formatEventTime12h,
  getLocalTodayIso,
  toLocalIsoDate,
} from '../shared/calculations.ts';
import {
  TaskItem,
  UserWorkspaceData,
} from '../shared/types.ts';

interface DashboardViewProps {
  workspace: UserWorkspaceData;
  onToggleTaskDone: (taskId: string) => void;
  onNavigate: (section: 'dashboard' | 'tasks' | 'calendar' | 'payments' | 'marriage' | 'reports' | 'settings') => void;
  onOpenNewTaskModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  workspace,
  onToggleTaskDone,
  onNavigate,
  onOpenNewTaskModal,
}) => {
  const todayStr = getLocalTodayIso();

  // Calculate 7 days ago for "completed this week"
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = toLocalIsoDate(sevenDaysAgo);

  const tasksDueToday = workspace.tasks.filter(
    (t) => t.date === todayStr && t.status !== 'Done'
  );
  const overdueTasks = workspace.tasks.filter(
    (t) => t.date < todayStr && t.status !== 'Done'
  );
  const completedThisWeek = workspace.tasks.filter(
    (t) => t.status === 'Done' && t.date >= sevenDaysAgoStr
  );

  // Combine standalone unpaid payments + unpaid Payment/Bill tasks
  const unpaidStandalone = workspace.payments.filter((p) => !p.paid);
  const unpaidTaskPayments = workspace.tasks.filter(
    (t) => (t.category === 'Payment/Bill' || t.amount > 0) && !t.isPaid && t.status !== 'Done'
  );
  const upcomingPaymentsTotal =
    unpaidStandalone.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) +
    unpaidTaskPayments.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  // Marriage + Engagement combined expense report
  const combinedBudget =
    (Number(workspace.eventParticulars.totalBudget) || 0) +
    (Number(workspace.engagementParticulars.totalBudget) || 0);
  const expenseReport = calculateExpenseReport(
    workspace.marriageCategories,
    workspace.expenseItems,
    combinedBudget
  );

  // Sub-events & Countdowns (Engagement, Marriage, and Other Events)
  const subEvents =
    workspace.subEvents && workspace.subEvents.length > 0
      ? workspace.subEvents
      : createDefaultSubEvents();

  const coupleTitle =
    workspace.eventParticulars.brideName && workspace.eventParticulars.groomName
      ? `${workspace.eventParticulars.brideName} & ${workspace.eventParticulars.groomName}`
      : workspace.engagementParticulars.brideName && workspace.engagementParticulars.groomName
      ? `${workspace.engagementParticulars.brideName} & ${workspace.engagementParticulars.groomName}`
      : '';

  // Last 7 days completion bar chart data
  const next7DaysChart = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - 3 + idx);
    const iso = toLocalIsoDate(d);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayTasks = workspace.tasks.filter((t) => t.date === iso);
    const doneCount = dayTasks.filter((t) => t.status === 'Done').length;
    const pendingCount = dayTasks.length - doneCount;
    return { iso, dayLabel, total: dayTasks.length, doneCount, pendingCount, isToday: iso === todayStr };
  });

  const maxDayTasks = Math.max(4, ...next7DaysChart.map((d) => d.total));

  return (
    <div className="space-y-8">
      {/* Top Summary Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
            {workspace.customLabels.dashboardHeading || 'Daily Overview'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · Personal Planner & Function Budget
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task (N)</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('marriage')}
            className="px-4 py-2 border border-stone-300 dark:border-neutral-700 text-xs font-semibold rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <HeartHandshake className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>Marriage & Invitations</span>
          </button>
        </div>
      </div>

      {/* Live Event Countdowns & Bride/Groom Event Schedule Strip */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-neutral-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarHeart className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <h2 className="text-base font-bold font-display">
                {coupleTitle
                  ? `${coupleTitle} — Event Countdowns & Schedule`
                  : 'Engagement, Marriage & Function Countdowns'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              {workspace.eventParticulars.brideFamily || workspace.eventParticulars.groomFamily
                ? [
                    workspace.eventParticulars.brideFamily
                      ? `Bride's Family: ${workspace.eventParticulars.brideFamily}`
                      : '',
                    workspace.eventParticulars.groomFamily
                      ? `Groom's Family: ${workspace.eventParticulars.groomFamily}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Set event dates, times, venues, and formal invitations in the Marriage Planner'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('marriage')}
            className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Customize Events & Send Formal Invitations</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subEvents.map((ev) => {
            const effectiveDate =
              ev.eventDate ||
              (ev.eventCategory === 'Engagement'
                ? workspace.engagementParticulars.engagementDate ||
                  workspace.eventParticulars.engagementDate
                : ev.eventCategory === 'Marriage'
                ? workspace.eventParticulars.marriageDate
                : '');
            const effectiveTime =
              ev.eventTime ||
              (ev.eventCategory === 'Engagement'
                ? workspace.engagementParticulars.engagementTime
                : workspace.eventParticulars.marriageTime) ||
              '';
            const effectiveVenue =
              ev.venue ||
              (ev.eventCategory === 'Engagement'
                ? workspace.engagementParticulars.venue
                : workspace.eventParticulars.venue) ||
              'Venue not set';
            const effectiveCity =
              ev.city ||
              (ev.eventCategory === 'Engagement'
                ? workspace.engagementParticulars.city
                : workspace.eventParticulars.city) ||
              '';
            const countdown = calculateEventCountdown(effectiveDate, effectiveTime);

            return (
              <div
                key={ev.id}
                className="p-4 border border-stone-200 dark:border-neutral-800 rounded-lg flex flex-col justify-between gap-3 bg-stone-50/50 dark:bg-neutral-950/40"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-amber-800 dark:text-amber-400">
                      {ev.eventCategory} Event
                    </span>
                    <span className="font-mono tabular-nums">
                      {effectiveDate || 'Date TBD'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {ev.eventTitle}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-neutral-400 flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Clock className="w-3 h-3" />
                      {formatEventTime12h(effectiveTime)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">
                      {[effectiveVenue, effectiveCity].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200/80 dark:border-neutral-800 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-500">Countdown</span>
                  {countdown.hasDate ? (
                    <div className="text-right">
                      <span
                        className={`text-lg font-bold font-mono tabular-nums ${
                          countdown.isToday
                            ? 'text-emerald-600'
                            : countdown.isPast
                            ? 'text-slate-400'
                            : 'text-slate-900 dark:text-amber-400'
                        }`}
                      >
                        {countdown.isToday
                          ? 'Today!'
                          : countdown.isPast
                          ? `${countdown.days}d ago`
                          : `${countdown.days} Days`}
                      </span>
                      {!countdown.isPast && !countdown.isToday && (
                        <span className="text-xs font-mono text-slate-500 ml-1.5 tabular-nums">
                          {countdown.hours}h {countdown.minutes}m
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-mono">Set date to start</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 Summary KPI Cards (Single-Elevation Depth, Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
            <span>Tasks Due Today</span>
            <CheckSquare className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-2">
            {tasksDueToday.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {workspace.tasks.filter((t) => t.date === todayStr && t.status === 'Done').length} completed today
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
            <span>Overdue Tasks</span>
            <AlertTriangle className={`w-4 h-4 ${overdueTasks.length > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums mt-2 ${overdueTasks.length > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
            {overdueTasks.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {overdueTasks.length > 0 ? 'Requires immediate attention' : 'All past tasks settled'}
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
            <span>Completed This Week</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-2 text-emerald-700 dark:text-emerald-400">
            {completedThisWeek.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Of {workspace.tasks.length} total tasks
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
            <span>Upcoming Payments</span>
            <CreditCard className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-2">
            {formatCurrency(upcomingPaymentsTotal, workspace.currency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {unpaidStandalone.length + unpaidTaskPayments.length} pending bills/dues
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
            <span>Function Spend Used</span>
            <HeartHandshake className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-2">
            {expenseReport.percentBudgetUsed}%
          </div>
          <div className="text-xs text-slate-500 dark:text-neutral-400 mt-1 font-mono tabular-nums">
            {formatCurrency(expenseReport.totalActualSpent, workspace.currency)} spent
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Left = Today & Overdue Tasks, Right = Progress Chart & Function Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Cols: Today's & Overdue Tasks */}
        <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 pb-4">
            <div>
              <h2 className="text-lg font-bold font-display">Today & Priority Action Queue</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Check off completed tasks or click to inspect details
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Tasks</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {workspace.tasks.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                Your daily planner is fresh and empty.
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                Add your first task, meeting, visit appointment, or bill payment to start organizing
                your day.
              </p>
              <button
                type="button"
                onClick={onOpenNewTaskModal}
                className="mt-2 px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add your first task</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-neutral-800">
              {[...overdueTasks, ...tasksDueToday].slice(0, 8).map((task: TaskItem) => {
                const isOverdue = task.date < todayStr && task.status !== 'Done';
                return (
                  <div
                    key={task.id}
                    className="py-3.5 flex items-start justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-neutral-800/40 px-2 rounded-lg transition-colors"
                  >
                    <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={task.status === 'Done'}
                        onChange={() => onToggleTaskDone(task.id)}
                        className="mt-1 w-4 h-4 rounded border-stone-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-neutral-100 truncate">
                          {task.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 mt-1">
                          <span className="font-medium text-slate-700 dark:text-neutral-300">
                            {task.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              task.priority === 'High'
                                ? 'text-red-600 dark:text-red-400 font-medium'
                                : task.priority === 'Medium'
                                ? 'text-amber-700 dark:text-amber-400'
                                : ''
                            }
                          >
                            {task.priority} Priority
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-mono tabular-nums ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                            {isOverdue ? `Overdue (${task.date})` : task.date}
                          </span>
                          {task.startTime && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                <Clock className="w-3 h-3" />
                                {task.startTime}
                              </span>
                            </>
                          )}
                          {task.address && (
                            <>
                              <span aria-hidden="true">·</span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                  task.address
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-400 hover:underline"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>Open Map</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                    {task.amount > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-semibold tabular-nums">
                          {formatCurrency(task.amount, workspace.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {task.isPaid ? 'Paid' : 'Pending'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {overdueTasks.length === 0 && tasksDueToday.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  All tasks scheduled for today and earlier are complete!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 5 Cols: 7-Day Progress Chart + Engagement/Marriage Budget Card */}
        <div className="lg:col-span-5 space-y-6">
          {/* 7-Day Task Progress Chart */}
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-display">7-Day Schedule & Completion</h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Completed vs. pending tasks across the current week
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-slate-600 dark:text-neutral-400 hover:underline cursor-pointer"
              >
                Open Calendar
              </button>
            </div>

            <div className="pt-2 grid grid-cols-7 gap-2 items-end h-36">
              {next7DaysChart.map((col) => {
                const totalHeightPct = Math.round((col.total / maxDayTasks) * 100);
                const doneHeightPct =
                  col.total > 0 ? Math.round((col.doneCount / col.total) * totalHeightPct) : 0;
                const pendingHeightPct = totalHeightPct - doneHeightPct;

                return (
                  <div key={col.iso} className="flex flex-col items-center h-full justify-end gap-1.5">
                    <div className="w-full max-w-[28px] bg-stone-100 dark:bg-neutral-800 rounded-t-md h-24 flex flex-col justify-end overflow-hidden">
                      {pendingHeightPct > 0 && (
                        <div
                          style={{ height: `${pendingHeightPct}%` }}
                          className="w-full bg-amber-500/80 transition-all"
                          title={`${col.pendingCount} pending`}
                        />
                      )}
                      {doneHeightPct > 0 && (
                        <div
                          style={{ height: `${doneHeightPct}%` }}
                          className="w-full bg-emerald-600 transition-all"
                          title={`${col.doneCount} completed`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        col.isToday
                          ? 'font-bold text-slate-900 dark:text-amber-400 underline'
                          : 'text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {col.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-stone-100 dark:border-neutral-800">
              <span>Emerald: Done · Amber: Pending</span>
              <span className="font-mono tabular-nums">
                {workspace.tasks.filter((t) => t.status === 'Done').length}/{workspace.tasks.length} total done
              </span>
            </div>
          </div>

          {/* Engagement & Marriage Expense Snapshot */}
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-display">
                  Engagement & Marriage Budget Status
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {coupleTitle || 'No couple particulars entered yet'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('marriage')}
                className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Manage Ledger
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-neutral-400">Total Budget Used</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatCurrency(expenseReport.totalActualSpent, workspace.currency)} /{' '}
                  {formatCurrency(expenseReport.effectiveTotalBudget, workspace.currency)} (
                  {expenseReport.percentBudgetUsed}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-stone-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, expenseReport.percentBudgetUsed)}%` }}
                  className={`h-full transition-all ${
                    expenseReport.percentBudgetUsed > 100 ? 'bg-red-600' : 'bg-slate-900 dark:bg-amber-500'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-100 dark:border-neutral-800 text-xs">
              <div>
                <span className="text-slate-500 dark:text-neutral-400">Advance Paid</span>
                <div className="text-sm font-mono font-semibold tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(expenseReport.totalAdvancePaid, workspace.currency)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-neutral-400">Balance Due</span>
                <div className="text-sm font-mono font-semibold tabular-nums mt-0.5 text-amber-800 dark:text-amber-400">
                  {formatCurrency(expenseReport.totalBalanceDue, workspace.currency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
