import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Mail,
  Phone,
  User,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
  Copy,
} from 'lucide-react';
import { googleSignIn } from '../lib/firebase.ts';
import { AuthenticatedUser, UserWorkspaceData } from '../shared/types.ts';

interface AuthScreenProps {
  onAuthenticated: (token: string, user: AuthenticatedUser, workspace: UserWorkspaceData) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [step, setStep] = useState<'request' | 'verify'>('request');

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // OTP metadata & timers
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [expiryTimer, setExpiryTimer] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(3);

  useEffect(() => {
    if (resendTimer <= 0 && expiryTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      setExpiryTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer, expiryTimer]);

  const handleRequestOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setError('Please enter your mobile number or email address.');
      return;
    }
    if (mode === 'register' && name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          name: mode === 'register' ? name.trim() : undefined,
          identifier: trimmedId,
          email: secondaryEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send OTP.');
      }

      setStep('verify');
      setResendTimer(data.resendCooldownSeconds || 30);
      setExpiryTimer(data.expiresInSeconds || 300);
      setRemainingAttempts(data.maxAttempts || 3);
      setInfoMessage(data.message);
      if (data.devOtpCode) {
        setDevOtpCode(data.devOtpCode);
      } else {
        setDevOtpCode(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    setError(null);

    const codeToVerify = (codeOverride ?? otpInput).trim();
    if (!/^\d{6}$/.test(codeToVerify)) {
      setError('Please enter a valid 6-digit numeric OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: codeToVerify,
          name: mode === 'register' ? name.trim() : undefined,
          email: secondaryEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
        throw new Error(data.error || 'OTP verification failed.');
      }

      onAuthenticated(data.token, data.user, data.workspace);
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const cred = await googleSignIn();
      if (!cred) {
        throw new Error('Google Sign-In was cancelled.');
      }
      const fbUser = cred.user;
      const res = await fetch('/api/auth/firebase-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: fbUser.uid,
          name: fbUser.displayName || 'PlanEase User',
          email: fbUser.email || `${fbUser.uid}@google.user`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to establish Google session.');
      }
      onAuthenticated(data.token, data.user, data.workspace);
    } catch (err: any) {
      setError(err.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 flex flex-col justify-between">
      {/* Top Bar Contract */}
      <header className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-stone-200 bg-white">
        <span className="text-xl font-bold tracking-tight text-slate-900 font-display">
          PlanEase
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <span>Daily Planner</span>
          <span aria-hidden="true">·</span>
          <span>Payments & Bills</span>
          <span aria-hidden="true">·</span>
          <span>Engagement & Marriage Budget</span>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setStep('request');
              setError(null);
              setDevOtpCode(null);
            }}
            className="px-4 py-2 text-xs font-medium text-slate-700 border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors whitespace-nowrap"
          >
            {mode === 'register' ? 'Returning User? Sign In' : 'New User? Create Account'}
          </button>
        </div>
      </header>

      {/* Main Content Split Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Editorial Value Proposition */}
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-medium tracking-wide text-amber-800">
            Personal Organizer · Engagement & Marriage Ledger
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight font-display">
            Organize every daily commitment and milestone wedding expense in one calm workspace.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            PlanEase combines a structured daily task, meeting, and bill checker with a dedicated
            Engagement & Marriage Expense Planner. Every account opens a completely fresh, private
            workspace with zero pre-filled clutter.
          </p>

          <div className="pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-sm font-semibold text-slate-900">1. Daily & Recurring Tasks</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Track meetings, visits with map links, subtasks, and recurring schedules across
                Today, Calendar, and Overdue views.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">2. Marriage Expense Ledger</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                14 customizable wedding categories, vendor contacts, advance vs. balance due math,
                and automatic over-budget variance alerts.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">3. Passwordless OTP Security</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Scrypt-hashed 6-digit OTP login with 5-minute expiry, 3-attempt lockout, and strict
                per-user data isolation.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: OTP Auth Card */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 shadow-xs">
            {/* Segmented Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setStep('request');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                New User Registration
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setStep('request');
                  setError(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Returning User Login
              </button>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && !error && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            {step === 'request' ? (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Priya Sharma"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Mobile Number or Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g., +91 9876543210 or name@email.com"
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Secondary Email / Mobile (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={secondaryEmail}
                        onChange={(e) => setSecondaryEmail(e.target.value)}
                        placeholder="Optional backup email or phone"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <span>{loading ? 'Sending 6-Digit OTP...' : 'Send 6-Digit OTP'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                {/* Dev Mode Live OTP Display Box */}
                {devOtpCode && (
                  <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                      <span>Dev Mode OTP Preview (Console & Screen)</span>
                      <span className="font-mono">{formatCountdown(expiryTimer)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-2xl font-bold font-mono tracking-widest text-slate-900 tabular-nums">
                        {devOtpCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpInput(devOtpCode);
                          handleVerifyOTP(undefined, devOtpCode);
                        }}
                        className="px-3 py-1.5 bg-amber-900 hover:bg-amber-800 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Auto-Fill & Verify</span>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                    <label className="font-medium text-slate-700">Enter 6-Digit OTP</label>
                    <span className="font-mono tabular-nums">
                      Expires in {formatCountdown(expiryTimer)} · {remainingAttempts} attempts left
                    </span>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className="w-full pl-9 pr-3.5 py-2.5 text-lg font-mono tracking-widest bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-slate-900 tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpInput.length !== 6}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{loading ? 'Verifying OTP...' : 'Verify OTP & Open Blank Planner'}</span>
                </button>

                <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('request');
                      setOtpInput('');
                      setError(null);
                    }}
                    className="hover:text-slate-900 underline cursor-pointer"
                  >
                    Change mobile / email
                  </button>

                  <button
                    type="button"
                    disabled={resendTimer > 0 || loading}
                    onClick={() => handleRequestOTP()}
                    className="flex items-center gap-1 font-medium text-slate-800 disabled:text-slate-400 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {resendTimer > 0
                        ? `Resend OTP in ${resendTimer}s`
                        : 'Resend 6-Digit OTP'}
                    </span>
                  </button>
                </div>
              </form>
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-xs text-slate-400">or continue with</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-stone-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <span>Sign in with Google (Cloud Sync)</span>
            </button>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="px-6 md:px-12 py-4 border-t border-stone-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 bg-white">
        <span>PlanEase — Personal Daily Planner & Marriage Expense Tracker</span>
        <span>Zero Pre-Filled Clutter · Isolated User Workspaces · Scrypt OTP Hashing</span>
      </footer>
    </div>
  );
};
