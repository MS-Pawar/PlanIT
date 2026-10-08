export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Pending' | 'In Progress' | 'Done' | 'Postponed';
export type RecurrenceType = 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
export type PaymentMode = 'UPI' | 'Bank Transfer' | 'Card' | 'Cash' | 'Cheque' | 'Other';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';
export type EventTypeOption = 'Engagement' | 'Marriage' | 'Both';
export type EventTabScope = 'Engagement' | 'Marriage';
export type InvitationThemeStyle =
  | 'ivory-gold'
  | 'crimson-heritage'
  | 'emerald-botanical'
  | 'midnight-regal';

export interface SubtaskItem {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: PriorityLevel;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  status: TaskStatus;
  tags: string[];
  notes: string;
  attachmentName: string;
  recurrence: RecurrenceType;
  customRecurrenceDays?: number;
  subtasks: SubtaskItem[];
  reminderAt: string;
  emailReminder: boolean;
  // Meeting / Visit specific fields
  attendees: string;
  contactPhone: string;
  address: string;
  // Payment specific fields
  payee: string;
  amount: number;
  paymentMode: PaymentMode;
  isPaid: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StandalonePayment {
  id: string;
  payee: string;
  title: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paid: boolean;
  paymentMode: PaymentMode;
  category: string;
  notes: string;
  linkedTaskId?: string;
  linkedExpenseId?: string;
  createdAt: string;
}

export interface EventParticulars {
  eventType: EventTypeOption;
  brideName: string;
  groomName: string;
  brideFamily: string;
  groomFamily: string;
  engagementDate: string;
  engagementTime?: string;
  marriageDate: string;
  marriageTime?: string;
  venue: string;
  city: string;
  guestCount: number;
  totalBudget: number;
  notes: string;
}

export interface CustomSubEvent {
  id: string;
  eventCategory: 'Engagement' | 'Marriage' | 'Other';
  eventTitle: string; // e.g., "Ring Ceremony & Engagement", "Shubh Vivah (Wedding Ceremony)", "Mehendi & Sangeet Night"
  eventDate: string; // YYYY-MM-DD
  eventTime: string; // e.g., "19:00" or "7:00 PM Onwards"
  venue: string;
  city: string;
  address: string;
  brideName: string;
  groomName: string;
  brideFamily: string;
  groomFamily: string;
  invocationText: string;
  hostLine: string;
  bodyWording: string;
  dressCode: string;
  rsvpContact: string;
  cardTheme: InvitationThemeStyle;
}

export interface ExpenseCategoryItem {
  id: string;
  name: string;
  order: number;
}

export interface ExpenseLineItem {
  id: string;
  scope: EventTabScope; // 'Engagement' | 'Marriage'
  particular: string;
  categoryId: string;
  categoryName: string;
  vendorName: string;
  vendorContact: string;
  budgetedAmount: number;
  actualSpent: number;
  advancePaid: number;
  dueDate: string; // YYYY-MM-DD
  isPaid: boolean; // Paid / Pending
  notes: string;
  order: number;
}

export interface GuestItem {
  id: string;
  scope: 'Engagement' | 'Marriage' | 'Both' | 'Other';
  name: string;
  side: 'Bride' | 'Groom' | 'Common';
  headcount: number;
  phone: string;
  email?: string;
  city: string;
  inviteSent: boolean;
  invitedEvents?: string[]; // List of event titles or categories sent
  lastInvitedAt?: string;
  lastInvitedChannel?: string;
  rsvpStatus: 'Confirmed' | 'Pending' | 'Declined';
  accommodationNeeded: boolean;
  notes: string;
}

export interface VendorItem {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  contractedAmount: number;
  notes: string;
}

export interface CustomLabels {
  appName: string;
  dashboardHeading: string;
  tasksHeading: string;
  calendarHeading: string;
  paymentsHeading: string;
  marriageHeading: string;
  reportsHeading: string;
  settingsHeading: string;
  brideLabel: string;
  groomLabel: string;
  venueLabel: string;
  budgetLabel: string;
  actualSpentLabel: string;
  advancePaidLabel: string;
  balanceDueLabel: string;
}

export interface UserWorkspaceData {
  tasks: TaskItem[];
  payments: StandalonePayment[];
  taskCategories: string[];
  eventParticulars: EventParticulars;
  engagementParticulars: EventParticulars;
  subEvents?: CustomSubEvent[];
  marriageCategories: ExpenseCategoryItem[];
  expenseItems: ExpenseLineItem[];
  guests: GuestItem[];
  vendors: VendorItem[];
  currency: CurrencyCode;
  theme: 'light' | 'dark';
  customLabels: CustomLabels;
  updatedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  identifier: string;
  email?: string;
  mobile?: string;
  authMethod: 'otp' | 'google';
}
