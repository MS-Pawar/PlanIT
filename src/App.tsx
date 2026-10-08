/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CreditCard,
  HeartHandshake,
  FileBarChart,
  Settings,
  LogOut,
  Plus,
  Sun,
  Moon,
  Menu,
  X,
  CheckCircle2,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  loadFirestoreWorkspace,
  saveFirestoreWorkspace,
   signOut as firebaseSignOut,
  syncFirebaseUserProfile,
} from './lib/firebase.ts';
import { createEmptyWorkspace } from './shared/calculations.ts';
import { AuthenticatedUser, UserWorkspaceData } from './shared/types.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { PaymentsView } from './components/PaymentsView.tsx';
import { MarriagePlannerView } from './components/MarriagePlannerView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

type NavSection =
  | 'dashboard'
  | 'tasks'
  | 'calendar'
  | 'payments'
  | 'marriage'
  | 'reports'
  | 'settings';

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    sessionStorage.getItem('planease_session_token')
  );
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [workspace, setWorkspace] = useState<UserWorkspaceData>(() => createEmptyWorkspace());
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Restore session on mount
  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      if (!sessionToken) {
        if (mounted) setAuthLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) {
          sessionStorage.removeItem('planease_session_token');
          if (mounted) {
            setSessionToken(null);
            setUser(null);
          }
        } else {
          const data = await res.json();
          if (mounted) {
            setUser(data.user);
            setWorkspace(data.workspace || createEmptyWorkspace());
          }
        }
      } catch {
        // Ignore network errors on initial boot
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }
    restoreSession();
    return () => {
      mounted = false;
    };
  }, [sessionToken]);

  // Listen for Firebase Auth state when user logs in via Google
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.emailVerified) {
        try {
          await syncFirebaseUserProfile(
            fbUser.uid,
            fbUser.displayName || 'PlanEase User',
            fbUser.email || fbUser.uid
          );
          const cloudWorkspace = await loadFirestoreWorkspace(fbUser.uid);
          if (cloudWorkspace) {
            setWorkspace(cloudWorkspace);
          }
        } catch (err) {
          console.error('Firestore sync info:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut: press 'N' (when not typing in an input) to open New Task modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!user) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setActiveNav('tasks');
        setNewTaskModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  const handleAuthenticated = (
    token: string,
    authedUser: AuthenticatedUser,
    initialWorkspace: UserWorkspaceData
  ) => {
    sessionStorage.setItem('planease_session_token', token);
    setSessionToken(token);
    setUser(authedUser);
    setWorkspace(initialWorkspace || createEmptyWorkspace());
    setActiveNav('dashboard');
    showToast(`Welcome, ${authedUser.name}!`);
  };

  // Auto-save workspace changes to backend API and Firestore (if Google-authenticated)
  const handleUpdateWorkspace = useCallback(
    (updater: (prev: UserWorkspaceData) => UserWorkspaceData) => {
      setWorkspace((prev) => {
        const next = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };

        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
          if (sessionToken) {
            try {
              await fetch('/api/workspace', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify(next),
              });
            } catch (e) {
              console.error('Auto-save error:', e);
            }
          }

          if (auth.currentUser && auth.currentUser.emailVerified) {
            try {
              await saveFirestoreWorkspace(auth.currentUser.uid, next);
            } catch (e) {
              console.error('Cloud save error:', e);
            }
          }
        }, 350);

        return next;
      });
    },
    [sessionToken]
  );

  const handleLogout = async () => {
    if (sessionToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {
        // Ignore
      }
    }
    if (auth.currentUser) {
      try {
        await firebaseSignOut(auth);
      } catch {
        // Ignore
      }
    }
    sessionStorage.removeItem('planease_session_token');
    setSessionToken(null);
    setUser(null);
    setWorkspace(createEmptyWorkspace());
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">Loading PlanEase workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const isDark = workspace.theme === 'dark';

  const navItems: { id: NavSection; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks & Planner', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'marriage', label: 'Marriage Planner', icon: HeartHandshake },
    { id: 'reports', label: 'Reports & Export', icon: FileBarChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-stone-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 flex">
        {/* Sidebar Navigation (260px Desktop) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white dark:bg-neutral-900 border-r border-stone-200 dark:border-neutral-800 shrink-0 justify-between no-print">
          <div className="p-5 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold tracking-tight font-display">
                {workspace.customLabels.appName || 'PlanEase'}
              </span>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {workspace.currency}
              </span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                        : 'text-slate-600 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Account Footer in Sidebar */}
          <div className="p-4 border-t border-stone-200 dark:border-neutral-800 space-y-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{user.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate font-mono">
                {user.identifier}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 px-3 text-xs font-medium text-slate-600 dark:text-neutral-400 hover:text-red-600 border border-stone-200 dark:border-neutral-800 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Contract */}
          <header className="h-15 px-4 md:px-8 border-b border-stone-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4 no-print">
            {/* Zone 1: Mobile Menu Trigger + Breadcrumb */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-600 dark:text-neutral-300"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="text-xs font-medium text-slate-500 dark:text-neutral-400 flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {workspace.customLabels.appName || 'PlanEase'}
                </span>
                <span>/</span>
                <span className="capitalize">{activeNav}</span>
              </div>
            </div>

            {/* Zone 2: Quick Section Switch Links on Desktop */}
            <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-600 dark:text-neutral-400">
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('tasks')}
                className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Daily Tasks
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('marriage')}
                className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Marriage Expense Tracker
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('reports')}
                className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Final Report
              </button>
            </nav>

            {/* Zone 3: 1-2 Primary Actions */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  handleUpdateWorkspace((prev) => ({
                    ...prev,
                    theme: prev.theme === 'dark' ? 'light' : 'dark',
                  }))
                }
                title="Toggle Light/Dark Theme"
                className="p-2 border border-stone-200 dark:border-neutral-800 rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveNav('tasks');
                  setNewTaskModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Quick Task (N)</span>
              </button>
            </div>
          </header>

          {/* Mobile Drawer Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden bg-white dark:bg-neutral-900 border-b border-stone-200 dark:border-neutral-800 p-4 space-y-1 no-print">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg ${
                      activeNav === item.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 dark:text-neutral-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-red-600"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out ({user.name})</span>
              </button>
            </div>
          )}

          {/* Main Content Viewport */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
            {activeNav === 'dashboard' && (
              <DashboardView
                workspace={workspace}
                onToggleTaskDone={(taskId) => {
                  handleUpdateWorkspace((prev) => ({
                    ...prev,
                    tasks: prev.tasks.map((t) =>
                      t.id === taskId
                        ? { ...t, status: t.status === 'Done' ? 'Pending' : 'Done' }
                        : t
                    ),
                  }));
                  showToast('Task status updated.');
                }}
                onNavigate={(sec) => setActiveNav(sec)}
                onOpenNewTaskModal={() => {
                  setActiveNav('tasks');
                  setNewTaskModalOpen(true);
                }}
              />
            )}

            {activeNav === 'tasks' && (
              <TasksView
                workspace={workspace}
                onUpdateWorkspace={handleUpdateWorkspace}
                showToast={showToast}
                externalModalOpen={newTaskModalOpen}
                setExternalModalOpen={setNewTaskModalOpen}
              />
            )}

            {activeNav === 'calendar' && (
              <CalendarView
                workspace={workspace}
                onUpdateWorkspace={handleUpdateWorkspace}
                showToast={showToast}
              />
            )}

            {activeNav === 'payments' && (
              <PaymentsView
                workspace={workspace}
                onUpdateWorkspace={handleUpdateWorkspace}
                showToast={showToast}
              />
            )}

            {activeNav === 'marriage' && (
              <MarriagePlannerView
                workspace={workspace}
                onUpdateWorkspace={handleUpdateWorkspace}
                showToast={showToast}
                onNavigateToReports={() => setActiveNav('reports')}
                sessionToken={sessionToken}
              />
            )}

            {activeNav === 'reports' && (
              <ReportsView workspace={workspace} showToast={showToast} />
            )}

            {activeNav === 'settings' && (
              <SettingsView
                workspace={workspace}
                onUpdateWorkspace={handleUpdateWorkspace}
                showToast={showToast}
              />
            )}
          </main>
        </div>

        {/* Toast Feedback Notification */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 px-4 py-2.5 rounded-lg shadow-md flex items-center gap-2 text-xs font-semibold no-print">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
