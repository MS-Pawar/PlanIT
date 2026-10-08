import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency, getLocalTodayIso } from '../shared/calculations.ts';
import { PaymentMode, StandalonePayment, UserWorkspaceData } from '../shared/types.ts';

interface PaymentsViewProps {
  workspace: UserWorkspaceData;
  onUpdateWorkspace: (updater: (prev: UserWorkspaceData) => UserWorkspaceData) => void;
  showToast: (msg: string) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  workspace,
  onUpdateWorkspace,
  showToast,
}) => {
  const todayStr = getLocalTodayIso();

  const [payee, setPayee] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayStr);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all');

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payee.trim() || !amount) return;

    const newPayment: StandalonePayment = {
      id: `pay_${Date.now()}`,
      payee: payee.trim(),
      title: title.trim() || 'Bill / Vendor Payment',
      amount: Math.max(0, Number(amount) || 0),
      dueDate: dueDate || todayStr,
      paid: false,
      paymentMode,
      category: 'Payment/Bill',
      notes: '',
      createdAt: new Date().toISOString(),
    };

    onUpdateWorkspace((prev) => ({
      ...prev,
      payments: [newPayment, ...prev.payments],
    }));
    setPayee('');
    setTitle('');
    setAmount('');
    showToast('Payment added to tracker.');
  };

  const handleTogglePaid = (id: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      payments: prev.payments.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)),
    }));
  };

  const handleDeletePayment = (id: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== id),
    }));
    showToast('Payment entry removed.');
  };

  // Also show tasks that have payment amounts
  const paymentTasks = workspace.tasks.filter(
    (t) => t.category === 'Payment/Bill' || t.amount > 0
  );

  const totalUnpaid =
    workspace.payments.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0) +
    paymentTasks.filter((t) => !t.isPaid).reduce((s, t) => s + t.amount, 0);

  const totalPaid =
    workspace.payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0) +
    paymentTasks.filter((t) => t.isPaid).reduce((s, t) => s + t.amount, 0);

  const filteredStandalone = workspace.payments.filter((p) => {
    if (filterStatus === 'unpaid') return !p.paid;
    if (filterStatus === 'paid') return p.paid;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
            {workspace.customLabels.paymentsHeading || 'Payments & Bills Tracker'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Track payees, due dates, payment modes, and paid/unpaid status
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-neutral-800 rounded-lg">
          {(['all', 'unpaid', 'paid'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 text-xs font-semibold capitalize rounded-md cursor-pointer ${
                filterStatus === st
                  ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Total Pending / Unpaid</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-amber-800 dark:text-amber-400">
            {formatCurrency(totalUnpaid, workspace.currency)}
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Total Settled / Paid</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
            {formatCurrency(totalPaid, workspace.currency)}
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
          <div className="text-xs text-slate-500">Total Tracked Entries</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {workspace.payments.length + paymentTasks.length}
          </div>
        </div>
      </div>

      {/* Add Payment Form */}
      <form
        onSubmit={handleAddPayment}
        className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl grid grid-cols-1 sm:grid-cols-6 gap-3 items-center"
      >
        <input
          type="text"
          required
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder="Payee Name *"
          className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Particular / Bill Description"
          className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent sm:col-span-2"
        />
        <input
          type="number"
          required
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount *"
          className="px-3 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-2.5 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
          />
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            className="px-2.5 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
          >
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Card">Card</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Payment</span>
        </button>
      </form>

      {/* Payments Table */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-800/50 text-slate-500">
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Payee</th>
              <th className="py-3 px-4 font-semibold">Description</th>
              <th className="py-3 px-4 font-semibold">Due Date</th>
              <th className="py-3 px-4 font-semibold">Mode</th>
              <th className="py-3 px-4 font-semibold text-right">Amount</th>
              <th className="py-3 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
            {filteredStandalone.length === 0 && paymentTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  No payments recorded yet. Add your first bill or vendor payment above.
                </td>
              </tr>
            ) : (
              <>
                {filteredStandalone.map((p) => {
                  const isOverdue = !p.paid && p.dueDate < todayStr;
                  return (
                    <tr key={p.id} className="hover:bg-stone-50/70 dark:hover:bg-neutral-800/40">
                      <td className="py-3 px-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.paid}
                            onChange={() => handleTogglePaid(p.id)}
                            className="w-4 h-4 rounded"
                          />
                          <span
                            className={
                              p.paid
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1'
                                : 'text-amber-800 dark:text-amber-400 font-medium inline-flex items-center gap-1'
                            }
                          >
                            {p.paid ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" /> Unpaid
                              </>
                            )}
                          </span>
                        </label>
                      </td>
                      <td className="py-3 px-4 font-semibold">{p.payee}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-neutral-400">{p.title}</td>
                      <td
                        className={`py-3 px-4 font-mono tabular-nums ${
                          isOverdue ? 'text-red-600 font-semibold' : ''
                        }`}
                      >
                        {p.dueDate} {isOverdue ? '(Overdue)' : ''}
                      </td>
                      <td className="py-3 px-4">{p.paymentMode}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {formatCurrency(p.amount, workspace.currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id)}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
