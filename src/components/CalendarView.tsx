import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  CalendarHeart,
  CheckSquare,
  Trash2,
  CreditCard,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  calculateEventCountdown,
  createDefaultSubEvents,
  formatCurrency,
  formatEventDateReadable,
  formatEventTime12h,
  getLocalTodayIso,
  parseLocalIsoDate,
  toLocalIsoDate,
} from '../shared/calculations.ts';
import {
  CustomSubEvent,
  PriorityLevel,
  TaskItem,
  UserWorkspaceData,
} from '../shared/types.ts';

interface CalendarViewProps {
  workspace: UserWorkspaceData;
  onUpdateWorkspace: (updater: (prev: UserWorkspaceData) => UserWorkspaceData) => void;
  showToast: (msg: string) => void;
}

export interface CalendarDateEvent {
  id: string;
  category: 'Engagement' | 'Marriage' | 'Other';
  title: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  coupleNames: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  workspace,
  onUpdateWorkspace,
  showToast,
}) => {
  const todayIso = getLocalTodayIso();

  const [calMode, setCalMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedIso, setSelectedIso] = useState<string>(todayIso);
  const [cursorDate, setCursorDate] = useState<Date>(() => parseLocalIsoDate(todayIso));

  // Quick-add form for the selected date (supports adding either a Task or a Function/Event)
  const [quickAddType, setQuickAddType] = useState<'task' | 'event'>('task');
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskCategory, setQuickTaskCategory] = useState(
    workspace.taskCategories[0] || 'Meeting'
  );
  const [quickTaskPriority, setQuickTaskPriority] = useState<PriorityLevel>('Medium');
  const [quickTaskTime, setQuickTaskTime] = useState('10:00');
  const [quickTaskLocation, setQuickTaskLocation] = useState('');
  const [quickEventCategory, setQuickEventCategory] = useState<'Engagement' | 'Marriage' | 'Other'>(
    'Other'
  );

  // Synchronize both selectedIso and cursorDate whenever a date is chosen
  const handleSelectDate = (iso: string, switchToDayView = false) => {
    const cleanIso = iso.trim();
    if (!cleanIso) return;
    setSelectedIso(cleanIso);
    setCursorDate(parseLocalIsoDate(cleanIso));
    if (switchToDayView) {
      setCalMode('day');
    }
  };

  const handleJumpToToday = () => {
    const nowIso = getLocalTodayIso();
    setSelectedIso(nowIso);
    setCursorDate(parseLocalIsoDate(nowIso));
  };

  // Normalize all Engagement, Marriage & Other Events with valid dates
  const allCeremonyEvents: CalendarDateEvent[] = useMemo(() => {
    const rawSub =
      workspace.subEvents && workspace.subEvents.length > 0
        ? workspace.subEvents
        : createDefaultSubEvents();

    const defaultBride =
      workspace.eventParticulars.brideName || workspace.engagementParticulars.brideName || '';
    const defaultGroom =
      workspace.eventParticulars.groomName || workspace.engagementParticulars.groomName || '';

    const eventsList: CalendarDateEvent[] = [];

    for (const ev of rawSub) {
      const effectiveDate =
        ev.eventDate ||
        (ev.eventCategory === 'Engagement'
          ? workspace.engagementParticulars.engagementDate ||
            workspace.eventParticulars.engagementDate
          : ev.eventCategory === 'Marriage'
          ? workspace.eventParticulars.marriageDate
          : '');

      if (!effectiveDate || !effectiveDate.trim()) continue;

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
      const b = ev.brideName || defaultBride;
      const g = ev.groomName || defaultGroom;

      eventsList.push({
        id: ev.id,
        category: ev.eventCategory,
        title: ev.eventTitle || `${ev.eventCategory} Ceremony`,
        date: effectiveDate.trim(),
        time: effectiveTime,
        venue: effectiveVenue,
        city: effectiveCity,
        coupleNames: b && g ? `${b} & ${g}` : '',
      });
    }

    // Also ensure standalone Engagement/Marriage dates in eventParticulars are represented if not already in eventsList
    const engDate =
      workspace.engagementParticulars.engagementDate?.trim() ||
      workspace.eventParticulars.engagementDate?.trim() ||
      '';
    if (
      engDate &&
      !eventsList.some((e) => e.category === 'Engagement' && e.date === engDate)
    ) {
      eventsList.push({
        id: 'particulars_engagement',
        category: 'Engagement',
        title: 'Engagement & Ring Ceremony',
        date: engDate,
        time:
          workspace.engagementParticulars.engagementTime ||
          workspace.eventParticulars.engagementTime ||
          '18:30',
        venue: workspace.engagementParticulars.venue || workspace.eventParticulars.venue || '',
        city: workspace.engagementParticulars.city || workspace.eventParticulars.city || '',
        coupleNames: defaultBride && defaultGroom ? `${defaultBride} & ${defaultGroom}` : '',
      });
    }

    const marDate = workspace.eventParticulars.marriageDate?.trim() || '';
    if (
      marDate &&
      !eventsList.some((e) => e.category === 'Marriage' && e.date === marDate)
    ) {
      eventsList.push({
        id: 'particulars_marriage',
        category: 'Marriage',
        title: 'Shubh Vivah — Wedding Ceremony',
        date: marDate,
        time: workspace.eventParticulars.marriageTime || '19:30',
        venue: workspace.eventParticulars.venue || '',
        city: workspace.eventParticulars.city || '',
        coupleNames: defaultBride && defaultGroom ? `${defaultBride} & ${defaultGroom}` : '',
      });
    }

    return eventsList;
  }, [workspace.subEvents, workspace.eventParticulars, workspace.engagementParticulars]);

  // Build Month Grid cells using timezone-safe local Date math at 12:00 noon
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
    const startWeekDay = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0, 12, 0, 0).getDate();

    const cells: {
      iso: string;
      dayNum: number;
      weekdayShort: string;
      isCurrentMonth: boolean;
    }[] = [];

    // Leading days from previous month
    for (let i = 0; i < startWeekDay; i++) {
      const d = new Date(year, month, -startWeekDay + i + 1, 12, 0, 0);
      cells.push({
        iso: toLocalIsoDate(d),
        dayNum: d.getDate(),
        weekdayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d, 12, 0, 0);
      cells.push({
        iso: toLocalIsoDate(dt),
        dayNum: d,
        weekdayShort: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        isCurrentMonth: true,
      });
    }

    // Trailing days to complete 7-column grid rows cleanly
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let i = 1; i <= needed; i++) {
        const d = new Date(year, month + 1, i, 12, 0, 0);
        cells.push({
          iso: toLocalIsoDate(d),
          dayNum: d.getDate(),
          weekdayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
          isCurrentMonth: false,
        });
      }
    }

    return cells;
  }, [year, month]);

  // Compute 7 days of the currently selected week (Sunday -> Saturday around selectedIso)
  const weekDays = useMemo(() => {
    const base = parseLocalIsoDate(selectedIso);
    const dayOfWeek = base.getDay(); // 0 = Sun
    const sunday = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() - dayOfWeek,
      12,
      0,
      0
    );

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(
        sunday.getFullYear(),
        sunday.getMonth(),
        sunday.getDate() + i,
        12,
        0,
        0
      );
      const iso = toLocalIsoDate(d);
      return {
        iso,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
        dateLabel: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      };
    });
  }, [selectedIso]);

  const handleNavigate = (dir: -1 | 1) => {
    if (calMode === 'month') {
      const currentSelectedDay = parseLocalIsoDate(selectedIso).getDate();
      const daysInTargetMonth = new Date(year, month + dir + 1, 0, 12, 0, 0).getDate();
      const clampedDay = Math.min(currentSelectedDay, daysInTargetMonth);
      const nextMonthDate = new Date(year, month + dir, clampedDay, 12, 0, 0);
      const nextIso = toLocalIsoDate(nextMonthDate);
      setCursorDate(nextMonthDate);
      setSelectedIso(nextIso);
    } else if (calMode === 'week') {
      const current = parseLocalIsoDate(selectedIso);
      const nextWeekDate = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate() + dir * 7,
        12,
        0,
        0
      );
      const nextIso = toLocalIsoDate(nextWeekDate);
      setCursorDate(nextWeekDate);
      setSelectedIso(nextIso);
    } else {
      const current = parseLocalIsoDate(selectedIso);
      const nextDayDate = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate() + dir,
        12,
        0,
        0
      );
      const nextIso = toLocalIsoDate(nextDayDate);
      setCursorDate(nextDayDate);
      setSelectedIso(nextIso);
    }
  };

  // STRICT FILTERING FOR SELECTED DATE ONLY
  const eventsOnSelectedDate = useMemo(
    () => allCeremonyEvents.filter((ev) => ev.date.trim() === selectedIso),
    [allCeremonyEvents, selectedIso]
  );

  const tasksOnSelectedDate = useMemo(
    () =>
      workspace.tasks
        .filter((t) => (t.date || '').trim() === selectedIso)
        .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99')),
    [workspace.tasks, selectedIso]
  );

  const paymentsOnSelectedDate = useMemo(
    () => workspace.payments.filter((p) => (p.dueDate || '').trim() === selectedIso),
    [workspace.payments, selectedIso]
  );

  const weddingExpensesDueOnSelectedDate = useMemo(
    () => workspace.expenseItems.filter((item) => (item.dueDate || '').trim() === selectedIso),
    [workspace.expenseItems, selectedIso]
  );

  const handleAddOnSelectedDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    if (quickAddType === 'event') {
      const baseEvents =
        workspace.subEvents && workspace.subEvents.length > 0
          ? workspace.subEvents
          : createDefaultSubEvents();

      const newSubEvent: CustomSubEvent = {
        id: `evt_${Date.now()}`,
        eventCategory: quickEventCategory,
        eventTitle: quickTaskTitle.trim(),
        eventDate: selectedIso,
        eventTime: quickTaskTime || '18:30',
        venue: quickTaskLocation.trim(),
        city: workspace.eventParticulars.city || workspace.engagementParticulars.city || '',
        address: quickTaskLocation.trim(),
        brideName:
          workspace.eventParticulars.brideName || workspace.engagementParticulars.brideName || '',
        groomName:
          workspace.eventParticulars.groomName || workspace.engagementParticulars.groomName || '',
        brideFamily:
          workspace.eventParticulars.brideFamily ||
          workspace.engagementParticulars.brideFamily ||
          '',
        groomFamily:
          workspace.eventParticulars.groomFamily ||
          workspace.engagementParticulars.groomFamily ||
          '',
        invocationText: 'With Warm Blessings & Joy',
        hostLine: 'We cordially invite you and your family to celebrate',
        bodyWording:
          'We look forward to celebrating this special occasion with you and your family.',
        dressCode: 'Festive Attire',
        rsvpContact: '',
        cardTheme: 'ivory-gold',
      };

      onUpdateWorkspace((prev) => ({
        ...prev,
        subEvents: [...baseEvents, newSubEvent],
      }));

      setQuickTaskTitle('');
      setQuickTaskLocation('');
      showToast(
        `Added ${quickEventCategory} event "${newSubEvent.eventTitle}" on ${formatEventDateReadable(
          selectedIso
        )}.`
      );
      return;
    }

    const newTask: TaskItem = {
      id: `cal_${Date.now()}`,
      title: quickTaskTitle.trim(),
      description: '',
      category: quickTaskCategory,
      priority: quickTaskPriority,
      date: selectedIso,
      startTime: quickTaskTime,
      endTime: '',
      location: quickTaskLocation.trim(),
      status: 'Pending',
      tags: [],
      notes: '',
      attachmentName: '',
      recurrence: 'None',
      subtasks: [],
      reminderAt: '',
      emailReminder: false,
      attendees: '',
      contactPhone: '',
      address: quickTaskLocation.trim(),
      payee: '',
      amount: 0,
      paymentMode: 'UPI',
      isPaid: false,
      sortOrder: workspace.tasks.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
    setQuickTaskTitle('');
    setQuickTaskLocation('');
    showToast(`Added "${newTask.title}" on ${formatEventDateReadable(selectedIso)}.`);
  };

  const handleToggleTaskDone = (taskId: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'Done' ? 'Pending' : 'Done' }
          : t
      ),
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    onUpdateWorkspace((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    showToast('Task removed from this date.');
  };

  const selectedDateFormatted = formatEventDateReadable(selectedIso);
  const selectedWeekdayName = parseLocalIsoDate(selectedIso).toLocaleDateString('en-US', {
    weekday: 'long',
  });

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">
            {workspace.customLabels.calendarHeading || 'Schedule & Calendar'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Selected Day:{' '}
            <strong className="text-slate-900 dark:text-white">{selectedDateFormatted}</strong> (
            <span className="font-mono">{selectedIso}</span>) · Showing{' '}
            <strong className="text-amber-800 dark:text-amber-400">
              {eventsOnSelectedDate.length} event(s)
            </strong>{' '}
            &amp;{' '}
            <strong className="text-slate-900 dark:text-white">
              {tasksOnSelectedDate.length} task(s)
            </strong>{' '}
            for this date only
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Direct Date Picker to jump to any date and show only that date's events & tasks */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-neutral-300">
              Jump to Date:
            </label>
            <input
              type="date"
              value={selectedIso}
              onChange={(e) => {
                if (e.target.value) {
                  handleSelectDate(e.target.value);
                }
              }}
              className="px-2.5 py-1.5 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 tabular-nums"
            />
          </div>

          <button
            type="button"
            onClick={handleJumpToToday}
            className="px-3 py-1.5 text-xs font-semibold border border-stone-300 dark:border-neutral-700 rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            Today ({todayIso})
          </button>

          <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-neutral-800 rounded-lg">
            {(['month', 'week', 'day'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCalMode(m)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize rounded-md transition-colors cursor-pointer ${
                  calMode === m
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-neutral-400'
                }`}
              >
                {m} View
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              className="p-2 border border-stone-300 dark:border-neutral-700 rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold font-mono tabular-nums whitespace-nowrap">
              {calMode === 'day'
                ? `${selectedWeekdayName}, ${selectedIso}`
                : cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => handleNavigate(1)}
              className="p-2 border border-stone-300 dark:border-neutral-700 rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Calendar Month / Week / Day View */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-4">
            {calMode === 'month' && (
              <>
                <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 pb-2 border-b border-stone-100 dark:border-neutral-800">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-stone-200 dark:bg-neutral-800 mt-2 rounded-lg overflow-hidden">
                  {calendarCells.map((cell) => {
                    const dayTasks = workspace.tasks.filter(
                      (t) => (t.date || '').trim() === cell.iso
                    );
                    const dayEvents = allCeremonyEvents.filter(
                      (ev) => ev.date.trim() === cell.iso
                    );
                    const dayPaymentsCount =
                      workspace.payments.filter(
                        (p) => (p.dueDate || '').trim() === cell.iso && !p.paid
                      ).length +
                      workspace.expenseItems.filter(
                        (i) => (i.dueDate || '').trim() === cell.iso && !i.isPaid
                      ).length;

                    const isSelected = cell.iso === selectedIso;
                    const isToday = cell.iso === todayIso;

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => handleSelectDate(cell.iso)}
                        onDoubleClick={() => handleSelectDate(cell.iso, true)}
                        className={`min-h-[96px] p-2 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50/90 dark:bg-neutral-800 ring-2 ring-inset ring-slate-900 dark:ring-amber-500'
                            : cell.isCurrentMonth
                            ? 'bg-white dark:bg-neutral-900 hover:bg-stone-50 dark:hover:bg-neutral-800/50'
                            : 'bg-stone-50/60 dark:bg-neutral-950 text-slate-400 hover:bg-stone-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-mono tabular-nums inline-flex items-center gap-1 ${
                              isToday
                                ? 'px-1.5 py-0.5 rounded bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-bold'
                                : isSelected
                                ? 'font-bold text-slate-900 dark:text-white'
                                : 'font-medium'
                            }`}
                          >
                            <span>{cell.dayNum}</span>
                            <span className="text-[10px] opacity-65 font-sans">
                              {cell.weekdayShort}
                            </span>
                          </span>
                          {(dayEvents.length > 0 ||
                            dayTasks.length > 0 ||
                            dayPaymentsCount > 0) && (
                            <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                              {dayEvents.length + dayTasks.length + dayPaymentsCount}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 mt-1.5 w-full">
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="text-[10px] font-semibold text-amber-900 dark:text-amber-300 truncate"
                            >
                              ★ {ev.category}: {ev.title}
                            </div>
                          ))}
                          {dayTasks.slice(0, 2).map((t) => (
                            <div
                              key={t.id}
                              className={`text-[11px] truncate ${
                                t.status === 'Done'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800 dark:text-neutral-200 font-medium'
                              }`}
                            >
                              • {t.startTime ? `${t.startTime} ` : ''}
                              {t.title}
                            </div>
                          ))}
                          {dayTasks.length > 2 && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              +{dayTasks.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {(calMode === 'week' || calMode === 'day') && (
              <div className="space-y-4">
                {/* 7-Day Selector Strip for the Selected Week */}
                <div className="grid grid-cols-7 gap-1.5 pb-3 border-b border-stone-200 dark:border-neutral-800">
                  {weekDays.map((wd) => {
                    const isSelected = wd.iso === selectedIso;
                    const isToday = wd.iso === todayIso;
                    const count =
                      allCeremonyEvents.filter((e) => e.date.trim() === wd.iso).length +
                      workspace.tasks.filter((t) => (t.date || '').trim() === wd.iso).length;
                    return (
                      <button
                        key={wd.iso}
                        type="button"
                        onClick={() => handleSelectDate(wd.iso)}
                        className={`p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 border-slate-900 dark:border-amber-500'
                            : 'border-stone-200 dark:border-neutral-800 hover:bg-stone-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="text-[11px] font-semibold">{wd.dayName}</div>
                        <div className="text-xs font-mono font-bold mt-0.5 tabular-nums">
                          {wd.dateLabel}
                        </div>
                        <div
                          className={`text-[10px] font-mono mt-1 ${
                            isSelected
                              ? 'opacity-90'
                              : isToday
                              ? 'text-amber-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {count > 0 ? `${count} item(s)` : 'Free'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Strictly show ONLY the selected date's events & tasks */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 pb-3">
                    <div>
                      <h2 className="text-base font-bold font-display">
                        {selectedDateFormatted}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono">
                        {selectedWeekdayName} · {selectedIso} · Showing events and tasks for this
                        respective date only
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 dark:text-neutral-300 tabular-nums">
                      {eventsOnSelectedDate.length} Event(s) · {tasksOnSelectedDate.length} Task(s)
                    </span>
                  </div>

                  {eventsOnSelectedDate.length === 0 &&
                  tasksOnSelectedDate.length === 0 &&
                  paymentsOnSelectedDate.length === 0 &&
                  weddingExpensesDueOnSelectedDate.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">
                        No events or tasks scheduled on {selectedDateFormatted}.
                      </p>
                      <p className="text-xs text-slate-500">
                        Use the quick-add panel on the right to add an event or task for{' '}
                        {selectedIso}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {eventsOnSelectedDate.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                            Engagement / Marriage / Function Events on {selectedIso}
                          </div>
                          {eventsOnSelectedDate.map((ev) => {
                            const cd = calculateEventCountdown(ev.date, ev.time);
                            return (
                              <div
                                key={ev.id}
                                className="p-4 border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-1">
                                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                                    {ev.category} Celebration
                                  </div>
                                  <div className="text-sm font-bold font-display">{ev.title}</div>
                                  <div className="text-xs text-slate-600 dark:text-neutral-300">
                                    {ev.coupleNames ? `${ev.coupleNames} · ` : ''}
                                    {[ev.venue, ev.city].filter(Boolean).join(', ') || 'Venue TBD'}
                                  </div>
                                </div>
                                <div className="text-right font-mono tabular-nums">
                                  <div className="text-xs font-bold">
                                    {formatEventTime12h(ev.time)}
                                  </div>
                                  <div className="text-[11px] text-amber-800 dark:text-amber-400">
                                    {cd.statusText}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {tasksOnSelectedDate.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Tasks, Meetings &amp; Visits on {selectedIso}
                          </div>
                          <div className="divide-y divide-stone-100 dark:divide-neutral-800 border border-stone-200 dark:border-neutral-800 rounded-xl px-4">
                            {tasksOnSelectedDate.map((t) => (
                              <div
                                key={t.id}
                                className="py-3 flex items-center justify-between gap-4"
                              >
                                <label className="flex items-start gap-3 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={t.status === 'Done'}
                                    onChange={() => handleToggleTaskDone(t.id)}
                                    className="mt-0.5 w-4 h-4 rounded"
                                  />
                                  <div>
                                    <div
                                      className={`text-sm font-semibold ${
                                        t.status === 'Done' ? 'line-through text-slate-400' : ''
                                      }`}
                                    >
                                      {t.title}
                                    </div>
                                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                      <span>{t.category}</span>
                                      <span>·</span>
                                      <span>{t.priority} Priority</span>
                                      <span>·</span>
                                      <span>{t.status}</span>
                                      {t.address && (
                                        <>
                                          <span>·</span>
                                          <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                              t.address
                                            )}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-800 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                                          >
                                            <MapPin className="w-3 h-3" /> {t.address}
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-neutral-400">
                                    {t.startTime ? formatEventTime12h(t.startTime) : 'Anytime'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTask(t.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* When in Month View, also show a direct Selected Date summary card right under the calendar */}
          {calMode === 'month' && (
            <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold">
                    Selected Date: {selectedDateFormatted} ({selectedIso})
                  </div>
                  <div className="text-xs text-slate-500">
                    {eventsOnSelectedDate.length} Event(s), {tasksOnSelectedDate.length} Task(s),
                    and {paymentsOnSelectedDate.length + weddingExpensesDueOnSelectedDate.length}{' '}
                    Due Payment(s) on this respective date
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalMode('day')}
                className="px-3.5 py-1.5 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                Open Day View for {selectedIso}
              </button>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Selected Date Exclusive Inspector (Events + Tasks + Due Payments on selectedIso ONLY) */}
        <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-5 space-y-5">
          <div className="border-b border-stone-100 dark:border-neutral-800 pb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Events &amp; Tasks on Selected Date Only
            </div>
            <h2 className="text-lg font-bold font-display mt-0.5">{selectedDateFormatted}</h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              {selectedWeekdayName} · {selectedIso} · {eventsOnSelectedDate.length} Event(s) ·{' '}
              {tasksOnSelectedDate.length} Task(s) ·{' '}
              {paymentsOnSelectedDate.length + weddingExpensesDueOnSelectedDate.length} Due
              Payment(s)
            </p>
          </div>

          {/* Quick-Add Task or Event on Selected Date */}
          <form
            onSubmit={handleAddOnSelectedDate}
            className="p-3.5 bg-stone-50 dark:bg-neutral-800/60 border border-stone-200 dark:border-neutral-800 rounded-xl space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                Add to {selectedIso}
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-stone-200 dark:bg-neutral-700 rounded-md">
                <button
                  type="button"
                  onClick={() => setQuickAddType('task')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer ${
                    quickAddType === 'task'
                      ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-neutral-300'
                  }`}
                >
                  + Task / Visit
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAddType('event')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer ${
                    quickAddType === 'event'
                      ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-neutral-300'
                  }`}
                >
                  + Function / Event
                </button>
              </div>
            </div>

            <input
              type="text"
              required
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              placeholder={
                quickAddType === 'event'
                  ? `Function or ceremony title on ${selectedIso}...`
                  : `Task, meeting, or visit title on ${selectedIso}...`
              }
              className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 rounded-lg"
            />

            {quickAddType === 'task' ? (
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={quickTaskCategory}
                  onChange={(e) => setQuickTaskCategory(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 rounded-lg"
                >
                  {workspace.taskCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={quickTaskPriority}
                  onChange={(e) => setQuickTaskPriority(e.target.value as PriorityLevel)}
                  className="px-2 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 rounded-lg"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <input
                  type="time"
                  value={quickTaskTime}
                  onChange={(e) => setQuickTaskTime(e.target.value)}
                  className="px-2 py-1.5 text-xs font-mono bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 rounded-lg tabular-nums"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={quickEventCategory}
                  onChange={(e) =>
                    setQuickEventCategory(
                      e.target.value as 'Engagement' | 'Marriage' | 'Other'
                    )
                  }
                  className="px-2 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 rounded-lg"
                >
                  <option value="Engagement">Engagement Event</option>
                  <option value="Marriage">Marriage Event</option>
                  <option value="Other">Other Function / Ritual</option>
                </select>
                <input
                  type="time"
                  value={quickTaskTime}
                  onChange={(e) => setQuickTaskTime(e.target.value)}
                  className="px-2 py-1.5 text-xs font-mono bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 rounded-lg tabular-nums"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quickTaskLocation}
                onChange={(e) => setQuickTaskLocation(e.target.value)}
                placeholder="Venue / Address (optional)"
                className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 rounded-lg"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add on {selectedIso}</span>
              </button>
            </div>
          </form>

          {/* 1. Ceremony / Function Events on this date */}
          <div className="space-y-2">
            <div className="text-xs font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-400">
              <CalendarHeart className="w-3.5 h-3.5" />
              <span>Events &amp; Functions on {selectedIso}</span>
            </div>
            {eventsOnSelectedDate.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-stone-200 dark:border-neutral-800 rounded-lg">
                No ceremony or function events on {selectedIso}.
              </div>
            ) : (
              <div className="space-y-2">
                {eventsOnSelectedDate.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        [{ev.category}] {ev.title}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatEventTime12h(ev.time)}
                      </span>
                    </div>
                    {ev.coupleNames && (
                      <div className="text-slate-700 dark:text-neutral-200 font-medium">
                        Couple: {ev.coupleNames}
                      </div>
                    )}
                    <div className="text-slate-500">
                      Venue: {[ev.venue, ev.city].filter(Boolean).join(', ') || 'TBD'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Tasks on this date */}
          <div className="space-y-2">
            <div className="text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-neutral-200">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Tasks &amp; Appointments on {selectedIso}</span>
            </div>

            {tasksOnSelectedDate.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-stone-200 dark:border-neutral-800 rounded-lg">
                No tasks scheduled on {selectedIso}.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-neutral-800 border border-stone-200 dark:border-neutral-800 rounded-lg px-3">
                {tasksOnSelectedDate.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={t.status === 'Done'}
                        onChange={() => handleToggleTaskDone(t.id)}
                        className="mt-0.5 w-3.5 h-3.5 rounded"
                      />
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold truncate ${
                            t.status === 'Done' ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {t.title}
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                          <span>{t.category}</span>
                          <span>·</span>
                          <span>{t.priority}</span>
                          {t.startTime && (
                            <>
                              <span>·</span>
                              <span className="font-mono inline-flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> {formatEventTime12h(t.startTime)}
                              </span>
                            </>
                          )}
                          {t.address && (
                            <>
                              <span>·</span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                  t.address
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-800 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                              >
                                <MapPin className="w-3 h-3" /> Map
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.id)}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Payments & Wedding Vendor Dues on this date */}
          {(paymentsOnSelectedDate.length > 0 ||
            weddingExpensesDueOnSelectedDate.length > 0) && (
            <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-neutral-800">
              <div className="text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-neutral-200">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Payments &amp; Vendor Dues on {selectedIso}</span>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-neutral-800 border border-stone-200 dark:border-neutral-800 rounded-lg px-3 text-xs">
                {paymentsOnSelectedDate.map((p) => (
                  <div key={p.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{p.payee}</div>
                      <div className="text-[11px] text-slate-500">{p.title}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-semibold">
                        {formatCurrency(p.amount, workspace.currency)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {p.paid ? 'Paid' : 'Pending'}
                      </div>
                    </div>
                  </div>
                ))}
                {weddingExpensesDueOnSelectedDate.map((exp) => (
                  <div key={exp.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        [{exp.scope}] {exp.particular}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {exp.vendorName || exp.categoryName}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-semibold">
                        {formatCurrency(
                          exp.actualSpent > 0 ? exp.actualSpent : exp.budgetedAmount,
                          workspace.currency
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {exp.isPaid ? 'Paid' : 'Balance Due'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
