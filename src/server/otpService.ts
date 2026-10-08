import crypto from 'crypto';
import {
  buildPersonalizedInvitationText,
  calculateEventCountdown,
  calculateExpenseReport,
  calculateLineItemMetrics,
  createDefaultMarriageCategories,
  createDefaultSubEvents,
} from '../shared/calculations.ts';
import { runDirtyDozenSecurityTests } from '../../firestore.rules.test.ts';

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
export const OTP_MAX_ATTEMPTS = 3;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const RATE_LIMIT_MAX_REQUESTS = 8;

export interface OtpChallengeRecord {
  id: string;
  identifier: string;
  otpHash: string;
  salt: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number; // unix ms
  resendAfter: number; // unix ms
  consumed: boolean;
  pendingName?: string;
  pendingEmail?: string;
  pendingMobile?: string;
  createdAt: number;
}

/**
 * Generates a cryptographically random 6-digit numeric OTP string.
 */
export function generateSixDigitOTP(): string {
  const num = crypto.randomInt(100000, 1000000);
  return String(num);
}

/**
 * Hashes a 6-digit OTP using scrypt with a unique random salt.
 * Never store OTPs in plain text.
 */
export function hashOTP(otpCode: string, salt?: string): { otpHash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(otpCode.trim(), usedSalt, 32);
  return {
    otpHash: derivedKey.toString('hex'),
    salt: usedSalt,
  };
}

/**
 * Constant-time verification of a candidate OTP against a stored scrypt hash.
 */
export function verifyOTPHash(candidateOtp: string, storedHash: string, salt: string): boolean {
  try {
    const candidateHash = crypto.scryptSync(candidateOtp.trim(), salt, 32);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateHash.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateHash, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Creates a new OTP challenge enforcing the 30-second resend cooldown.
 */
export function createOTPChallenge(
  identifier: string,
  existingChallenge: OtpChallengeRecord | undefined,
  nowMs: number = Date.now(),
  meta?: { name?: string; email?: string; mobile?: string }
): { challenge: OtpChallengeRecord; plainOtp: string } {
  if (existingChallenge && !existingChallenge.consumed && nowMs < existingChallenge.resendAfter) {
    const waitSeconds = Math.ceil((existingChallenge.resendAfter - nowMs) / 1000);
    throw new Error(`Please wait ${waitSeconds}s before requesting another OTP.`);
  }

  const plainOtp = generateSixDigitOTP();
  const { otpHash, salt } = hashOTP(plainOtp);

  const challenge: OtpChallengeRecord = {
    id: crypto.randomUUID(),
    identifier: identifier.toLowerCase().trim(),
    otpHash,
    salt,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt: nowMs + OTP_EXPIRY_MS,
    resendAfter: nowMs + OTP_RESEND_COOLDOWN_MS,
    consumed: false,
    pendingName: meta?.name,
    pendingEmail: meta?.email,
    pendingMobile: meta?.mobile,
    createdAt: nowMs,
  };

  return { challenge, plainOtp };
}

/**
 * Validates an OTP submission against expiry, max attempts (3), and cryptographic hash.
 */
export function validateOTPSubmission(
  challenge: OtpChallengeRecord | undefined,
  submittedOtp: string,
  nowMs: number = Date.now()
): { valid: boolean; error?: string; remainingAttempts?: number } {
  if (!challenge) {
    return { valid: false, error: 'No active OTP request found. Please request a new OTP.' };
  }
  if (challenge.consumed) {
    return { valid: false, error: 'This OTP has already been used. Please request a new OTP.' };
  }
  if (nowMs > challenge.expiresAt) {
    challenge.consumed = true;
    return { valid: false, error: 'OTP has expired (5-minute limit). Please request a new OTP.' };
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    challenge.consumed = true;
    return { valid: false, error: 'Maximum verification attempts (3) exceeded. Please request a new OTP.' };
  }

  challenge.attempts += 1;
  const isMatch = verifyOTPHash(submittedOtp, challenge.otpHash, challenge.salt);

  if (!isMatch) {
    const remaining = Math.max(0, challenge.maxAttempts - challenge.attempts);
    if (remaining === 0) {
      challenge.consumed = true;
      return {
        valid: false,
        error: 'Invalid OTP. Maximum 3 attempts reached — this OTP is now invalidated.',
        remainingAttempts: 0,
      };
    }
    return {
      valid: false,
      error: `Invalid OTP code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      remainingAttempts: remaining,
    };
  }

  challenge.consumed = true;
  return { valid: true, remainingAttempts: challenge.maxAttempts - challenge.attempts };
}

/**
 * Built-in Automated Test Suite for OTP Flow, Expense Calculations, and Firestore Rules.
 */
export function runBackendUnitTests() {
  const results: { suite: string; name: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // Test 1: OTP Generation & Scrypt Hashing (Never Plaintext)
  try {
    const otp = generateSixDigitOTP();
    const { otpHash, salt } = hashOTP(otp);
    const okFormat = /^\d{6}$/.test(otp);
    const notPlaintext = otpHash !== otp && otpHash.length === 64;
    const verifiesCorrect = verifyOTPHash(otp, otpHash, salt);
    const rejectsWrong = !verifyOTPHash('000000', otpHash, salt) || otp === '000000';
    const pass = okFormat && notPlaintext && verifiesCorrect && rejectsWrong;
    results.push({
      suite: 'OTP Auth',
      name: '6-digit generation & scrypt cryptographic hashing',
      status: pass ? 'PASS' : 'FAIL',
      details: `Generated 6-digit OTP, hashed to 64-char hex with 16-byte salt, timingSafeEqual verified.`,
    });
  } catch (e: any) {
    results.push({ suite: 'OTP Auth', name: '6-digit generation & scrypt hashing', status: 'FAIL', details: e.message });
  }

  // Test 2: OTP 5-Minute Expiry Enforcement
  try {
    const t0 = 1700000000000;
    const { challenge, plainOtp } = createOTPChallenge('test@planease.app', undefined, t0);
    const expiredCheck = validateOTPSubmission(challenge, plainOtp, t0 + OTP_EXPIRY_MS + 1000);
    const pass = !expiredCheck.valid && expiredCheck.error?.includes('expired') === true;
    results.push({
      suite: 'OTP Auth',
      name: '5-minute OTP expiry enforcement',
      status: pass ? 'PASS' : 'FAIL',
      details: expiredCheck.error || 'Expiry verified',
    });
  } catch (e: any) {
    results.push({ suite: 'OTP Auth', name: '5-minute OTP expiry enforcement', status: 'FAIL', details: e.message });
  }

  // Test 3: OTP Max 3 Attempts Lockout
  try {
    const t0 = 1700000000000;
    const { challenge, plainOtp } = createOTPChallenge('lockout@planease.app', undefined, t0);
    const a1 = validateOTPSubmission(challenge, '000001', t0 + 1000);
    const a2 = validateOTPSubmission(challenge, '000002', t0 + 2000);
    const a3 = validateOTPSubmission(challenge, '000003', t0 + 3000);
    // Even if 4th attempt supplies the right OTP, it must be rejected because max 3 attempts were reached
    const a4 = validateOTPSubmission(challenge, plainOtp, t0 + 4000);
    const pass = !a1.valid && !a2.valid && !a3.valid && !a4.valid && challenge.consumed === true;
    results.push({
      suite: 'OTP Auth',
      name: 'Max 3 verification attempts lockout',
      status: pass ? 'PASS' : 'FAIL',
      details: '3 wrong attempts invalidated challenge; 4th attempt with valid OTP blocked.',
    });
  } catch (e: any) {
    results.push({ suite: 'OTP Auth', name: 'Max 3 verification attempts lockout', status: 'FAIL', details: e.message });
  }

  // Test 4: OTP 30-Second Resend Cooldown
  try {
    const t0 = 1700000000000;
    const { challenge } = createOTPChallenge('cooldown@planease.app', undefined, t0);
    let blockedEarly = false;
    try {
      createOTPChallenge('cooldown@planease.app', challenge, t0 + 15000);
    } catch {
      blockedEarly = true;
    }
    const allowedAfter30s = createOTPChallenge('cooldown@planease.app', challenge, t0 + 31000);
    const pass = blockedEarly && Boolean(allowedAfter30s.plainOtp);
    results.push({
      suite: 'OTP Auth',
      name: '30-second resend cooldown enforcement',
      status: pass ? 'PASS' : 'FAIL',
      details: 'Resend at +15s rejected; resend at +31s succeeded.',
    });
  } catch (e: any) {
    results.push({ suite: 'OTP Auth', name: '30-second resend cooldown enforcement', status: 'FAIL', details: e.message });
  }

  // Test 5: Expense Line-Item Variance, Over-Budget Detection & Balance Due
  try {
    const underBudgetItem = calculateLineItemMetrics({
      budgetedAmount: 200000,
      actualSpent: 185000,
      advancePaid: 100000,
      isPaid: false,
    });
    const overBudgetItem = calculateLineItemMetrics({
      budgetedAmount: 150000,
      actualSpent: 175000,
      advancePaid: 50000,
      isPaid: false,
    });
    const settledItem = calculateLineItemMetrics({
      budgetedAmount: 100000,
      actualSpent: 100000,
      advancePaid: 40000,
      isPaid: true,
    });

    const pass =
      underBudgetItem.variance === 15000 &&
      !underBudgetItem.isOverBudget &&
      underBudgetItem.balanceDue === 85000 &&
      overBudgetItem.variance === -25000 &&
      overBudgetItem.isOverBudget &&
      overBudgetItem.balanceDue === 125000 &&
      settledItem.balanceDue === 0;

    results.push({
      suite: 'Marriage Expense Math',
      name: 'Line-item variance, over-budget flag & balance due calculation',
      status: pass ? 'PASS' : 'FAIL',
      details: `Under-budget (+15,000, bal 85,000), Over-budget (-25,000, bal 125,000), Paid item (bal 0).`,
    });
  } catch (e: any) {
    results.push({ suite: 'Marriage Expense Math', name: 'Line-item variance & balance math', status: 'FAIL', details: e.message });
  }

  // Test 6: Category & Grand Total Report Aggregation
  try {
    const cats = createDefaultMarriageCategories();
    const report = calculateExpenseReport(
      cats,
      [
        {
          id: '1',
          scope: 'Marriage',
          particular: 'Hall',
          categoryId: 'cat_1',
          categoryName: 'Venue & Hall',
          vendorName: 'Taj',
          vendorContact: '',
          budgetedAmount: 500000,
          actualSpent: 500000,
          advancePaid: 300000,
          dueDate: '2026-11-01',
          isPaid: false,
          notes: '',
          order: 0,
        },
        {
          id: '2',
          scope: 'Marriage',
          particular: 'Catering',
          categoryId: 'cat_2',
          categoryName: 'Catering & Food',
          vendorName: 'Royal',
          vendorContact: '',
          budgetedAmount: 400000,
          actualSpent: 450000,
          advancePaid: 450000,
          dueDate: '2026-11-01',
          isPaid: true,
          notes: '',
          order: 1,
        },
      ],
      1000000
    );

    const pass =
      report.totalAllocatedBudget === 900000 &&
      report.totalActualSpent === 950000 &&
      report.totalAdvancePaid === 750000 &&
      report.totalBalanceDue === 200000 &&
      report.totalVariance === 50000 &&
      report.percentBudgetUsed === 95 &&
      report.overBudgetItemsCount === 1 &&
      report.totalPendingPaymentsCount === 1;

    results.push({
      suite: 'Marriage Expense Math',
      name: 'Grand totals, % budget used & category aggregation',
      status: pass ? 'PASS' : 'FAIL',
      details: `Budget: 10,00,000 | Spent: 9,50,000 (95%) | Advance: 7,50,000 | Balance Due: 2,00,000.`,
    });
  } catch (e: any) {
    results.push({ suite: 'Marriage Expense Math', name: 'Grand totals report aggregation', status: 'FAIL', details: e.message });
  }

  // Test 7: Firestore Rules Dirty Dozen Red-Team Verification
  const dirtyDozenSummary = runDirtyDozenSecurityTests();
  results.push({
    suite: 'Firestore Security',
    name: 'Red Team "Dirty Dozen" adversarial payloads blocked (12/12)',
    status: dirtyDozenSummary.failed === 0 ? 'PASS' : 'FAIL',
    details: `${dirtyDozenSummary.passed}/12 adversarial payloads rejected with PERMISSION_DENIED.`,
  });

  // Test 8: Event Countdown & Separate Formal Invitation Reflection
  try {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const cd = calculateEventCountdown(futureDate, '19:30');
    const templates = createDefaultSubEvents();
    const customMarriage = {
      ...templates[1],
      brideName: 'Ananya Verma',
      groomName: 'Aarav Kapoor',
      eventDate: futureDate,
      eventTime: '19:30',
      venue: 'Taj Palace Grand Lawns',
      city: 'New Delhi',
    };
    const personalized = buildPersonalizedInvitationText(customMarriage, 'Sharma Family');
    const pass =
      cd.hasDate &&
      cd.days >= 9 &&
      personalized.body.includes('Dear Sharma Family & Family,') &&
      personalized.body.includes('Ananya Verma & Aarav Kapoor') &&
      personalized.body.includes('Taj Palace Grand Lawns, New Delhi') &&
      personalized.body.includes('7:30 PM');
    results.push({
      suite: 'Event Countdown & Invitations',
      name: 'Separate Engagement/Marriage/Other countdown & formal invitation live sync',
      status: pass ? 'PASS' : 'FAIL',
      details: `Countdown (${cd.days}d remaining) and personalized formal invitation wording verified.`,
    });
  } catch (e: any) {
    results.push({
      suite: 'Event Countdown & Invitations',
      name: 'Separate Engagement/Marriage/Other countdown & formal invitation live sync',
      status: 'FAIL',
      details: e.message,
    });
  }

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  return {
    passed: passedCount,
    total: results.length,
    allPassed: passedCount === results.length,
    results,
  };
}
