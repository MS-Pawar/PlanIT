import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Copy,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  MapPin,
  Clock,
  Bell,
  Repeat,
  Download,
  Upload,
  CheckSquare,
  X,
  FolderPlus,
  CalendarHeart,
} from 'lucide-react';
import {
  createDefaultSubEvents,
  formatCurrency,
  formatEventDateReadable,
  formatEventTime12h,
  getLocalTodayIso,
  parseLocalIsoDate,
  toLocalIsoDate,
} from '../shared/calculations.ts';
import {
  PaymentMode,
  PriorityLevel,
  RecurrenceType,
  SubtaskItem,
  TaskItem,
  TaskStatus,
  UserWorkspaceData,
} from '../shared/types.ts';

interface TasksViewProps {
  workspace: UserWorkspaceData;
  onUpdateWorkspace: (updater: (prev: UserWorkspaceData) => UserWorkspaceData) => void;
  showToast: (msg: string) => void;
  externalModalOpen: boolean;
  setExternalModalOpen: (open: boolean) => void;
}

type TaskViewTab = 'today' | 'tomorrow' | 'date' | 'upcoming' | 'overdue' | 'completed' | 'all';

export const TasksView: React.FC<TasksViewProps> = ({
  workspace,
  onUpdateWorkspace,
  showToast,
  externalModalOpen,
  setExternalModalOpen,
}) => {
  const todayStr = getLocalTodayIso();
  const baseToday = parseLocalIsoDate(todayStr);
  const tomorrowDate = new Date(
    baseToday.getFullYear(),
    baseToday.getMonth(),
    baseToday.getDate() + 1,
    12,
    0,
    0
  );
  const tomorrowStr = toLocalIsoDate(tomorrowDate);

  const next7Date = new Date(
    baseToday.getFullYear(),
    baseToday.getMonth(),
    baseToday.getDate() + 7,
    12,
    0,
    0
  );
  const next7Str = toLocalIsoDate(next7Date);

  const [viewTab, setViewTab] = useState<TaskViewTab>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortBy, setSortBy] = useState<'manual' | 'date' | 'priority' | 'title'>('manual');

  // Quick-add state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState(workspace.taskCategories[0] || 'Work');
  const [quickPriority, setQuickPriority] = useState<PriorityLevel>('Medium');
  const [quickDate, setQuickDate] = useState(todayStr);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Delete confirmation modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New Category inline input
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);

  // Full Task Modal state
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');

  const createBlankTask = (): TaskItem => ({
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    description: '',
    category: workspace.taskCategories[0] || 'Work',
    priority: 'Medium',
    date: todayStr,
    startTime: '',
    endTime: '',
    location: '',
    status: 'Pending',
    tags: [],
    notes: '',
    attachmentName: '',
    recurrence: 'None',
    customRecurrenceDays: 0,
    subtasks: [],
    reminderAt: '',
    emailReminder: false,
    attendees: '',
    contactPhone: '',
    address: '',
    payee: '',
    amount: 0,
    paymentMode: 'UPI',
    isPaid: false,
    sortOrder: workspace.tasks.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Open blank modal when triggered from header/dashboard
  React.useEffect(() => {
    if (externalModalOpen) {
      const blank = createBlankTask();
      setEditingTask(blank);
      setTagsDraft('');
      setSubtaskDraft('');
    }
  }, [externalModalOpen]);

  const handleCloseModal = () => {
    setEditingTask(null);
    setExternalModalOpen(false);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const newTask: TaskItem = {
      ...createBlankTask(),
      title: quickTitle.trim(),
      category: quickCategory,
      priority: quickPriority,
      date: quickDate || todayStr,
    };
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
    setQuickTitle('');
    showToast('Task added to planner.');
  };

  const handleSaveTaskModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) {
      showToast('Please enter a task title.');
      return;
    }

    const parsedTags = tagsDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const finalized: TaskItem = {
      ...editingTask,
      title: editingTask.title.trim(),
      tags: parsedTags,
      isPaid: editingTask.status === 'Done' ? true : editingTask.isPaid,
      updatedAt: new Date().toISOString(),
    };

    onUpdateWorkspace((prev) => {
      const exists = prev.tasks.some((t) => t.id === finalized.id);
      const nextTasks = exists
        ? prev.tasks.map((t) => (t.id === finalized.id ? finalized : t))
        : [finalized, ...prev.tasks];
      return { ...prev, tasks: nextTasks };
    });

    if (finalized.reminderAt && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    showToast('Task saved.');
    handleCloseModal();
  };

  const handleToggleDone = (taskId: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const nextDone = t.status !== 'Done';
        return {
          ...t,
          status: nextDone ? 'Done' : 'Pending',
          isPaid: nextDone ? true : t.isPaid,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  };

  const handleDuplicateTask = (task: TaskItem) => {
    const copy: TaskItem = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: `${task.title} (Copy)`,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: [copy, ...prev.tasks],
    }));
    showToast('Task duplicated.');
  };

  const handleDeleteTask = (taskId: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    setSelectedIds((prev) => prev.filter((id) => id !== taskId));
    setDeleteConfirmId(null);
    showToast('Task deleted.');
  };

  const handleMoveOrder = (taskId: string, direction: 'up' | 'down') => {
    onUpdateWorkspace((prev) => {
      const list = [...prev.tasks];
      const idx = list.findIndex((t) => t.id === taskId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;
      const temp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = temp;
      return {
        ...prev,
        tasks: list.map((item, i) => ({ ...item, sortOrder: i })),
      };
    });
  };

  // Bulk Actions
  const handleBulkComplete = () => {
    if (selectedIds.length === 0) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        selectedIds.includes(t.id) ? { ...t, status: 'Done', isPaid: true } : t
      ),
    }));
    showToast(`Marked ${selectedIds.length} tasks as Done.`);
    setSelectedIds([]);
  };

  const handleBulkMoveToDate = (targetDate: string) => {
    if (selectedIds.length === 0) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        selectedIds.includes(t.id) ? { ...t, date: targetDate } : t
      ),
    }));
    showToast(`Moved ${selectedIds.length} tasks to ${targetDate}.`);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => !selectedIds.includes(t.id)),
    }));
    showToast(`Deleted ${selectedIds.length} selected tasks.`);
    setSelectedIds([]);
  };

  const handleAddCustomCategory = () => {
    const clean = newCategoryName.trim();
    if (!clean) return;
    if (!workspace.taskCategories.includes(clean)) {
      onUpdateWorkspace((prev) => ({
        ...prev,
        taskCategories: [...prev.taskCategories, clean],
      }));
      showToast(`Category "${clean}" added.`);
    }
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  // Export Tasks CSV
  const handleExportCSV = () => {
    const headers = [
      'Title',
      'Category',
      'Priority',
      'Status',
      'Date',
      'StartTime',
      'EndTime',
      'Location',
      'Recurrence',
      'Payee',
      'Amount',
      'Attendees',
      'ContactPhone',
      'Address',
      'Notes',
    ];
    const rows = workspace.tasks.map((t) =>
      [
        t.title,
        t.category,
        t.priority,
        t.status,
        t.date,
        t.startTime,
        t.endTime,
        t.location,
        t.recurrence,
        t.payee,
        t.amount,
        t.attendees,
        t.contactPhone,
        t.address,
        t.notes,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PlanEase_Tasks_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Tasks exported to CSV.');
  };

  // Import Tasks CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        showToast('CSV file has no data rows.');
        return;
      }
      const imported: TaskItem[] = lines.slice(1).map((line, i) => {
        const cols = line
          .split(',')
          .map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
        return {
          ...createBlankTask(),
          id: `imp_${Date.now()}_${i}`,
          title: cols[0] || `Imported Task ${i + 1}`,
          category: cols[1] || 'Personal',
          priority: (['High', 'Medium', 'Low'].includes(cols[2]) ? cols[2] : 'Medium') as PriorityLevel,
          status: (['Pending', 'In Progress', 'Done', 'Postponed'].includes(cols[3])
            ? cols[3]
            : 'Pending') as TaskStatus,
          date: cols[4] || todayStr,
          startTime: cols[5] || '',
          endTime: cols[6] || '',
          location: cols[7] || '',
          recurrence: (cols[8] as RecurrenceType) || 'None',
          payee: cols[9] || '',
          amount: Number(cols[10]) || 0,
          attendees: cols[11] || '',
          contactPhone: cols[12] || '',
          address: cols[13] || '',
          notes: cols[14] || '',
        };
      });

      onUpdateWorkspace((prev) => ({
        ...prev,
        tasks: [...imported, ...prev.tasks],
      }));
      showToast(`Imported ${imported.length} tasks from CSV.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeSingleDate =
    viewTab === 'today'
      ? todayStr
      : viewTab === 'tomorrow'
      ? tomorrowStr
      : viewTab === 'date'
      ? selectedDateFilter
      : '';

  const eventsOnActiveDate = useMemo(() => {
    if (!activeSingleDate) return [];
    const rawSub =
      workspace.subEvents && workspace.subEvents.length > 0
        ? workspace.subEvents
        : createDefaultSubEvents();
    return rawSub
      .map((ev) => {
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
          '';
        const effectiveCity =
          ev.city ||
          (ev.eventCategory === 'Engagement'
            ? workspace.engagementParticulars.city
            : workspace.eventParticulars.city) ||
          '';
        return {
          id: ev.id,
          category: ev.eventCategory,
          title: ev.eventTitle,
          date: (effectiveDate || '').trim(),
          time: effectiveTime,
          venue: [effectiveVenue, effectiveCity].filter(Boolean).join(', '),
        };
      })
      .filter((e) => e.date === activeSingleDate);
  }, [
    activeSingleDate,
    workspace.subEvents,
    workspace.eventParticulars,
    workspace.engagementParticulars,
  ]);

  const filteredTasks = useMemo(() => {
    return workspace.tasks
      .filter((t) => {
        const taskDate = (t.date || '').trim();
        if (viewTab === 'today' && taskDate !== todayStr) return false;
        if (viewTab === 'tomorrow' && taskDate !== tomorrowStr) return false;
        if (viewTab === 'date' && taskDate !== selectedDateFilter) return false;
        if (
          viewTab === 'upcoming' &&
          (taskDate < todayStr || taskDate > next7Str || t.status === 'Done')
        )
          return false;
        if (viewTab === 'overdue' && !(taskDate < todayStr && t.status !== 'Done')) return false;
        if (viewTab === 'completed' && t.status !== 'Done') return false;

        if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
        if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
        if (statusFilter !== 'All' && t.status !== statusFilter) return false;
        if (dateFromFilter && taskDate < dateFromFilter) return false;
        if (dateToFilter && taskDate > dateToFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const hay = `${t.title} ${t.description} ${t.category} ${t.location} ${t.attendees} ${t.payee} ${t.notes} ${t.tags.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date')
          return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
        if (sortBy === 'priority') {
          const rank: Record<PriorityLevel, number> = { High: 1, Medium: 2, Low: 3 };
          return rank[a.priority] - rank[b.priority];
        }
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
  }, [
    workspace.tasks,
    viewTab,
    selectedDateFilter,
    categoryFilter,
    priorityFilter,
    statusFilter,
    dateFromFilter,
    dateToFilter,
    searchQuery,
    sortBy,
    todayStr,
    tomorrowStr,
    next7Str,
  ]);

  return (
    <div className="space-y-6">
      {/* Header & Export/Import Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
            {workspace.customLabels.tasksHeading || 'Daily Planner & Tasks'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Manage daily tasks, recurring schedules, meetings with map links, and bill reminders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-medium hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ Category</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-medium hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <label className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-medium hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => {
              setEditingTask(createBlankTask());
              setTagsDraft('');
              setSubtaskDraft('');
            }}
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg hover:opacity-90 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Detailed Task</span>
          </button>
        </div>
      </div>

      {/* Inline Custom Category Creator */}
      {showAddCategory && (
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl flex items-center gap-3">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Enter new custom category name..."
            className="flex-1 px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
          />
          <button
            type="button"
            onClick={handleAddCustomCategory}
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Save Category
          </button>
          <button
            type="button"
            onClick={() => setShowAddCategory(false)}
            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Fast Quick-Add Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="p-3 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl flex flex-col md:flex-row items-stretch md:items-center gap-2.5"
      >
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Quick-add a task, meeting, visit, or payment..."
          className="flex-1 px-3.5 py-2 text-sm bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-slate-900"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={quickCategory}
            onChange={(e) => setQuickCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg"
          >
            {workspace.taskCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as PriorityLevel)}
            className="px-3 py-2 text-xs bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg"
          >
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          <input
            type="date"
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            className="px-3 py-2 text-xs font-mono bg-stone-50 dark:bg-neutral-800 border border-stone-200 dark:border-neutral-700 rounded-lg tabular-nums"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg hover:opacity-90 whitespace-nowrap cursor-pointer"
          >
            + Quick Add
          </button>
        </div>
      </form>

      {/* Segmented View Tabs (Functional Interactive Filter Buttons) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-200/70 dark:bg-neutral-800 rounded-lg">
            {(
              [
                { id: 'all', label: 'All Tasks' },
                { id: 'today', label: 'Today' },
                { id: 'tomorrow', label: 'Tomorrow' },
                { id: 'date', label: `Selected Date (${selectedDateFilter})` },
                { id: 'upcoming', label: 'Upcoming (7d)' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'completed', label: 'Completed' },
              ] as { id: TaskViewTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  viewTab === tab.id
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Date Selector, Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-medium text-slate-500">Show Date Only:</span>
              <input
                type="date"
                value={selectedDateFilter}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDateFilter(e.target.value);
                    setQuickDate(e.target.value);
                    setViewTab('date');
                  }
                }}
                className="text-xs font-mono bg-transparent tabular-nums focus:outline-none"
              />
            </div>

            <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, tags, people..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg"
          >
            <option value="All">All Categories</option>
            {workspace.taskCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
            <option value="Postponed">Postponed</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-lg"
          >
            <option value="manual">Sort: Manual Order</option>
            <option value="date">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="title">Sort: Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar when items are selected */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-medium font-mono tabular-nums">
            {selectedIds.length} task(s) selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkComplete}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-md font-medium cursor-pointer"
            >
              Mark Complete
            </button>
            <button
              type="button"
              onClick={() => handleBulkMoveToDate(todayStr)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md font-medium cursor-pointer"
            >
              Move to Today
            </button>
            <button
              type="button"
              onClick={() => handleBulkMoveToDate(tomorrowStr)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md font-medium cursor-pointer"
            >
              Move to Tomorrow
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-md font-medium cursor-pointer"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2 py-1.5 text-slate-300 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Ceremony / Function Events on the Active Single Date (Today / Tomorrow / Selected Date) */}
      {activeSingleDate && (
        <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
              <CalendarHeart className="w-4 h-4" />
              <span>
                Showing Events &amp; Tasks for {formatEventDateReadable(activeSingleDate)} (
                <span className="font-mono">{activeSingleDate}</span>) Only
              </span>
            </div>
            {viewTab === 'date' && (
              <button
                type="button"
                onClick={() => setViewTab('all')}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Show All Dates
              </button>
            )}
          </div>

          {eventsOnActiveDate.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              {eventsOnActiveDate.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-amber-900 dark:text-amber-300">
                      [{ev.category} Event] {ev.title}
                    </div>
                    <div className="text-slate-600 dark:text-neutral-300 mt-0.5">
                      {ev.venue || 'Venue TBD'}
                    </div>
                  </div>
                  <div className="font-mono font-semibold tabular-nums">
                    {formatEventTime12h(ev.time)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task List Table / Surface */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">
              No tasks match this view.
            </p>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Add your first task using the quick-add bar above or click "Detailed Task".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-neutral-800">
            <div className="px-4 py-2.5 bg-stone-50 dark:bg-neutral-800/50 flex items-center justify-between text-xs text-slate-500">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredTasks.length && filteredTasks.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(filteredTasks.map((t) => t.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="w-3.5 h-3.5 rounded"
                />
                <span>Select All ({filteredTasks.length})</span>
              </label>
              <span>Order · Edit · Duplicate · Delete</span>
            </div>

            {filteredTasks.map((task) => {
              const isOverdue = task.date < todayStr && task.status !== 'Done';
              const isSelected = selectedIds.includes(task.id);
              const doneSubtasks = task.subtasks.filter((s) => s.done).length;

              return (
                <div
                  key={task.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Bulk selection checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => [...prev, task.id]);
                        } else {
                          setSelectedIds((prev) => prev.filter((id) => id !== task.id));
                        }
                      }}
                      title="Select for bulk action"
                      className="mt-1 w-3.5 h-3.5 rounded border-stone-300 cursor-pointer"
                    />

                    {/* Task Done checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleDone(task.id)}
                      className={`mt-0.5 px-2 py-0.5 text-[11px] font-mono rounded border transition-colors cursor-pointer whitespace-nowrap ${
                        task.status === 'Done'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-stone-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:border-slate-900'
                      }`}
                    >
                      {task.status === 'Done' ? '✓ Done' : 'Mark Done'}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-semibold ${
                            task.status === 'Done'
                              ? 'line-through text-slate-400 dark:text-neutral-500'
                              : 'text-slate-900 dark:text-neutral-100'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="text-xs text-slate-500 dark:text-neutral-400 truncate max-w-md">
                            — {task.description}
                          </span>
                        )}
                      </div>

                      {/* Zero-Pill Metadata Line */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
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
                        <span>Status: {task.status}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-mono tabular-nums ${
                            isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''
                          }`}
                        >
                          {isOverdue ? `Overdue (${task.date})` : task.date}
                        </span>

                        {task.startTime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Clock className="w-3 h-3" />
                              {task.startTime}
                              {task.endTime ? `–${task.endTime}` : ''}
                            </span>
                          </>
                        )}

                        {task.recurrence !== 'None' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Repeat className="w-3 h-3" />
                              {task.recurrence}
                            </span>
                          </>
                        )}

                        {task.subtasks.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              Subtasks: {doneSubtasks}/{task.subtasks.length}
                            </span>
                          </>
                        )}

                        {task.attendees && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>With: {task.attendees}</span>
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
                              className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-400 hover:underline"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Maps ({task.address})</span>
                            </a>
                          </>
                        )}

                        {task.tags.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>#{task.tags.join(' #')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side amount + action controls */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {task.amount > 0 && (
                      <div className="text-right mr-2">
                        <div className="text-xs font-mono font-semibold tabular-nums">
                          {formatCurrency(task.amount, workspace.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {task.payee ? `${task.payee} · ` : ''}
                          {task.isPaid ? 'Paid' : 'Unpaid'}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleMoveOrder(task.id, 'up')}
                      title="Move up"
                      className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(task.id, 'down')}
                      title="Move down"
                      className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask(task);
                        setTagsDraft(task.tags.join(', '));
                        setSubtaskDraft('');
                      }}
                      title="Edit task"
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateTask(task)}
                      title="Duplicate task"
                      className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(task.id)}
                      title="Delete task"
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold font-display">Delete this task?</h3>
            <p className="text-xs text-slate-600 dark:text-neutral-400">
              This action will permanently remove the task from your planner.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-2 text-xs font-medium border border-stone-300 dark:border-neutral-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTask(deleteConfirmId)}
                className="px-3.5 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-500 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Task Editor Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full p-6 my-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-800 pb-3">
              <h2 className="text-lg font-bold font-display">
                {workspace.tasks.some((t) => t.id === editingTask.id) ? 'Edit Task' : 'New Detailed Task'}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTaskModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    placeholder="e.g., Venue walkthrough with decorator"
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={editingTask.description}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, description: e.target.value })
                    }
                    placeholder="Short summary or objective"
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={editingTask.category}
                    onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                  >
                    {workspace.taskCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        priority: e.target.value as PriorityLevel,
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        status: e.target.value as TaskStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="Postponed">Postponed</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={editingTask.date}
                    onChange={(e) => setEditingTask({ ...editingTask, date: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editingTask.startTime}
                    onChange={(e) => setEditingTask({ ...editingTask, startTime: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    value={editingTask.endTime}
                    onChange={(e) => setEditingTask({ ...editingTask, endTime: e.target.value })}
                    className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Recurrence</label>
                  <select
                    value={editingTask.recurrence}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        recurrence: e.target.value as RecurrenceType,
                      })
                    }
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                  >
                    <option value="None">None</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Custom">Custom Interval</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Reminder Time (Browser Alert)</label>
                  <input
                    type="time"
                    value={editingTask.reminderAt}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, reminderAt: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                  />
                </div>
              </div>

              {/* Meeting / Visit Details Section */}
              <div className="pt-3 border-t border-stone-200 dark:border-neutral-800 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-neutral-200">
                  Meeting & Visit Details (Optional)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={editingTask.attendees}
                    onChange={(e) => setEditingTask({ ...editingTask, attendees: e.target.value })}
                    placeholder="Attendees / Contact Person"
                    className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                  <input
                    type="text"
                    value={editingTask.contactPhone}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, contactPhone: e.target.value })
                    }
                    placeholder="Contact Phone"
                    className="px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                  <input
                    type="text"
                    value={editingTask.address}
                    onChange={(e) => setEditingTask({ ...editingTask, address: e.target.value })}
                    placeholder="Address / Map Location"
                    className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                </div>
              </div>

              {/* Payment / Bill Details Section */}
              <div className="pt-3 border-t border-stone-200 dark:border-neutral-800 space-y-3">
                <div className="font-semibold text-slate-800 dark:text-neutral-200">
                  Payment / Bill Tracker Fields (Optional)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                  <input
                    type="text"
                    value={editingTask.payee}
                    onChange={(e) => setEditingTask({ ...editingTask, payee: e.target.value })}
                    placeholder="Payee / Vendor Name"
                    className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                  <input
                    type="number"
                    min="0"
                    value={editingTask.amount || ''}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, amount: Number(e.target.value) || 0 })
                    }
                    placeholder="Amount"
                    className="px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                  />
                  <select
                    value={editingTask.paymentMode}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        paymentMode: e.target.value as PaymentMode,
                      })
                    }
                    className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTask.isPaid}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, isPaid: e.target.checked })
                      }
                      className="w-4 h-4 rounded"
                    />
                    <span>Marked as Paid</span>
                  </label>
                </div>
              </div>

              {/* Subtasks / Checklist */}
              <div className="pt-3 border-t border-stone-200 dark:border-neutral-800 space-y-2">
                <div className="font-semibold text-slate-800 dark:text-neutral-200">
                  Subtasks & Checklist
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    placeholder="Add a checklist item..."
                    className="flex-1 px-3 py-1.5 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!subtaskDraft.trim()) return;
                      const nextSub: SubtaskItem = {
                        id: `sub_${Date.now()}`,
                        title: subtaskDraft.trim(),
                        done: false,
                      };
                      setEditingTask({
                        ...editingTask,
                        subtasks: [...editingTask.subtasks, nextSub],
                      });
                      setSubtaskDraft('');
                    }}
                    className="px-3 py-1.5 bg-stone-200 dark:bg-neutral-800 rounded-lg font-medium cursor-pointer"
                  >
                    + Add Subtask
                  </button>
                </div>
                {editingTask.subtasks.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {editingTask.subtasks.map((st) => (
                      <div key={st.id} className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={st.done}
                            onChange={() =>
                              setEditingTask({
                                ...editingTask,
                                subtasks: editingTask.subtasks.map((item) =>
                                  item.id === st.id ? { ...item, done: !item.done } : item
                                ),
                              })
                            }
                            className="w-3.5 h-3.5 rounded"
                          />
                          <span className={st.done ? 'line-through text-slate-400' : ''}>
                            {st.title}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingTask({
                              ...editingTask,
                              subtasks: editingTask.subtasks.filter((item) => item.id !== st.id),
                            })
                          }
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags, Attachment & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-200 dark:border-neutral-800">
                <div>
                  <label className="block font-medium mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={tagsDraft}
                    onChange={(e) => setTagsDraft(e.target.value)}
                    placeholder="urgent, catering, family"
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Attachment Reference / Filename</label>
                  <input
                    type="text"
                    value={editingTask.attachmentName}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, attachmentName: e.target.value })
                    }
                    placeholder="e.g., Invoice_Quote.pdf"
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={editingTask.notes}
                    onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
                    placeholder="Additional notes, instructions, or links..."
                    className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
