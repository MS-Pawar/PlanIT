import {
  CurrencyCode,
  CustomLabels,
  CustomSubEvent,
  EventParticulars,
  ExpenseCategoryItem,
  ExpenseLineItem,
  UserWorkspaceData,
} from './types.ts';

export const DEFAULT_TASK_CATEGORIES: string[] = [
  'Work',
  'Meeting',
  'Visit/Appointment',
  'Payment/Bill',
  'Function/Event',
  'Shopping',
  'Travel',
  'Personal',
  'Health',
  'Family',
];

export const DEFAULT_MARRIAGE_CATEGORY_NAMES: string[] = [
  'Venue & Hall',
  'Catering & Food',
  'Decoration & Stage',
  'Photography & Videography',
  'Clothes & Jewellery (bride/groom/family)',
  'Makeup & Beauty',
  'Invitation Cards & Printing',
  'Priest/Rituals/Pooja',
  'Music/DJ/Band/Entertainment',
  'Transport & Travel',
  'Accommodation',
  'Gifts & Return Gifts',
  'Mehendi/Haldi/Sangeet/other functions',
  'Miscellaneous',
];

export const DEFAULT_CUSTOM_LABELS: CustomLabels = {
  appName: 'PlanEase',
  dashboardHeading: 'Daily Overview',
  tasksHeading: 'Daily Planner & Tasks',
  calendarHeading: 'Schedule & Calendar',
  paymentsHeading: 'Payments & Bills Tracker',
  marriageHeading: 'Engagement & Marriage Expense Planner',
  reportsHeading: 'Reports & Export Center',
  settingsHeading: 'Workspace Customization & Settings',
  brideLabel: "Bride's Name",
  groomLabel: "Groom's Name",
  venueLabel: 'Primary Venue & Hall',
  budgetLabel: 'Budgeted Amount',
  actualSpentLabel: 'Actual Spent',
  advancePaidLabel: 'Advance Paid',
  balanceDueLabel: 'Balance Due',
};

export function createDefaultMarriageCategories(): ExpenseCategoryItem[] {
  return DEFAULT_MARRIAGE_CATEGORY_NAMES.map((name, index) => ({
    id: `cat_${index + 1}`,
    name,
    order: index,
  }));
}

export function createEmptyEventParticulars(type: 'Engagement' | 'Marriage' | 'Both' = 'Both'): EventParticulars {
  return {
    eventType: type,
    brideName: '',
    groomName: '',
    brideFamily: '',
    groomFamily: '',
    engagementDate: '',
    engagementTime: '',
    marriageDate: '',
    marriageTime: '',
    venue: '',
    city: '',
    guestCount: 0,
    totalBudget: 0,
    notes: '',
  };
}

export function createDefaultSubEvents(): CustomSubEvent[] {
  return [
    {
      id: 'evt_engagement',
      eventCategory: 'Engagement',
      eventTitle: 'Engagement & Ring Ceremony',
      eventDate: '',
      eventTime: '18:30',
      venue: '',
      city: '',
      address: '',
      brideName: '',
      groomName: '',
      brideFamily: '',
      groomFamily: '',
      invocationText: 'With the blessings of the Almighty & our beloved elders',
      hostLine: 'We cordially invite you and your family to celebrate the Engagement Ceremony of',
      bodyWording:
        'As they exchange rings and begin their journey of togetherness, your gracious presence and blessings will make the occasion truly memorable.',
      dressCode: 'Festive Indian / Pastel Formals',
      rsvpContact: '',
      cardTheme: 'ivory-gold',
    },
    {
      id: 'evt_marriage',
      eventCategory: 'Marriage',
      eventTitle: 'Shubh Vivah — Auspicious Wedding Ceremony',
      eventDate: '',
      eventTime: '19:30',
      venue: '',
      city: '',
      address: '',
      brideName: '',
      groomName: '',
      brideFamily: '',
      groomFamily: '',
      invocationText: '|| Shree Ganeshaya Namah ||',
      hostLine: 'Together with their families, we request the honour of your presence at the Wedding Celebration of',
      bodyWording:
        'Join us as they unite in sacred matrimony followed by dinner and celebrations. Kindly grace the occasion with your love and blessings.',
      dressCode: 'Traditional Royal Ethnic',
      rsvpContact: '',
      cardTheme: 'crimson-heritage',
    },
    {
      id: 'evt_other_1',
      eventCategory: 'Other',
      eventTitle: 'Haldi, Mehendi & Sangeet Celebration',
      eventDate: '',
      eventTime: '16:00',
      venue: '',
      city: '',
      address: '',
      brideName: '',
      groomName: '',
      brideFamily: '',
      groomFamily: '',
      invocationText: 'An Evening of Music, Colours & Joy',
      hostLine: 'You are warmly invited to join the pre-wedding festivities celebrating',
      bodyWording:
        'Come celebrate with vibrant colours, henna, music, and dance as both families come together in joy.',
      dressCode: 'Vibrant Festive / Indo-Western',
      rsvpContact: '',
      cardTheme: 'emerald-botanical',
    },
  ];
}

export interface EventCountdownResult {
  hasDate: boolean;
  days: number;
  hours: number;
  minutes: number;
  isToday: boolean;
  isPast: boolean;
  statusText: string;
}

/**
 * Formats a Date object as YYYY-MM-DD in the user's local timezone (avoids UTC shift bugs).
 */
export function toLocalIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date at noon (12:00:00) so day-of-week and date math never shift across DST or UTC boundaries.
 */
export function parseLocalIsoDate(isoStr: string): Date {
  const parts = (isoStr || '').trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  }
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

export function getLocalTodayIso(): string {
  return toLocalIsoDate(new Date());
}

export function calculateEventCountdown(dateStr: string, timeStr?: string): EventCountdownResult {
  if (!dateStr || !dateStr.trim()) {
    return {
      hasDate: false,
      days: 0,
      hours: 0,
      minutes: 0,
      isToday: false,
      isPast: false,
      statusText: 'Date not set',
    };
  }

  const cleanTime = timeStr && /^\d{2}:\d{2}$/.test(timeStr.trim()) ? timeStr.trim() : '10:00';
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const [hh, mm] = cleanTime.split(':').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  if (Number.isNaN(target.getTime())) {
    return {
      hasDate: false,
      days: 0,
      hours: 0,
      minutes: 0,
      isToday: false,
      isPast: false,
      statusText: 'Invalid date',
    };
  }

  const now = new Date();
  const todayIso = toLocalIsoDate(now);
  const isToday = dateStr.trim() === todayIso;
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    const pastDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return {
      hasDate: true,
      days: pastDays,
      hours: 0,
      minutes: 0,
      isToday,
      isPast: !isToday,
      statusText: isToday ? 'Happening Today!' : `${pastDays} day(s) ago`,
    };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    hasDate: true,
    days,
    hours,
    minutes,
    isToday,
    isPast: false,
    statusText: days === 0 ? `Today in ${hours}h ${minutes}m` : `${days}d ${hours}h remaining`,
  };
}

export function formatEventTime12h(timeStr?: string): string {
  if (!timeStr) return 'Time TBD';
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function formatEventDateReadable(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return 'Date to be announced';
  const d = parseLocalIsoDate(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function buildPersonalizedInvitationText(
  evt: CustomSubEvent,
  guestName?: string
): { subject: string; body: string } {
  const bride = evt.brideName?.trim() || 'Bride';
  const groom = evt.groomName?.trim() || 'Groom';
  const salutation = guestName?.trim() ? `Dear ${guestName.trim()} & Family,` : 'Dear Family & Friends,';
  const formattedDate = formatEventDateReadable(evt.eventDate);
  const formattedTime = formatEventTime12h(evt.eventTime);
  const venueLine = [evt.venue, evt.city].filter(Boolean).join(', ') || 'Venue to be announced';

  const subject = `Formal Invitation: ${evt.eventTitle} — ${bride} & ${groom}`;

  const lines: string[] = [
    evt.invocationText || 'With Warm Blessings',
    '',
    salutation,
    '',
    evt.hostLine || 'We cordially invite you to the celebration of',
    `✨ ${bride} & ${groom} ✨`,
  ];

  if (evt.brideFamily || evt.groomFamily) {
    const familyParts = [
      evt.brideFamily ? `Bride's Family: ${evt.brideFamily}` : '',
      evt.groomFamily ? `Groom's Family: ${evt.groomFamily}` : '',
    ].filter(Boolean);
    lines.push(...familyParts);
  }

  lines.push(
    '',
    `Occasion: ${evt.eventTitle}`,
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Venue: ${venueLine}`,
  );

  if (evt.address) {
    lines.push(`Location: ${evt.address}`);
  }

  lines.push('', evt.bodyWording || 'We look forward to celebrating together with you.');

  if (evt.dressCode) {
    lines.push(`Dress Code: ${evt.dressCode}`);
  }
  if (evt.rsvpContact) {
    lines.push(`RSVP / Contact: ${evt.rsvpContact}`);
  }

  return {
    subject,
    body: lines.join('\n'),
  };
}

/**
 * Every new user starts with a completely fresh, empty workspace.
 * Zero pre-filled tasks, zero pre-filled expenses, zero pre-filled names or amounts.
 */
export function createEmptyWorkspace(): UserWorkspaceData {
  return {
    tasks: [],
    payments: [],
    taskCategories: [...DEFAULT_TASK_CATEGORIES],
    eventParticulars: createEmptyEventParticulars('Marriage'),
    engagementParticulars: createEmptyEventParticulars('Engagement'),
    subEvents: createDefaultSubEvents(),
    marriageCategories: createDefaultMarriageCategories(),
    expenseItems: [],
    guests: [],
    vendors: [],
    currency: 'INR',
    theme: 'light',
    customLabels: { ...DEFAULT_CUSTOM_LABELS },
    updatedAt: new Date().toISOString(),
  };
}

export interface LineItemComputedMetrics {
  budgeted: number;
  actual: number;
  advance: number;
  variance: number; // Budget minus Actual
  isOverBudget: boolean; // Actual > Budget (when budget > 0 or actual > 0)
  balanceDue: number; // Remaining unpaid amount
}

export function calculateLineItemMetrics(
  item: Pick<ExpenseLineItem, 'budgetedAmount' | 'actualSpent' | 'advancePaid' | 'isPaid'>
): LineItemComputedMetrics {
  const budgeted = Math.max(0, Number(item.budgetedAmount) || 0);
  const actual = Math.max(0, Number(item.actualSpent) || 0);
  const advance = Math.max(0, Number(item.advancePaid) || 0);
  const variance = budgeted - actual;
  const isOverBudget = actual > budgeted;
  const effectiveLiability = actual > 0 ? actual : budgeted;
  const rawBalance = Math.max(0, effectiveLiability - advance);
  const balanceDue = item.isPaid ? 0 : rawBalance;

  return {
    budgeted,
    actual,
    advance,
    variance,
    isOverBudget,
    balanceDue,
  };
}

export interface CategorySummaryRow {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  budgetedTotal: number;
  actualTotal: number;
  advanceTotal: number;
  balanceDueTotal: number;
  varianceTotal: number;
  isOverBudget: boolean;
  percentOfSpend: number;
}

export interface ExpenseReportSummary {
  declaredEventBudget: number;
  totalAllocatedBudget: number;
  effectiveTotalBudget: number;
  totalActualSpent: number;
  totalAdvancePaid: number;
  totalBalanceDue: number;
  totalPendingPaymentsCount: number;
  totalVariance: number;
  percentBudgetUsed: number;
  overBudgetItemsCount: number;
  categoryBreakdown: CategorySummaryRow[];
}

export function calculateExpenseReport(
  categories: ExpenseCategoryItem[],
  items: ExpenseLineItem[],
  declaredEventBudget: number
): ExpenseReportSummary {
  let totalAllocatedBudget = 0;
  let totalActualSpent = 0;
  let totalAdvancePaid = 0;
  let totalBalanceDue = 0;
  let totalPendingPaymentsCount = 0;
  let overBudgetItemsCount = 0;

  const byCat = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      itemCount: number;
      budgetedTotal: number;
      actualTotal: number;
      advanceTotal: number;
      balanceDueTotal: number;
    }
  >();

  for (const cat of [...categories].sort((a, b) => a.order - b.order)) {
    byCat.set(cat.id, {
      categoryId: cat.id,
      categoryName: cat.name,
      itemCount: 0,
      budgetedTotal: 0,
      actualTotal: 0,
      advanceTotal: 0,
      balanceDueTotal: 0,
    });
  }

  for (const item of items) {
    const m = calculateLineItemMetrics(item);
    totalAllocatedBudget += m.budgeted;
    totalActualSpent += m.actual;
    totalAdvancePaid += m.advance;
    totalBalanceDue += m.balanceDue;
    if (!item.isPaid && m.balanceDue > 0) {
      totalPendingPaymentsCount += 1;
    }
    if (m.isOverBudget) {
      overBudgetItemsCount += 1;
    }

    let group = byCat.get(item.categoryId);
    if (!group) {
      group = {
        categoryId: item.categoryId || 'uncategorized',
        categoryName: item.categoryName || 'Miscellaneous',
        itemCount: 0,
        budgetedTotal: 0,
        actualTotal: 0,
        advanceTotal: 0,
        balanceDueTotal: 0,
      };
      byCat.set(group.categoryId, group);
    }

    group.itemCount += 1;
    group.budgetedTotal += m.budgeted;
    group.actualTotal += m.actual;
    group.advanceTotal += m.advance;
    group.balanceDueTotal += m.balanceDue;
  }

  const effectiveTotalBudget =
    declaredEventBudget > 0 ? declaredEventBudget : totalAllocatedBudget;
  const totalVariance = effectiveTotalBudget - totalActualSpent;
  const percentBudgetUsed =
    effectiveTotalBudget > 0
      ? Math.round((totalActualSpent / effectiveTotalBudget) * 1000) / 10
      : 0;

  const categoryBreakdown: CategorySummaryRow[] = Array.from(byCat.values()).map((g) => {
    const varianceTotal = g.budgetedTotal - g.actualTotal;
    const percentOfSpend =
      totalActualSpent > 0 ? Math.round((g.actualTotal / totalActualSpent) * 1000) / 10 : 0;
    return {
      ...g,
      varianceTotal,
      isOverBudget: g.actualTotal > g.budgetedTotal,
      percentOfSpend,
    };
  });

  return {
    declaredEventBudget,
    totalAllocatedBudget,
    effectiveTotalBudget,
    totalActualSpent,
    totalAdvancePaid,
    totalBalanceDue,
    totalPendingPaymentsCount,
    totalVariance,
    percentBudgetUsed,
    overBudgetItemsCount,
    categoryBreakdown,
  };
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'INR'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const localeMap: Record<CurrencyCode, string> = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    AED: 'en-AE',
    SGD: 'en-SG',
  };
  try {
    return new Intl.NumberFormat(localeMap[currency] || 'en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(safeAmount);
  } catch {
    return `₹${safeAmount.toLocaleString('en-IN')}`;
  }
}

export function createDemoWorkspace(): UserWorkspaceData {
  const today = new Date();
  const fmt = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const categories = createDefaultMarriageCategories();

  return {
    tasks: [
      {
        id: 'demo_task_1',
        title: 'Final tasting session with Royal Heritage Caterers',
        description: 'Confirm live chaat counters, welcome drinks, and Jain menu count.',
        category: 'Function/Event',
        priority: 'High',
        date: fmt(0),
        startTime: '11:00',
        endTime: '13:00',
        location: 'Grand Ballroom Kitchen, Taj Palace',
        status: 'Pending',
        tags: ['catering', 'wedding'],
        notes: 'Bring both parents along for dessert selection.',
        attachmentName: 'Menu_Proposal_v3.pdf',
        recurrence: 'None',
        subtasks: [
          { id: 'st_1', title: 'Confirm welcome drink options', done: true },
          { id: 'st_2', title: 'Finalize plated sit-down dinner price per plate', done: false },
        ],
        reminderAt: '10:00',
        emailReminder: true,
        attendees: 'Rohan Sharma, Chef Vikram',
        contactPhone: '+91 98201 11223',
        address: 'Taj Palace Hotel, Sardar Patel Marg, New Delhi',
        payee: '',
        amount: 0,
        paymentMode: 'UPI',
        isPaid: false,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo_task_2',
        title: 'Settle stage floral & mandap lighting advance',
        description: 'Pay 40% booking deposit to Aura Event Decorators.',
        category: 'Payment/Bill',
        priority: 'High',
        date: fmt(0),
        startTime: '15:30',
        endTime: '16:00',
        location: 'Online NEFT Transfer',
        status: 'In Progress',
        tags: ['payment', 'decor'],
        notes: 'Collect GST invoice after transfer.',
        attachmentName: '',
        recurrence: 'None',
        subtasks: [],
        reminderAt: '15:00',
        emailReminder: false,
        attendees: '',
        contactPhone: '+91 98112 44556',
        address: '',
        payee: 'Aura Event Decorators',
        amount: 85000,
        paymentMode: 'Bank Transfer',
        isPaid: false,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo_task_3',
        title: 'Bridal lehenga & sherwani trial fitting',
        description: 'Verify alterations and dupatta draping pins at flagship studio.',
        category: 'Visit/Appointment',
        priority: 'Medium',
        date: fmt(1),
        startTime: '17:00',
        endTime: '18:30',
        location: 'Mehrauli Designer Studio',
        status: 'Pending',
        tags: ['attire', 'fitting'],
        notes: 'Carry wedding footwear for exact hemline measurement.',
        attachmentName: '',
        recurrence: 'None',
        subtasks: [],
        reminderAt: '16:00',
        emailReminder: false,
        attendees: 'Ananya, Aarav, Master Tailor',
        contactPhone: '+91 99100 77889',
        address: 'One Style Mile, Mehrauli, New Delhi',
        payee: '',
        amount: 0,
        paymentMode: 'Card',
        isPaid: false,
        sortOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    payments: [
      {
        id: 'demo_pay_1',
        payee: 'The Suryaa Grand Lawn & Banquet',
        title: 'Second venue milestone installment',
        amount: 250000,
        dueDate: fmt(3),
        paid: false,
        paymentMode: 'Bank Transfer',
        category: 'Venue & Hall',
        notes: 'RTGS to corporate escrow account',
        createdAt: new Date().toISOString(),
      },
    ],
    taskCategories: [...DEFAULT_TASK_CATEGORIES],
    eventParticulars: {
      eventType: 'Both',
      brideName: 'Ananya Verma',
      groomName: 'Aarav Kapoor',
      brideFamily: 'Mr. Rajesh & Mrs. Sunita Verma',
      groomFamily: 'Mr. Vikram & Mrs. Meera Kapoor',
      engagementDate: fmt(14),
      engagementTime: '18:30',
      marriageDate: fmt(45),
      marriageTime: '19:30',
      venue: 'The Suryaa Grand Heritage Lawns',
      city: 'New Delhi',
      guestCount: 450,
      totalBudget: 2500000,
      notes: 'Two-day celebration including Engagement & Sangeet on Day 1 and Muhurtham & Reception on Day 2.',
    },
    engagementParticulars: {
      eventType: 'Engagement',
      brideName: 'Ananya Verma',
      groomName: 'Aarav Kapoor',
      brideFamily: 'Mr. Rajesh & Mrs. Sunita Verma',
      groomFamily: 'Mr. Vikram & Mrs. Meera Kapoor',
      engagementDate: fmt(14),
      engagementTime: '18:30',
      marriageDate: fmt(45),
      marriageTime: '19:30',
      venue: 'Crystal Ballroom, The Imperial',
      city: 'New Delhi',
      guestCount: 180,
      totalBudget: 450000,
      notes: 'Ring ceremony followed by high-tea and acoustic evening.',
    },
    subEvents: [
      {
        id: 'evt_engagement',
        eventCategory: 'Engagement',
        eventTitle: 'Engagement & Ring Ceremony',
        eventDate: fmt(14),
        eventTime: '18:30',
        venue: 'Crystal Ballroom, The Imperial',
        city: 'New Delhi',
        address: 'Janpath, Connaught Place, New Delhi',
        brideName: 'Ananya Verma',
        groomName: 'Aarav Kapoor',
        brideFamily: 'Mr. Rajesh & Mrs. Sunita Verma',
        groomFamily: 'Mr. Vikram & Mrs. Meera Kapoor',
        invocationText: 'With the blessings of the Almighty & our beloved elders',
        hostLine: 'We cordially invite you and your family to celebrate the Engagement Ceremony of',
        bodyWording:
          'As they exchange rings and begin their journey of togetherness, your gracious presence and blessings will make the occasion truly memorable.',
        dressCode: 'Pastel Indian Formals / Cocktail Attire',
        rsvpContact: '+91 98101 11222 (Verma & Kapoor Families)',
        cardTheme: 'ivory-gold',
      },
      {
        id: 'evt_marriage',
        eventCategory: 'Marriage',
        eventTitle: 'Shubh Vivah — Auspicious Wedding Ceremony',
        eventDate: fmt(45),
        eventTime: '19:30',
        venue: 'The Suryaa Grand Heritage Lawns',
        city: 'New Delhi',
        address: 'New Friends Colony, New Delhi',
        brideName: 'Ananya Verma',
        groomName: 'Aarav Kapoor',
        brideFamily: 'Mr. Rajesh & Mrs. Sunita Verma',
        groomFamily: 'Mr. Vikram & Mrs. Meera Kapoor',
        invocationText: '|| Shree Ganeshaya Namah ||',
        hostLine: 'Together with their families, we request the honour of your presence at the Wedding Celebration of',
        bodyWording:
          'Baraat Swagat at 7:00 PM · Pheras & Muhurtham at 8:30 PM · Grand Reception Dinner to follow.',
        dressCode: 'Traditional Royal Ethnic',
        rsvpContact: '+91 98101 11222',
        cardTheme: 'crimson-heritage',
      },
      {
        id: 'evt_other_1',
        eventCategory: 'Other',
        eventTitle: 'Mehendi & Sangeet Gala Night',
        eventDate: fmt(44),
        eventTime: '17:30',
        venue: 'Emerald Courtyard, The Suryaa Grand',
        city: 'New Delhi',
        address: 'New Friends Colony, New Delhi',
        brideName: 'Ananya Verma',
        groomName: 'Aarav Kapoor',
        brideFamily: 'Mr. Rajesh & Mrs. Sunita Verma',
        groomFamily: 'Mr. Vikram & Mrs. Meera Kapoor',
        invocationText: 'An Evening of Henna, Music & Celebration',
        hostLine: 'Join us for an unforgettable evening of music, dance, and joy celebrating',
        bodyWording:
          'High-tea & Mehendi at 5:30 PM followed by Family Sangeet performances and Gala Dinner at 8:00 PM.',
        dressCode: 'Emerald Green / Shimmer Indo-Western',
        rsvpContact: '+91 98101 11222',
        cardTheme: 'emerald-botanical',
      },
    ],
    marriageCategories: categories,
    expenseItems: [
      {
        id: 'demo_exp_1',
        scope: 'Marriage',
        particular: 'Main Lawn & Banquet Hall Rental (2 Days)',
        categoryId: 'cat_1',
        categoryName: 'Venue & Hall',
        vendorName: 'The Suryaa Grand',
        vendorContact: '+91 11 4567 8900',
        budgetedAmount: 650000,
        actualSpent: 650000,
        advancePaid: 400000,
        dueDate: fmt(3),
        isPaid: false,
        notes: 'Includes valet parking and bridal suite',
        order: 0,
      },
      {
        id: 'demo_exp_2',
        scope: 'Marriage',
        particular: 'Gourmet Wedding Gala Dinner & Sangeet Buffet (450 pax)',
        categoryId: 'cat_2',
        categoryName: 'Catering & Food',
        vendorName: 'Royal Heritage Caterers',
        vendorContact: '+91 98201 11223',
        budgetedAmount: 550000,
        actualSpent: 595000,
        advancePaid: 200000,
        dueDate: fmt(10),
        isPaid: false,
        notes: 'Over-budget due to imported fruit & live artisan dessert bar',
        order: 1,
      },
      {
        id: 'demo_exp_6',
        scope: 'Engagement',
        particular: 'Crystal Ballroom Hall & High-Tea Package',
        categoryId: 'cat_1',
        categoryName: 'Venue & Hall',
        vendorName: 'The Imperial Banquet',
        vendorContact: '+91 11 2334 1234',
        budgetedAmount: 220000,
        actualSpent: 215000,
        advancePaid: 150000,
        dueDate: fmt(7),
        isPaid: false,
        notes: '180 guests confirmed',
        order: 2,
      },
    ],
    guests: [
      {
        id: 'demo_guest_1',
        scope: 'Both',
        name: 'Sharma Family (Uncle & Aunt)',
        side: 'Bride',
        headcount: 4,
        phone: '+91 98101 23456',
        email: 'sharma.family@example.com',
        city: 'Jaipur',
        inviteSent: true,
        invitedEvents: ['Engagement', 'Marriage'],
        rsvpStatus: 'Confirmed',
        accommodationNeeded: true,
        notes: 'Arriving morning before Engagement, need 2 double rooms',
      },
      {
        id: 'demo_guest_2',
        scope: 'Marriage',
        name: 'Rohan Malhotra & Family',
        side: 'Groom',
        headcount: 3,
        phone: '+91 98202 34567',
        email: 'rohan.malhotra@example.com',
        city: 'Mumbai',
        inviteSent: false,
        invitedEvents: [],
        rsvpStatus: 'Pending',
        accommodationNeeded: true,
        notes: 'Airport pickup at 10:30 AM',
      },
      {
        id: 'demo_guest_3',
        scope: 'Both',
        name: 'Priya Nair & Colleagues',
        side: 'Common',
        headcount: 5,
        phone: '',
        email: 'priya.nair@example.com',
        city: 'New Delhi',
        inviteSent: false,
        invitedEvents: [],
        rsvpStatus: 'Pending',
        accommodationNeeded: false,
        notes: 'Local guests (Email available)',
      },
    ],
    vendors: [
      {
        id: 'demo_vendor_1',
        name: 'Royal Heritage Caterers',
        category: 'Catering & Food',
        contactPerson: 'Chef Vikram',
        phone: '+91 98201 11223',
        email: 'events@royalheritagecaterers.in',
        address: 'Okhla Phase III, New Delhi',
        contractedAmount: 595000,
        notes: 'FSSAI certified, includes 45 uniformed servers',
      },
    ],
    currency: 'INR',
    theme: 'light',
    customLabels: { ...DEFAULT_CUSTOM_LABELS },
    updatedAt: new Date().toISOString(),
  };
}
