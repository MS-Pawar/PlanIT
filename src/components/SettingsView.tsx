import React, { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  Trash2,
  CheckCircle2,
  FlaskConical,
  Sun,
  Moon,
  Coins,
  Tag,
} from 'lucide-react';
import {
  createDemoWorkspace,
  createEmptyWorkspace,
  DEFAULT_CUSTOM_LABELS,
  formatCurrency,
} from '../shared/calculations.ts';
import { CurrencyCode, CustomLabels, UserWorkspaceData } from '../shared/types.ts';

interface SettingsViewProps {
  workspace: UserWorkspaceData;
  onUpdateWorkspace: (updater: (prev: UserWorkspaceData) => UserWorkspaceData) => void;
  showToast: (msg: string) => void;
}

interface TestSuiteResult {
  passed: number;
  total: number;
  allPassed: boolean;
  results: { suite: string; name: string; status: 'PASS' | 'FAIL'; details: string }[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  workspace,
  onUpdateWorkspace,
  showToast,
}) => {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [testReport, setTestReport] = useState<TestSuiteResult | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const handleLabelChange = (key: keyof CustomLabels, value: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      customLabels: {
        ...prev.customLabels,
        [key]: value,
      },
    }));
  };

  const handleResetLabels = () => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      customLabels: { ...DEFAULT_CUSTOM_LABELS },
    }));
    showToast('All labels and headings reset to default.');
  };

  const handleLoadDemoData = () => {
    const demo = createDemoWorkspace();
    onUpdateWorkspace((prev) => ({
      ...demo,
      currency: prev.currency,
      theme: prev.theme,
    }));
    showToast('Sample demo data loaded. You can edit or clear it anytime.');
  };

  const handleClearAllData = () => {
    const fresh = createEmptyWorkspace();
    onUpdateWorkspace((prev) => ({
      ...fresh,
      currency: prev.currency,
      theme: prev.theme,
    }));
    setConfirmResetOpen(false);
    showToast('Workspace reset to a completely fresh, blank state.');
  };

  const handleRunAutomatedTests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/tests/run');
      const data = await res.json();
      setTestReport(data);
      showToast(`Ran ${data.total} automated tests: ${data.passed}/${data.total} passed.`);
    } catch {
      showToast('Failed to run automated test suite.');
    } finally {
      setRunningTests(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-stone-200 dark:border-neutral-800">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
          {workspace.customLabels.settingsHeading || 'Workspace Customization & Settings'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
          Configure currency formatting, theme, custom UI headings, optional demo data, and
          automated verification tests
        </p>
      </div>

      {/* 1. Currency & Theme Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-base font-bold font-display">
            <Coins className="w-4 h-4 text-amber-700" />
            <span>Currency & Number Formatting</span>
          </div>
          <p className="text-xs text-slate-500">
            Default is INR (₹) with Indian numbering system ({formatCurrency(1250000, 'INR')}).
          </p>
          <select
            value={workspace.currency}
            onChange={(e) => {
              const nextCurr = e.target.value as CurrencyCode;
              onUpdateWorkspace((prev) => ({ ...prev, currency: nextCurr }));
              showToast(`Currency updated to ${nextCurr}.`);
            }}
            className="w-full px-3 py-2 text-xs font-semibold border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
          >
            <option value="INR">INR (₹) — Indian Rupee (e.g., ₹12,50,000)</option>
            <option value="USD">USD ($) — US Dollar (e.g., $1,250,000)</option>
            <option value="EUR">EUR (€) — Euro</option>
            <option value="GBP">GBP (£) — British Pound</option>
            <option value="AED">AED (د.إ) — UAE Dirham</option>
            <option value="SGD">SGD (S$) — Singapore Dollar</option>
          </select>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-base font-bold font-display">
            {workspace.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-600" />
            )}
            <span>Appearance & Theme</span>
          </div>
          <p className="text-xs text-slate-500">
            Switch between warm daylight paper and high-contrast dark slate mode.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateWorkspace((prev) => ({ ...prev, theme: 'light' }))}
              className={`flex-1 py-2 px-4 text-xs font-semibold rounded-lg border cursor-pointer ${
                workspace.theme === 'light'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-stone-300 dark:border-neutral-700'
              }`}
            >
              Light Mode
            </button>
            <button
              type="button"
              onClick={() => onUpdateWorkspace((prev) => ({ ...prev, theme: 'dark' }))}
              className={`flex-1 py-2 px-4 text-xs font-semibold rounded-lg border cursor-pointer ${
                workspace.theme === 'dark'
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'border-stone-300 dark:border-neutral-700'
              }`}
            >
              Dark Mode
            </button>
          </div>
        </div>
      </div>

      {/* 2. Editable Labels, Headings & Field Names */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-neutral-800 pb-4">
          <div>
            <h2 className="text-base font-bold font-display flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-700" />
              <span>Customize All Labels, Headings & Field Names</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalize section titles and marriage expense table headers for your account.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetLabels}
            className="px-3.5 py-2 border border-stone-300 dark:border-neutral-700 text-xs font-semibold rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Labels to Default</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {(
            [
              { key: 'appName', label: 'Brand / App Name' },
              { key: 'dashboardHeading', label: 'Dashboard Heading' },
              { key: 'tasksHeading', label: 'Daily Planner Heading' },
              { key: 'calendarHeading', label: 'Calendar Heading' },
              { key: 'paymentsHeading', label: 'Payments Tracker Heading' },
              { key: 'marriageHeading', label: 'Marriage Planner Heading' },
              { key: 'reportsHeading', label: 'Reports Section Heading' },
              { key: 'brideLabel', label: 'Bride Field Label' },
              { key: 'groomLabel', label: 'Groom Field Label' },
              { key: 'venueLabel', label: 'Venue Field Label' },
              { key: 'budgetLabel', label: 'Budgeted Column Label' },
              { key: 'actualSpentLabel', label: 'Actual Spent Column Label' },
              { key: 'advancePaidLabel', label: 'Advance Paid Column Label' },
              { key: 'balanceDueLabel', label: 'Balance Due Column Label' },
            ] as { key: keyof CustomLabels; label: string }[]
          ).map((field) => (
            <div key={field.key}>
              <label className="block font-medium text-slate-600 dark:text-neutral-400 mb-1">
                {field.label}
              </label>
              <input
                type="text"
                value={workspace.customLabels[field.key] || ''}
                onChange={(e) => handleLabelChange(field.key, e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Data Rules: Optional "Load Demo Data" & "Reset to Blank" */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold font-display">
          Workspace Data Controls (Demo Data & Blank Reset)
        </h2>
        <p className="text-xs text-slate-500 max-w-2xl">
          Every new account opens a completely fresh, blank dashboard with zero pre-filled sample
          data. If you want to explore a populated Engagement & Marriage plan, click "Load Demo
          Data" below. You can remove it and return to a blank workspace at any time.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleLoadDemoData}
            className="px-4 py-2 bg-amber-800 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Demo Data (Optional)</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Data / Reset to Blank Workspace</span>
          </button>
        </div>
      </div>

      {/* 4. Built-In Automated Unit Test Suite (OTP Flow + Expense Math + Security Rules) */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold font-display flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-700" />
              <span>Automated Verification Suite (OTP Auth, Expense Math & Security)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Run live unit tests verifying scrypt OTP hashing, 5-min expiry, 3-attempt lockout,
              30s resend cooldown, expense variance/balance math, and Firestore security rules.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunAutomatedTests}
            disabled={runningTests}
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
          >
            {runningTests ? 'Running Tests...' : 'Run Unit Tests'}
          </button>
        </div>

        {testReport && (
          <div className="pt-3 border-t border-stone-100 dark:border-neutral-800 space-y-2">
            <div className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              Result: {testReport.passed}/{testReport.total} Test Suites Passed
            </div>
            <div className="divide-y divide-stone-100 dark:divide-neutral-800 text-xs">
              {testReport.results.map((r, idx) => (
                <div key={idx} className="py-2 flex items-start justify-between gap-4">
                  <div>
                    <span className="font-semibold">
                      [{r.suite}] {r.name}
                    </span>
                    <p className="text-slate-500 text-[11px]">{r.details}</p>
                  </div>
                  <span
                    className={`font-mono font-bold shrink-0 ${
                      r.status === 'PASS' ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Reset Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold font-display">Reset entire workspace?</h3>
            <p className="text-xs text-slate-600 dark:text-neutral-400">
              This will remove all tasks, payments, guest entries, and marriage expense items,
              restoring a completely blank dashboard.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-3.5 py-2 text-xs font-medium border border-stone-300 dark:border-neutral-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                className="px-3.5 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-500 cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
