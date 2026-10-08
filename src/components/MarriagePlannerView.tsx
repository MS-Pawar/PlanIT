import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  BellPlus,
  FolderKanban,
  FileSpreadsheet,
  MapPin,
  CalendarHeart,
  Clock,
  Mail,
} from 'lucide-react';
import {
  calculateEventCountdown,
  calculateExpenseReport,
  calculateLineItemMetrics,
  createDefaultSubEvents,
  formatCurrency,
  formatEventTime12h,
} from '../shared/calculations.ts';
import {
  EventParticulars,
  EventTabScope,
  ExpenseCategoryItem,
  ExpenseLineItem,
  StandalonePayment,
  TaskItem,
  UserWorkspaceData,
  VendorItem,
} from '../shared/types.ts';
import { FormalInvitationStudio } from './FormalInvitationStudio.tsx';

interface MarriagePlannerViewProps {
  workspace: UserWorkspaceData;
  onUpdateWorkspace: (updater: (prev: UserWorkspaceData) => UserWorkspaceData) => void;
  showToast: (msg: string) => void;
  onNavigateToReports: () => void;
  sessionToken: string | null;
}

type SubModuleTab =
  | 'marriage_ledger'
  | 'engagement_ledger'
  | 'invitations'
  | 'guests'
  | 'particulars'
  | 'categories'
  | 'vendors';

export const MarriagePlannerView: React.FC<MarriagePlannerViewProps> = ({
  workspace,
  onUpdateWorkspace,
  showToast,
  onNavigateToReports,
  sessionToken,
}) => {
  const [subTab, setSubTab] = useState<SubModuleTab>('marriage_ledger');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overbudget'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Category Draft
  const [newCatName, setNewCatName] = useState('');

  // New Line Item Quick Draft
  const [draftParticular, setDraftParticular] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState(
    workspace.marriageCategories[0]?.id || 'cat_1'
  );
  const [draftVendor, setDraftVendor] = useState('');
  const [draftVendorContact, setDraftVendorContact] = useState('');
  const [draftBudget, setDraftBudget] = useState('');
  const [draftActual, setDraftActual] = useState('');
  const [draftAdvance, setDraftAdvance] = useState('');
  const [draftDueDate, setDraftDueDate] = useState('');

  // Vendor Draft
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState(
    workspace.marriageCategories[0]?.name || 'Venue & Hall'
  );
  const [vendorPerson, setVendorPerson] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorContracted, setVendorContracted] = useState('');

  const activeScope: EventTabScope =
    subTab === 'engagement_ledger' ? 'Engagement' : 'Marriage';

  const activeParticulars: EventParticulars =
    activeScope === 'Engagement'
      ? workspace.engagementParticulars
      : workspace.eventParticulars;

  const subEvents = useMemo(
    () =>
      workspace.subEvents && workspace.subEvents.length > 0
        ? workspace.subEvents
        : createDefaultSubEvents(),
    [workspace.subEvents]
  );

  const scopedItems = useMemo(
    () =>
      workspace.expenseItems
        .filter((item) => item.scope === activeScope)
        .sort((a, b) => a.order - b.order),
    [workspace.expenseItems, activeScope]
  );

  const report = useMemo(
    () =>
      calculateExpenseReport(
        workspace.marriageCategories,
        scopedItems,
        Number(activeParticulars.totalBudget) || 0
      ),
    [workspace.marriageCategories, scopedItems, activeParticulars.totalBudget]
  );

  const filteredItems = useMemo(() => {
    return scopedItems.filter((item) => {
      if (catFilter !== 'All' && item.categoryId !== catFilter) return false;
      const metrics = calculateLineItemMetrics(item);
      if (statusFilter === 'paid' && !item.isPaid) return false;
      if (statusFilter === 'pending' && item.isPaid) return false;
      if (statusFilter === 'overbudget' && !metrics.isOverBudget) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.particular} ${item.categoryName} ${item.vendorName} ${item.vendorContact} ${item.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopedItems, catFilter, statusFilter, searchQuery]);

  // Add a new line item row
  const handleAddLineItem = (e?: React.FormEvent, customCatId?: string) => {
    if (e) e.preventDefault();
    const targetCatId =
      customCatId || draftCategoryId || workspace.marriageCategories[0]?.id || 'cat_1';
    const catObj = workspace.marriageCategories.find((c) => c.id === targetCatId);

    const newItem: ExpenseLineItem = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      scope: activeScope,
      particular: draftParticular.trim() || `New ${catObj?.name || 'Expense'} Item`,
      categoryId: targetCatId,
      categoryName: catObj?.name || 'Miscellaneous',
      vendorName: draftVendor.trim(),
      vendorContact: draftVendorContact.trim(),
      budgetedAmount: Math.max(0, Number(draftBudget) || 0),
      actualSpent: Math.max(0, Number(draftActual) || 0),
      advancePaid: Math.max(0, Number(draftAdvance) || 0),
      dueDate: draftDueDate || '',
      isPaid: false,
      notes: '',
      order: workspace.expenseItems.length,
    };

    onUpdateWorkspace((prev) => ({
      ...prev,
      expenseItems: [...prev.expenseItems, newItem],
    }));

    setDraftParticular('');
    setDraftVendor('');
    setDraftVendorContact('');
    setDraftBudget('');
    setDraftActual('');
    setDraftAdvance('');
    setDraftDueDate('');
    showToast(`Added expense line item to ${activeScope} tracker.`);
  };

  // Inline update of any field on a line item
  const handleUpdateLineItem = (id: string, patch: Partial<ExpenseLineItem>) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      expenseItems: prev.expenseItems.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.categoryId) {
          const foundCat = prev.marriageCategories.find((c) => c.id === patch.categoryId);
          if (foundCat) next.categoryName = foundCat.name;
        }
        return next;
      }),
    }));
  };

  const handleDeleteLineItem = (id: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      expenseItems: prev.expenseItems.filter((item) => item.id !== id),
    }));
    showToast('Expense line item deleted.');
  };

  // Link expense balance reminder to main To-Do list & Payments tracker
  const handleLinkToPlanner = (item: ExpenseLineItem) => {
    const metrics = calculateLineItemMetrics(item);
    const dueAmt = metrics.balanceDue > 0 ? metrics.balanceDue : metrics.budgeted;
    const dueDate = item.dueDate || new Date().toISOString().split('T')[0];

    const newTask: TaskItem = {
      id: `task_wed_${Date.now()}`,
      title: `[${item.scope}] Pay ${item.particular} (${item.vendorName || item.categoryName})`,
      description: `Wedding expense reminder from ${item.scope} Ledger.`,
      category: 'Payment/Bill',
      priority: 'High',
      date: dueDate,
      startTime: '11:00',
      endTime: '',
      location: '',
      status: item.isPaid ? 'Done' : 'Pending',
      tags: [item.scope.toLowerCase(), 'wedding-expense'],
      notes: item.notes,
      attachmentName: '',
      recurrence: 'None',
      subtasks: [],
      reminderAt: '10:00',
      emailReminder: false,
      attendees: item.vendorName,
      contactPhone: item.vendorContact,
      address: '',
      payee: item.vendorName || item.particular,
      amount: dueAmt,
      paymentMode: 'Bank Transfer',
      isPaid: item.isPaid,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newPayment: StandalonePayment = {
      id: `pay_wed_${Date.now()}`,
      payee: item.vendorName || item.particular,
      title: `${item.scope}: ${item.particular}`,
      amount: dueAmt,
      dueDate,
      paid: item.isPaid,
      paymentMode: 'Bank Transfer',
      category: item.categoryName,
      notes: item.notes,
      linkedExpenseId: item.id,
      createdAt: new Date().toISOString(),
    };

    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
      payments: [newPayment, ...prev.payments],
    }));

    showToast('Payment reminder linked to Daily Planner & Payments Tracker.');
  };

  // Update Event Particulars AND keep Formal Invitation subEvents in sync
  const handleUpdateParticulars = (
    target: 'Marriage' | 'Engagement',
    patch: Partial<EventParticulars>
  ) => {
    onUpdateWorkspace((prev) => {
      const nextEngagement =
        target === 'Engagement'
          ? { ...prev.engagementParticulars, ...patch }
          : prev.engagementParticulars;
      const nextMarriage =
        target === 'Marriage' ? { ...prev.eventParticulars, ...patch } : prev.eventParticulars;

      const baseSubEvents =
        prev.subEvents && prev.subEvents.length > 0
          ? prev.subEvents
          : createDefaultSubEvents();

      const syncedSubEvents = baseSubEvents.map((ev) => {
        const updatedEv = { ...ev };
        if (patch.brideName !== undefined) updatedEv.brideName = patch.brideName;
        if (patch.groomName !== undefined) updatedEv.groomName = patch.groomName;
        if (patch.brideFamily !== undefined) updatedEv.brideFamily = patch.brideFamily;
        if (patch.groomFamily !== undefined) updatedEv.groomFamily = patch.groomFamily;

        if (target === 'Engagement' && ev.eventCategory === 'Engagement') {
          if (patch.engagementDate !== undefined) updatedEv.eventDate = patch.engagementDate;
          if (patch.engagementTime !== undefined) updatedEv.eventTime = patch.engagementTime;
          if (patch.venue !== undefined) updatedEv.venue = patch.venue;
          if (patch.city !== undefined) updatedEv.city = patch.city;
        }
        if (target === 'Marriage' && ev.eventCategory === 'Marriage') {
          if (patch.marriageDate !== undefined) updatedEv.eventDate = patch.marriageDate;
          if (patch.marriageTime !== undefined) updatedEv.eventTime = patch.marriageTime;
          if (patch.venue !== undefined) updatedEv.venue = patch.venue;
          if (patch.city !== undefined) updatedEv.city = patch.city;
        }
        return updatedEv;
      });

      return {
        ...prev,
        engagementParticulars: nextEngagement,
        eventParticulars: nextMarriage,
        subEvents: syncedSubEvents,
      };
    });
  };

  // Category CRUD & Reordering
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat: ExpenseCategoryItem = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      order: workspace.marriageCategories.length,
    };
    onUpdateWorkspace((prev) => ({
      ...prev,
      marriageCategories: [...prev.marriageCategories, newCat],
    }));
    setNewCatName('');
    showToast(`Expense category "${newCat.name}" added.`);
  };

  const handleRenameCategory = (id: string, name: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      marriageCategories: prev.marriageCategories.map((c) => (c.id === id ? { ...c, name } : c)),
      expenseItems: prev.expenseItems.map((item) =>
        item.categoryId === id ? { ...item, categoryName: name } : item
      ),
    }));
  };

  const handleMoveCategory = (id: string, dir: 'up' | 'down') => {
    onUpdateWorkspace((prev) => {
      const sorted = [...prev.marriageCategories].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev;
      const temp = sorted[idx];
      sorted[idx] = sorted[targetIdx];
      sorted[targetIdx] = temp;
      return {
        ...prev,
        marriageCategories: sorted.map((c, i) => ({ ...c, order: i })),
      };
    });
  };

  const handleDeleteCategory = (id: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      marriageCategories: prev.marriageCategories.filter((c) => c.id !== id),
    }));
    showToast('Category removed.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
            {workspace.customLabels.marriageHeading ||
              'Engagement & Marriage Expense Planner'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {workspace.eventParticulars.brideName && workspace.eventParticulars.groomName
              ? `${workspace.eventParticulars.brideName} & ${workspace.eventParticulars.groomName} · ${
                  workspace.eventParticulars.city || 'Venue TBD'
                }`
              : 'Configure couple particulars, countdowns, formal invitations, and track every function expense'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('invitations')}
            className="px-3.5 py-2 border border-stone-300 dark:border-neutral-700 text-xs font-semibold rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Mail className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>Formal Invitations</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToReports}
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Final Expense Report &amp; Charts</span>
          </button>
        </div>
      </div>

      {/* Top Live Countdown & Couple Event Details Banner (Shown when not inside FormalInvitationStudio which has its own selector) */}
      {subTab !== 'invitations' && subTab !== 'guests' && (
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
              'Venue TBD';
            const effectiveCity =
              ev.city ||
              (ev.eventCategory === 'Engagement'
                ? workspace.engagementParticulars.city
                : workspace.eventParticulars.city) ||
              '';
            const bride =
              ev.brideName ||
              workspace.eventParticulars.brideName ||
              workspace.engagementParticulars.brideName ||
              'Bride';
            const groom =
              ev.groomName ||
              workspace.eventParticulars.groomName ||
              workspace.engagementParticulars.groomName ||
              'Groom';

            const cd = calculateEventCountdown(effectiveDate, effectiveTime);

            return (
              <div
                key={ev.id}
                onClick={() => setSubTab('invitations')}
                className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 hover:border-stone-300 rounded-xl flex flex-col justify-between gap-2.5 cursor-pointer transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-800 dark:text-amber-400">
                      {ev.eventCategory}: {ev.eventTitle}
                    </span>
                  </div>
                  <div className="text-sm font-bold font-display text-slate-900 dark:text-white">
                    {bride} &amp; {groom}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono tabular-nums">{effectiveDate || 'Date TBD'}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 font-mono tabular-nums">
                      <Clock className="w-3 h-3" /> {formatEventTime12h(effectiveTime)}
                    </span>
                    <span>·</span>
                    <span className="truncate">
                      {[effectiveVenue, effectiveCity].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Countdown Days</span>
                  <span
                    className={`text-sm font-bold font-mono tabular-nums ${
                      cd.isToday
                        ? 'text-emerald-600'
                        : cd.isPast
                        ? 'text-slate-400'
                        : 'text-slate-900 dark:text-amber-400'
                    }`}
                  >
                    {cd.hasDate
                      ? cd.isToday
                        ? 'Happening Today!'
                        : cd.isPast
                        ? `${cd.days} days ago`
                        : `${cd.days} Days · ${cd.hours}h ${cd.minutes}m`
                      : 'Set Event Date'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-200/70 dark:bg-neutral-800 rounded-lg">
        {[
          { id: 'marriage_ledger', label: 'Marriage Expense Ledger' },
          { id: 'engagement_ledger', label: 'Engagement Expense Ledger' },
          { id: 'invitations', label: 'Formal Invitations & Events' },
          { id: 'guests', label: `Guest List & Send Invites (${workspace.guests.length})` },
          { id: 'particulars', label: 'Event & Couple Particulars' },
          { id: 'categories', label: `Expense Categories (${workspace.marriageCategories.length})` },
          { id: 'vendors', label: `Vendor Directory (${workspace.vendors.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as SubModuleTab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === t.id
                ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: FORMAL INVITATIONS & GUEST DISPATCH STUDIO */}
      {(subTab === 'invitations' || subTab === 'guests') && (
        <FormalInvitationStudio
          workspace={workspace}
          onUpdateWorkspace={onUpdateWorkspace}
          showToast={showToast}
          sessionToken={sessionToken}
          mode={subTab === 'invitations' ? 'invitations' : 'guests'}
          onSwitchMode={(m) => setSubTab(m)}
        />
      )}

      {/* TAB 1 & 2: MARRIAGE OR ENGAGEMENT EXPENSE LEDGER */}
      {(subTab === 'marriage_ledger' || subTab === 'engagement_ledger') && (
        <div className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-[11px] text-slate-500">
                {activeScope} Target Budget
              </div>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={activeParticulars.totalBudget || ''}
                  onChange={(e) =>
                    handleUpdateParticulars(activeScope, {
                      totalBudget: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  placeholder="Set Budget..."
                  className="w-full text-base font-bold font-mono tabular-nums bg-stone-50 dark:bg-neutral-800 px-2 py-1 rounded border border-stone-200 dark:border-neutral-700"
                />
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-[11px] text-slate-500">
                {workspace.customLabels.budgetLabel || 'Budgeted Items Sum'}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums mt-1.5">
                {formatCurrency(report.totalAllocatedBudget, workspace.currency)}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-[11px] text-slate-500">
                {workspace.customLabels.actualSpentLabel || 'Actual Spent'}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums mt-1.5">
                {formatCurrency(report.totalActualSpent, workspace.currency)}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {report.percentBudgetUsed}% of budget used
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-[11px] text-slate-500">
                {workspace.customLabels.advancePaidLabel || 'Advance Paid'}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums mt-1.5 text-emerald-700 dark:text-emerald-400">
                {formatCurrency(report.totalAdvancePaid, workspace.currency)}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-[11px] text-slate-500">
                {workspace.customLabels.balanceDueLabel || 'Balance Due'}
              </div>
              <div className="text-lg font-bold font-mono tabular-nums mt-1.5 text-amber-800 dark:text-amber-400">
                {formatCurrency(report.totalBalanceDue, workspace.currency)}
              </div>
              <div className="text-[11px] text-slate-500">
                {report.totalPendingPaymentsCount} pending item(s)
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-[11px] text-slate-500">Net Variance (Budget - Actual)</div>
              <div
                className={`text-lg font-bold font-mono tabular-nums mt-1.5 ${
                  report.totalVariance < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(report.totalVariance, workspace.currency)}
              </div>
              <div className="text-[11px] text-slate-500">
                {report.overBudgetItemsCount > 0
                  ? `${report.overBudgetItemsCount} item(s) over budget`
                  : 'Within planned limits'}
              </div>
            </div>
          </div>

          {/* Add Expense Line Item Form */}
          <form
            onSubmit={handleAddLineItem}
            className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                Add New {activeScope} Expense Line Item
              </span>
              <span className="text-[11px] text-slate-500">
                All cells remain inline-editable in the table below
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-2.5">
              <input
                type="text"
                required
                value={draftParticular}
                onChange={(e) => setDraftParticular(e.target.value)}
                placeholder="Item / Particular *"
                className="lg:col-span-2 px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
              />
              <select
                value={draftCategoryId}
                onChange={(e) => setDraftCategoryId(e.target.value)}
                className="px-2.5 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
              >
                {workspace.marriageCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={draftVendor}
                onChange={(e) => setDraftVendor(e.target.value)}
                placeholder="Vendor Name"
                className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
              />
              <input
                type="number"
                min="0"
                value={draftBudget}
                onChange={(e) => setDraftBudget(e.target.value)}
                placeholder="Budgeted Amt"
                className="px-3 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
              />
              <input
                type="number"
                min="0"
                value={draftActual}
                onChange={(e) => setDraftActual(e.target.value)}
                placeholder="Actual Spent"
                className="px-3 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
              />
              <input
                type="number"
                min="0"
                value={draftAdvance}
                onChange={(e) => setDraftAdvance(e.target.value)}
                placeholder="Advance Paid"
                className="px-3 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Row</span>
              </button>
            </div>
          </form>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg"
              >
                <option value="All">All 14+ Expense Categories</option>
                {workspace.marriageCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-neutral-800 rounded-lg">
                {(
                  [
                    { id: 'all', label: 'All Items' },
                    { id: 'pending', label: 'Pending Payment' },
                    { id: 'paid', label: 'Paid / Done' },
                    { id: 'overbudget', label: 'Over-Budget Only' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                      statusFilter === st.id
                        ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-neutral-400'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter items or vendors..."
              className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg"
            />
          </div>

          {/* Line-Item Tracker Table (Inline Editable) */}
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-800/60 text-slate-600 dark:text-neutral-300">
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">Paid / Done</th>
                  <th className="py-3 px-3 font-semibold min-w-[180px]">Item / Particular</th>
                  <th className="py-3 px-3 font-semibold min-w-[160px]">Category</th>
                  <th className="py-3 px-3 font-semibold min-w-[150px]">Vendor &amp; Contact</th>
                  <th className="py-3 px-3 font-semibold text-right min-w-[115px]">
                    {workspace.customLabels.budgetLabel || 'Budgeted'}
                  </th>
                  <th className="py-3 px-3 font-semibold text-right min-w-[115px]">
                    {workspace.customLabels.actualSpentLabel || 'Actual Spent'}
                  </th>
                  <th className="py-3 px-3 font-semibold text-right min-w-[115px]">
                    Variance (B - A)
                  </th>
                  <th className="py-3 px-3 font-semibold text-right min-w-[115px]">
                    {workspace.customLabels.advancePaidLabel || 'Advance Paid'}
                  </th>
                  <th className="py-3 px-3 font-semibold text-right min-w-[115px]">
                    {workspace.customLabels.balanceDueLabel || 'Balance Due'}
                  </th>
                  <th className="py-3 px-3 font-semibold min-w-[125px]">Due Date</th>
                  <th className="py-3 px-3 font-semibold min-w-[140px]">Notes</th>
                  <th className="py-3 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center space-y-3">
                      <div className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                        No expense line items recorded in {activeScope} yet.
                      </div>
                      <p className="text-xs text-slate-500 max-w-lg mx-auto">
                        All 14 wedding expense categories are ready as empty templates with zero
                        pre-filled amounts. Use the row creator above or click a category below to
                        add your first expense item.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 max-w-3xl mx-auto px-4">
                        {workspace.marriageCategories.slice(0, 7).map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleAddLineItem(undefined, cat.id)}
                            className="px-2.5 py-1 text-xs border border-stone-300 dark:border-neutral-700 rounded-md hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer"
                          >
                            + Add {cat.name}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const metrics = calculateLineItemMetrics(item);
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          metrics.isOverBudget
                            ? 'bg-red-50/70 dark:bg-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/50'
                            : 'hover:bg-stone-50/70 dark:hover:bg-neutral-800/40'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.isPaid}
                              onChange={(e) =>
                                handleUpdateLineItem(item.id, { isPaid: e.target.checked })
                              }
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                            <span
                              className={`text-[11px] font-semibold ${
                                item.isPaid
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-800 dark:text-amber-400'
                              }`}
                            >
                              {item.isPaid ? 'Paid' : 'Pending'}
                            </span>
                          </label>
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.particular}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, { particular: e.target.value })
                            }
                            className="w-full px-2 py-1 font-medium bg-transparent border border-transparent hover:border-stone-300 focus:border-slate-900 rounded"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <select
                            value={item.categoryId}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, { categoryId: e.target.value })
                            }
                            className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-stone-300 focus:border-slate-900 rounded"
                          >
                            {workspace.marriageCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-2.5 px-3 space-y-1">
                          <input
                            type="text"
                            value={item.vendorName}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, { vendorName: e.target.value })
                            }
                            placeholder="Vendor name"
                            className="w-full px-2 py-0.5 bg-transparent border border-transparent hover:border-stone-300 focus:border-slate-900 rounded"
                          />
                          <input
                            type="text"
                            value={item.vendorContact}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, { vendorContact: e.target.value })
                            }
                            placeholder="Phone / contact"
                            className="w-full px-2 py-0.5 text-[11px] font-mono text-slate-500 bg-transparent border border-transparent hover:border-stone-300 focus:border-slate-900 rounded"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.budgetedAmount || ''}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, {
                                budgetedAmount: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0"
                            className="w-24 text-right px-2 py-1 font-mono tabular-nums bg-transparent border border-stone-200 dark:border-neutral-700 rounded"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.actualSpent || ''}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, {
                                actualSpent: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0"
                            className="w-24 text-right px-2 py-1 font-mono tabular-nums bg-transparent border border-stone-200 dark:border-neutral-700 rounded"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <div
                            className={`font-semibold ${
                              metrics.isOverBudget
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {metrics.variance >= 0 ? '+' : ''}
                            {formatCurrency(metrics.variance, workspace.currency)}
                          </div>
                          {metrics.isOverBudget && (
                            <div className="inline-flex items-center gap-0.5 text-[10px] font-sans font-bold text-red-600 dark:text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Over Budget</span>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.advancePaid || ''}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, {
                                advancePaid: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0"
                            className="w-24 text-right px-2 py-1 font-mono tabular-nums bg-transparent border border-stone-200 dark:border-neutral-700 rounded"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                          <span
                            className={
                              metrics.balanceDue > 0
                                ? 'text-amber-800 dark:text-amber-400'
                                : 'text-slate-400'
                            }
                          >
                            {formatCurrency(metrics.balanceDue, workspace.currency)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="date"
                            value={item.dueDate}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, { dueDate: e.target.value })
                            }
                            className="px-2 py-1 font-mono text-[11px] bg-transparent border border-stone-200 dark:border-neutral-700 rounded tabular-nums"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, { notes: e.target.value })
                            }
                            placeholder="Add note..."
                            className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-stone-300 focus:border-slate-900 rounded"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleLinkToPlanner(item)}
                            title="Add Payment Reminder to Daily Planner & Payments"
                            className="p-1.5 text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-neutral-800 rounded mr-1 cursor-pointer"
                          >
                            <BellPlus className="w-4 h-4 inline" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLineItem(item.id)}
                            title="Delete row"
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: EVENT & COUPLE PARTICULARS (All fields editable + syncs with Formal Invitations) */}
      {subTab === 'particulars' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(['Marriage', 'Engagement'] as const).map((scope) => {
            const data =
              scope === 'Engagement'
                ? workspace.engagementParticulars
                : workspace.eventParticulars;
            const dateVal = scope === 'Engagement' ? data.engagementDate : data.marriageDate;
            const timeVal = scope === 'Engagement' ? data.engagementTime : data.marriageTime;
            const cd = calculateEventCountdown(dateVal, timeVal);

            return (
              <div
                key={scope}
                className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 pb-3">
                  <div>
                    <h2 className="text-lg font-bold font-display">
                      {scope} Function Particulars
                    </h2>
                    <p className="text-xs text-slate-500">
                      Auto-syncs with your {scope} Formal Invitation &amp; PDF/Excel Reports
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 tabular-nums">
                    {cd.statusText}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-medium mb-1">
                      {workspace.customLabels.brideLabel || "Bride's Full Name"}
                    </label>
                    <input
                      type="text"
                      value={data.brideName}
                      onChange={(e) =>
                        handleUpdateParticulars(scope, { brideName: e.target.value })
                      }
                      placeholder="Enter Bride's Name"
                      className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">
                      {workspace.customLabels.groomLabel || "Groom's Full Name"}
                    </label>
                    <input
                      type="text"
                      value={data.groomName}
                      onChange={(e) =>
                        handleUpdateParticulars(scope, { groomName: e.target.value })
                      }
                      placeholder="Enter Groom's Name"
                      className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Bride's Family Details</label>
                    <input
                      type="text"
                      value={data.brideFamily}
                      onChange={(e) =>
                        handleUpdateParticulars(scope, { brideFamily: e.target.value })
                      }
                      placeholder="Parents / Family Name"
                      className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Groom's Family Details</label>
                    <input
                      type="text"
                      value={data.groomFamily}
                      onChange={(e) =>
                        handleUpdateParticulars(scope, { groomFamily: e.target.value })
                      }
                      placeholder="Parents / Family Name"
                      className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Function Date</label>
                    <input
                      type="date"
                      value={dateVal || ''}
                      onChange={(e) =>
                        handleUpdateParticulars(
                          scope,
                          scope === 'Engagement'
                            ? { engagementDate: e.target.value }
                            : { marriageDate: e.target.value }
                        )
                      }
                      className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Function Time</label>
                    <input
                      type="time"
                      value={timeVal || ''}
                      onChange={(e) =>
                        handleUpdateParticulars(
                          scope,
                          scope === 'Engagement'
                            ? { engagementTime: e.target.value }
                            : { marriageTime: e.target.value }
                        )
                      }
                      className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">
                      {workspace.customLabels.venueLabel || 'Venue & Hall'}
                    </label>
                    <input
                      type="text"
                      value={data.venue}
                      onChange={(e) => handleUpdateParticulars(scope, { venue: e.target.value })}
                      placeholder="Hotel / Banquet / Lawn Name"
                      className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">City</label>
                    <input
                      type="text"
                      value={data.city}
                      onChange={(e) => handleUpdateParticulars(scope, { city: e.target.value })}
                      placeholder="City"
                      className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Expected Guest Count</label>
                    <input
                      type="number"
                      min="0"
                      value={data.guestCount || ''}
                      onChange={(e) =>
                        handleUpdateParticulars(scope, {
                          guestCount: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      placeholder="e.g., 350"
                      className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">
                      Total Planned {scope} Budget ({workspace.currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={data.totalBudget || ''}
                      onChange={(e) =>
                        handleUpdateParticulars(scope, {
                          totalBudget: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 font-mono text-sm font-semibold border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-medium mb-1">Event Notes &amp; Muhurtham Timings</label>
                    <textarea
                      rows={3}
                      value={data.notes}
                      onChange={(e) => handleUpdateParticulars(scope, { notes: e.target.value })}
                      placeholder="Key ceremony timings, hospitality notes, or family responsibilities..."
                      className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: EXPENSE CATEGORIES MANAGER */}
      {subTab === 'categories' && (
        <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-neutral-800 pb-4">
            <div>
              <h2 className="text-lg font-bold font-display flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-amber-700" />
                <span>Manage Marriage &amp; Engagement Expense Categories</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Rename any category inline, reorder priority up/down, add custom categories, or
                remove unused ones.
              </p>
            </div>

            <form onSubmit={handleAddCategory} className="flex items-center gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name..."
                className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
              >
                + Add Category
              </button>
            </form>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-neutral-800">
            {[...workspace.marriageCategories]
              .sort((a, b) => a.order - b.order)
              .map((cat, index) => {
                const count = workspace.expenseItems.filter(
                  (i) => i.categoryId === cat.id
                ).length;
                return (
                  <div
                    key={cat.id}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-neutral-800/40 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xs font-mono text-slate-400 w-6 tabular-nums">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={cat.name}
                        onChange={(e) => handleRenameCategory(cat.id, e.target.value)}
                        className="flex-1 max-w-md px-2.5 py-1.5 text-xs font-semibold border border-stone-200 dark:border-neutral-700 rounded-lg bg-transparent"
                      />
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        {count} line item(s)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(cat.id, 'up')}
                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCategory(cat.id, 'down')}
                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="Move down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB: VENDOR DIRECTORY */}
      {subTab === 'vendors' && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!vendorName.trim()) return;
              const newVendor: VendorItem = {
                id: `vnd_${Date.now()}`,
                name: vendorName.trim(),
                category: vendorCategory,
                contactPerson: vendorPerson.trim(),
                phone: vendorPhone.trim(),
                email: '',
                address: vendorAddress.trim(),
                contractedAmount: Math.max(0, Number(vendorContracted) || 0),
                notes: '',
              };
              onUpdateWorkspace((prev) => ({
                ...prev,
                vendors: [newVendor, ...prev.vendors],
              }));
              setVendorName('');
              setVendorPerson('');
              setVendorPhone('');
              setVendorAddress('');
              setVendorContracted('');
              showToast('Vendor saved to directory.');
            }}
            className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl grid grid-cols-1 sm:grid-cols-6 gap-2.5"
          >
            <input
              type="text"
              required
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor Business Name *"
              className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
            />
            <select
              value={vendorCategory}
              onChange={(e) => setVendorCategory(e.target.value)}
              className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
            >
              {workspace.marriageCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={vendorPerson}
              onChange={(e) => setVendorPerson(e.target.value)}
              placeholder="Contact Person"
              className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
            />
            <input
              type="text"
              value={vendorPhone}
              onChange={(e) => setVendorPhone(e.target.value)}
              placeholder="Phone Number"
              className="px-3 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
            />
            <input
              type="text"
              value={vendorAddress}
              onChange={(e) => setVendorAddress(e.target.value)}
              placeholder="City / Address (Map Link)"
              className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              + Add Vendor
            </button>
          </form>

          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-800/50 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Vendor Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Contact Person</th>
                  <th className="py-3 px-4 font-semibold">Phone</th>
                  <th className="py-3 px-4 font-semibold">Address / Map</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
                {workspace.vendors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No vendors saved yet. Add your caterers, decorators, and photographers above.
                    </td>
                  </tr>
                ) : (
                  workspace.vendors.map((v) => (
                    <tr key={v.id}>
                      <td className="py-3 px-4 font-semibold">{v.name}</td>
                      <td className="py-3 px-4">{v.category}</td>
                      <td className="py-3 px-4">{v.contactPerson || '—'}</td>
                      <td className="py-3 px-4 font-mono">{v.phone || '—'}</td>
                      <td className="py-3 px-4">
                        {v.address ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              v.address
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-400 hover:underline"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{v.address}</span>
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateWorkspace((prev) => ({
                              ...prev,
                              vendors: prev.vendors.filter((item) => item.id !== v.id),
                            }))
                          }
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
