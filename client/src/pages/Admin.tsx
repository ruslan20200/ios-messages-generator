// MODIFIED BY AI: 2026-02-13 - redesign admin panel with elastic iOS styling, adaptive layout and smooth motion
// FILE: client/src/pages/Admin.tsx

import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { apiRequest, apiRequestWithMeta, ApiError } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type SessionItem = {
  id: number;
  userId: number;
  login: string;
  role: string;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
  loginTime: string;
  lastSeen: string;
  isActive: boolean;
};

type UsersResponse = {
  success: boolean;
  data: {
    users: AuthUser[];
  };
};

type SessionsResponse = {
  success: boolean;
  data: {
    sessions: SessionItem[];
    activeCount: number;
  };
};

type OnaySignInResponse = {
  success: boolean;
  data?: {
    token: string;
    shortToken: string;
    deviceId: string;
  };
  message?: string;
};

type OnayQrStartResponse = {
  success: boolean;
  data?: {
    route: string | null;
    plate: string | null;
    cost: number | null;
    terminal: string | null;
    pan: string | null;
  };
  message?: string;
};

type OnayLatencyEndpoint = "sign-in" | "qr-start";

const formatDate = (value: string | null) => {
  if (!value) return "Permanent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const shortDevice = (deviceId: string | null) => {
  if (!deviceId) return "not linked";
  if (deviceId.length < 16) return deviceId;
  return `${deviceId.slice(0, 8)}...${deviceId.slice(-4)}`;
};

const maskToken = (value: string) => {
  if (!value) return "";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
};

const toFutureIso = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
};

const glassCardClass =
  "rounded-2xl border border-white/10 bg-[#101114]/85 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]";

const interactiveBtnClass =
  "transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const SESSIONS_AUTO_REFRESH_MS = 15000;
const SWIPE_OPEN_THRESHOLD = 48;
const SWIPE_CLOSE_THRESHOLD = 32;

export default function Admin() {
  const { user, token, logout } = useAuth();
  const [, navigate] = useLocation();

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [sessionLoginFilter, setSessionLoginFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  // MODIFIED BY AI: 2026-02-13 - add dedicated sessions refresh state to avoid full page reload
  // FILE: client/src/pages/Admin.tsx
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [sessionsUpdatedAt, setSessionsUpdatedAt] = useState<Date | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  const [swipedUserId, setSwipedUserId] = useState<number | null>(null);
  const swipeStartXRef = useRef<Record<number, number>>({});

  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // MODIFIED BY AI: 2026-02-12 - add password visibility toggle in admin create-user form
  // FILE: client/src/pages/Admin.tsx
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newTerm, setNewTerm] = useState<"3m" | "6m" | "permanent">("3m");
  // MODIFIED BY AI: 2026-02-13 - add Onay tools state (sign-in + terminal test) in admin panel
  // FILE: client/src/pages/Admin.tsx
  const [onayTerminal, setOnayTerminal] = useState("");
  const [onayBusy, setOnayBusy] = useState(false);
  const [onayError, setOnayError] = useState("");
  const [onayTokens, setOnayTokens] = useState<OnaySignInResponse["data"] | null>(null);
  const [onayTrip, setOnayTrip] = useState<OnayQrStartResponse["data"] | null>(null);
  // MODIFIED BY AI: 2026-02-12 - track server latency header for Onay requests (last + average)
  // FILE: client/src/pages/Admin.tsx
  const [onayLastLatencyMs, setOnayLastLatencyMs] = useState<number | null>(null);
  const [onayLatencySamples, setOnayLatencySamples] = useState<number[]>([]);
  const [onayLatencyUpdatedAt, setOnayLatencyUpdatedAt] = useState<Date | null>(null);
  const [onayLastLatencyEndpoint, setOnayLastLatencyEndpoint] =
    useState<OnayLatencyEndpoint | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.role !== "admin") {
      navigate("/chat?mode=api", { replace: true });
    }
  }, [user, navigate]);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await apiRequest<UsersResponse>("/admin/users", { token });
      setUsers(response.data.users);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token]);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const response = await apiRequest<SessionsResponse>("/admin/sessions", { token });
      setSessions(response.data.sessions);
      setActiveCount(response.data.activeCount);
      setSessionsUpdatedAt(new Date());
    } finally {
      setIsLoadingSessions(false);
    }
  }, [token]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      await Promise.all([loadUsers(), loadSessions()]);
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError("Failed to load admin data");
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadUsers, loadSessions]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((entry) => {
      const byRole = roleFilter === "all" || entry.role === roleFilter;
      if (!byRole) return false;
      if (!query) return true;

      return (
        entry.login.toLowerCase().includes(query) ||
        (entry.deviceId || "").toLowerCase().includes(query)
      );
    });
  }, [users, search, roleFilter]);

  const filteredSessions = useMemo(() => {
    if (!sessionLoginFilter) return sessions;
    const q = sessionLoginFilter.toLowerCase();
    return sessions.filter((session) => session.login.toLowerCase().includes(q));
  }, [sessions, sessionLoginFilter]);

  const runAction = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError("");

    try {
      await action();
      await Promise.all([loadUsers(), loadSessions()]);
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError("Action failed");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newLogin.trim() || !newPassword) {
      setError("Fill login and password");
      return;
    }

    const expiresAt =
      newTerm === "permanent"
        ? null
        : newTerm === "3m"
          ? toFutureIso(3)
          : toFutureIso(6);

    await runAction(async () => {
      await apiRequest("/admin/users", {
        method: "POST",
        token,
        body: JSON.stringify({
          login: newLogin,
          password: newPassword,
          role: newRole,
          expires_at: expiresAt,
        }),
      });

      setNewLogin("");
      setNewPassword("");
      setShowCreatePassword(false);
      setNewRole("user");
      setNewTerm("3m");
      setShowCreateForm(false);
    });
  };

  const resetDevice = async (targetUserId: number) => {
    await runAction(async () => {
      await apiRequest(`/admin/users/${targetUserId}/reset-device`, {
        method: "POST",
        token,
      });
    });
  };

  const deleteUser = async (targetUserId: number) => {
    if (!window.confirm("Delete user and all related sessions?")) return;

    await runAction(async () => {
      await apiRequest(`/admin/users/${targetUserId}`, {
        method: "DELETE",
        token,
      });
    });
  };

  const extendUser = async (targetUserId: number, mode: "3m" | "6m" | "permanent") => {
    await runAction(async () => {
      await apiRequest(`/admin/users/${targetUserId}/extend`, {
        method: "POST",
        token,
        body: JSON.stringify(
          mode === "permanent"
            ? { permanent: true }
            : { months: mode === "3m" ? 3 : 6 },
        ),
      });
    });
  };

  // MODIFIED BY AI: 2026-02-12 - allow deleting single session log from admin sessions block
  // FILE: client/src/pages/Admin.tsx
  const deleteSession = async (sessionId: number) => {
    if (!window.confirm("Delete this session log?")) return;

    setIsBusy(true);
    setError("");

    try {
      await apiRequest(`/admin/sessions/${sessionId}`, {
        method: "DELETE",
        token,
      });
      await refreshSessions();
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError("Failed to delete session");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const cleanupExpired = async (mode: "deactivate" | "delete") => {
    const confirmed =
      mode === "delete"
        ? window.confirm("Delete all expired users permanently?")
        : true;

    if (!confirmed) return;

    await runAction(async () => {
      await apiRequest("/admin/cleanup-expired", {
        method: "POST",
        token,
        body: JSON.stringify({ mode }),
      });
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const runOnayAction = async (
    endpoint: OnayLatencyEndpoint,
    action: () => Promise<void>,
  ) => {
    setOnayBusy(true);
    setOnayError("");

    try {
      await action();
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        recordOnayLatency(apiError.headers, endpoint);
        setOnayError(apiError.message);
      } else if (apiError instanceof Error) {
        setOnayError(apiError.message);
      } else {
        setOnayError("Onay action failed");
      }
    } finally {
      setOnayBusy(false);
    }
  };

  const recordOnayLatency = (
    headers: Headers | null | undefined,
    endpoint: OnayLatencyEndpoint,
  ) => {
    if (!headers) return;
    const rawLatency = headers.get("x-onay-latency-ms");
    if (!rawLatency) return;

    const latencyMs = Number.parseInt(rawLatency, 10);
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return;

    setOnayLastLatencyMs(latencyMs);
    setOnayLatencyUpdatedAt(new Date());
    setOnayLastLatencyEndpoint(endpoint);
    setOnayLatencySamples((prev) => [...prev.slice(-19), latencyMs]);
  };

  const onayAvgLatencyMs = useMemo(() => {
    if (onayLatencySamples.length === 0) return null;
    const total = onayLatencySamples.reduce((acc, value) => acc + value, 0);
    return Math.round(total / onayLatencySamples.length);
  }, [onayLatencySamples]);

  const handleOnaySignIn = async () => {
    await runOnayAction("sign-in", async () => {
      const response = await apiRequestWithMeta<OnaySignInResponse>("/api/onay/sign-in", {
        method: "POST",
        token,
      });
      recordOnayLatency(response.headers, "sign-in");

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Onay sign-in failed");
      }

      setOnayTokens(response.data.data);
    });
  };

  const handleOnayTerminalCheck = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedTerminal = onayTerminal.trim();
    if (!trimmedTerminal) {
      setOnayError("Enter terminal code");
      return;
    }

    await runOnayAction("qr-start", async () => {
      const response = await apiRequestWithMeta<OnayQrStartResponse>("/api/onay/qr-start", {
        method: "POST",
        token,
        body: JSON.stringify({ terminal: trimmedTerminal }),
      });
      recordOnayLatency(response.headers, "qr-start");

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Terminal check failed");
      }

      setOnayTrip(response.data.data);
    });
  };

  const refreshSessions = useCallback(
    async (options?: { silent?: boolean }) => {
      setIsRefreshingSessions(true);
      if (!options?.silent) {
        setError("");
      }

      try {
        await loadSessions();
      } catch (apiError) {
        if (!options?.silent) {
          if (apiError instanceof ApiError) {
            setError(apiError.message);
          } else {
            setError("Failed to refresh sessions");
          }
        }
      } finally {
        setIsRefreshingSessions(false);
      }
    },
    [loadSessions],
  );

  const refreshUsers = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setError("");
      }

      try {
        await loadUsers();
      } catch (apiError) {
        if (!options?.silent) {
          if (apiError instanceof ApiError) {
            setError(apiError.message);
          } else {
            setError("Failed to refresh users");
          }
        }
      }
    },
    [loadUsers],
  );

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    if (!isAutoRefreshEnabled) return;
    if (!isPageVisible) return;

    const timer = window.setInterval(() => {
      void refreshSessions({ silent: true });
    }, SESSIONS_AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [user, isAutoRefreshEnabled, isPageVisible, refreshSessions]);

  const onUserTouchStart = (userId: number, clientX: number) => {
    swipeStartXRef.current[userId] = clientX;
  };

  const onUserTouchEnd = (userId: number, clientX: number) => {
    const start = swipeStartXRef.current[userId];
    if (typeof start !== "number") return;

    const delta = clientX - start;
    if (delta <= -SWIPE_OPEN_THRESHOLD) {
      setSwipedUserId(userId);
    } else if (delta >= SWIPE_CLOSE_THRESHOLD) {
      setSwipedUserId(null);
    }

    delete swipeStartXRef.current[userId];
  };

  const closeSwipe = () => setSwipedUserId(null);

  const handleSwipeResetDevice = async (targetUserId: number) => {
    closeSwipe();
    await resetDevice(targetUserId);
  };

  const handleSwipeDeleteUser = async (targetUserId: number) => {
    closeSwipe();
    await deleteUser(targetUserId);
  };

  const handleSwipeExtend = async (targetUserId: number, mode: "3m" | "6m" | "permanent") => {
    closeSwipe();
    await extendUser(targetUserId, mode);
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-[#050507] text-white flex items-center justify-center overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 bg-cyan-500/10 blur-3xl rounded-full" />
        <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-blue-500/10 blur-3xl rounded-full" />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-6 space-y-4 animate-pulse">
          <div className={`${glassCardClass} p-4 h-40`} />
          <div className={`${glassCardClass} p-4 h-52`} />
          <div className={`${glassCardClass} p-4 h-64`} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-white px-4 py-6 safe-area-top safe-area-bottom">
      <div className="pointer-events-none absolute -top-24 -left-16 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-44 -right-10 w-72 h-72 rounded-full bg-blue-500/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/2 -translate-x-1/2 w-[500px] h-[260px] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-5xl space-y-4 pb-8">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={`${glassCardClass} sticky top-2 z-20 p-4 space-y-3`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
              <p className="text-sm text-gray-400">Smooth iOS-style control center</p>
            </div>
            <button
              onClick={handleLogout}
              className={`rounded-xl border border-white/20 px-3 py-2 text-sm bg-white/5 hover:bg-white/10 ${interactiveBtnClass}`}
            >
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => setShowCreateForm((prev) => !prev)}
              className={`rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#2f9bff] px-3 py-2 text-sm font-semibold shadow-[0_6px_18px_rgba(10,132,255,0.35)] ${interactiveBtnClass}`}
            >
              + Create user
            </button>
            <button
              onClick={() => cleanupExpired("deactivate")}
              disabled={isBusy}
              className={`rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 ${interactiveBtnClass}`}
            >
              Cleanup (deactivate)
            </button>
            <button
              onClick={() => cleanupExpired("delete")}
              disabled={isBusy}
              className={`rounded-xl border border-red-400/45 bg-red-950/25 px-3 py-2 text-sm text-red-200 hover:bg-red-900/35 ${interactiveBtnClass}`}
            >
              Cleanup (delete)
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300">
            Active sessions: <span className="text-white font-semibold">{activeCount}</span>
          </div>
        </motion.header>

        <AnimatePresence initial={false}>
          {showCreateForm ? (
            <motion.form
              key="create-user"
              onSubmit={handleCreateUser}
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className={`${glassCardClass} p-4 grid gap-3`}
            >
              <h2 className="text-lg font-semibold">Create user</h2>

              <input
                value={newLogin}
                onChange={(event) => setNewLogin(event.target.value)}
                placeholder="login"
                className="rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#0A84FF]/70 transition-colors"
              />
              <div className="relative">
                <input
                  type={showCreatePassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="password"
                  className="w-full rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 pr-11 outline-none focus:border-[#0A84FF]/70 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
                  aria-label={showCreatePassword ? "Hide password" : "Show password"}
                >
                  {showCreatePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value === "admin" ? "admin" : "user")}
                  className="rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#0A84FF]/70 transition-colors"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>

                <select
                  value={newTerm}
                  onChange={(event) => setNewTerm(event.target.value as "3m" | "6m" | "permanent")}
                  className="rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#0A84FF]/70 transition-colors"
                >
                  <option value="3m">3 months</option>
                  <option value="6m">6 months</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className={`rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#2f9bff] px-3 py-2.5 text-sm font-semibold ${interactiveBtnClass}`}
              >
                Create
              </button>
            </motion.form>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {error ? (
            <motion.div
              key={error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.02 }}
          className={`${glassCardClass} p-4 space-y-3`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Onay Tools</h2>
            <button
              onClick={handleOnaySignIn}
              disabled={onayBusy}
              className={`rounded-lg bg-gradient-to-r from-[#0A84FF] to-[#2f9bff] px-3 py-2 text-xs font-semibold ${interactiveBtnClass}`}
            >
              Refresh token bundle
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Test Onay endpoints directly from admin panel: <code>/api/onay/sign-in</code> and{" "}
            <code>/api/onay/qr-start</code>.
          </p>

          {/* MODIFIED BY AI: 2026-02-12 - show live Onay latency metrics from X-Onay-Latency-Ms header */}
          {/* FILE: client/src/pages/Admin.tsx */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100/90">
            <div>
              last latency:{" "}
              <span className="font-semibold text-cyan-50">
                {onayLastLatencyMs !== null ? `${onayLastLatencyMs} ms` : "-"}
              </span>
            </div>
            <div>
              average latency:{" "}
              <span className="font-semibold text-cyan-50">
                {onayAvgLatencyMs !== null ? `${onayAvgLatencyMs} ms` : "-"}
              </span>
            </div>
            <div>
              samples:{" "}
              <span className="font-semibold text-cyan-50">{onayLatencySamples.length}</span>
            </div>
            <div>
              endpoint:{" "}
              <span className="font-semibold text-cyan-50">{onayLastLatencyEndpoint || "-"}</span>
            </div>
            <div className="sm:col-span-2">
              updated:{" "}
              <span className="font-semibold text-cyan-50">
                {onayLatencyUpdatedAt ? onayLatencyUpdatedAt.toLocaleTimeString() : "-"}
              </span>
            </div>
          </div>

          {onayError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {onayError}
            </div>
          ) : null}

          <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
            <div className="text-sm font-semibold text-white">Sign-in result</div>
            <div>deviceId: {onayTokens?.deviceId || "-"}</div>
            <div>token: {onayTokens?.token ? maskToken(onayTokens.token) : "-"}</div>
            <div>shortToken: {onayTokens?.shortToken ? maskToken(onayTokens.shortToken) : "-"}</div>
          </div>

          <form onSubmit={handleOnayTerminalCheck} className="space-y-2">
            <label className="text-sm text-gray-300">Check terminal</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={onayTerminal}
                onChange={(event) => setOnayTerminal(event.target.value)}
                placeholder="Terminal code (e.g. 9909)"
                className="flex-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#0A84FF]/70 transition-colors"
              />
              <button
                type="submit"
                disabled={onayBusy}
                className={`rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-sm hover:bg-white/10 ${interactiveBtnClass}`}
              >
                Run
              </button>
            </div>
          </form>

          <div className="grid gap-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
            <div className="text-sm font-semibold text-white">Terminal result</div>
            <div>route: {onayTrip?.route || "-"}</div>
            <div>plate: {onayTrip?.plate || "-"}</div>
            <div>cost: {typeof onayTrip?.cost === "number" ? onayTrip.cost : "-"}</div>
            <div>terminal: {onayTrip?.terminal || "-"}</div>
            <div>pan: {onayTrip?.pan || "-"}</div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className={`${glassCardClass} p-4 space-y-3`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Users</h2>
              <div className="text-xs text-gray-500 sm:hidden">
                Swipe left on a card for quick actions
              </div>
            </div>
            <button
              onClick={() => void refreshUsers()}
              disabled={isLoadingUsers}
              className={`rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
            >
              {isLoadingUsers ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search login/device"
              className="flex-1 rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#0A84FF]/70 transition-colors"
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "all" | "admin" | "user")}
              className="rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#0A84FF]/70 transition-colors"
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="grid gap-3">
            {isLoadingUsers && users.length === 0 ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={`user-skeleton-${idx}`}
                  className="h-28 rounded-xl border border-white/10 bg-white/5 animate-pulse"
                />
              ))
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {filteredUsers.map((entry, index) => (
                    <motion.article
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.14) }}
                      key={entry.id}
                      className="relative rounded-xl border border-white/10 bg-white/5 overflow-hidden"
                    >
                      <div className="sm:hidden absolute inset-y-0 right-0 w-44 grid grid-cols-2 gap-2 p-2 bg-[#0d0f13] border-l border-white/10">
                        <button
                          onClick={() => void handleSwipeResetDevice(entry.id)}
                          disabled={isBusy}
                          className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-[11px] ${interactiveBtnClass}`}
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => void handleSwipeExtend(entry.id, "3m")}
                          disabled={isBusy}
                          className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-[11px] ${interactiveBtnClass}`}
                        >
                          +3M
                        </button>
                        <button
                          onClick={() => void handleSwipeExtend(entry.id, "6m")}
                          disabled={isBusy}
                          className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-[11px] ${interactiveBtnClass}`}
                        >
                          +6M
                        </button>
                        <button
                          onClick={() => void handleSwipeDeleteUser(entry.id)}
                          disabled={isBusy}
                          className={`rounded-lg border border-red-500/50 bg-red-950/20 px-2 py-2 text-[11px] text-red-200 ${interactiveBtnClass}`}
                        >
                          Delete
                        </button>
                      </div>

                      <motion.div
                        animate={{ x: swipedUserId === entry.id ? -176 : 0 }}
                        transition={{ type: "spring", stiffness: 330, damping: 28 }}
                        onTouchStart={(event) =>
                          onUserTouchStart(entry.id, event.changedTouches[0]?.clientX ?? 0)
                        }
                        onTouchEnd={(event) =>
                          onUserTouchEnd(entry.id, event.changedTouches[0]?.clientX ?? 0)
                        }
                        onClick={() => {
                          if (swipedUserId === entry.id) {
                            closeSwipe();
                          }
                        }}
                        className="relative z-10 p-3 space-y-3 bg-[#10141b]/95"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold">{entry.login}</div>
                            <div className="text-xs text-gray-400">
                              Role: {entry.role} | Expires: {formatDate(entry.expiresAt)}
                            </div>
                            <div className="text-xs text-gray-500">Device: {shortDevice(entry.deviceId)}</div>
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSessionLoginFilter(entry.login);
                            }}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            View logs
                          </button>
                        </div>

                        <div className="hidden sm:grid grid-cols-4 gap-2">
                          <button
                            onClick={() => resetDevice(entry.id)}
                            disabled={isBusy}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            Reset Device
                          </button>
                          <button
                            onClick={() => extendUser(entry.id, "3m")}
                            disabled={isBusy}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            +3 Months
                          </button>
                          <button
                            onClick={() => extendUser(entry.id, "6m")}
                            disabled={isBusy}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            +6 Months
                          </button>
                          <button
                            onClick={() => deleteUser(entry.id)}
                            disabled={isBusy}
                            className={`rounded-lg border border-red-500/50 bg-red-950/20 px-2 py-2.5 text-xs text-red-200 hover:bg-red-900/30 ${interactiveBtnClass}`}
                          >
                            Delete
                          </button>
                        </div>
                      </motion.div>
                    </motion.article>
                  ))}
                </AnimatePresence>

                {filteredUsers.length === 0 ? (
                  <div className="text-sm text-gray-400">No users for current filters</div>
                ) : null}
              </>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
          className={`${glassCardClass} p-4 space-y-3`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Sessions and login logs</h2>
              <div className="text-xs text-gray-500">
                Last update: {sessionsUpdatedAt ? sessionsUpdatedAt.toLocaleTimeString() : "not loaded"}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={() => setIsAutoRefreshEnabled((prev) => !prev)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${interactiveBtnClass} ${
                  isAutoRefreshEnabled
                    ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100"
                    : "border-white/20 bg-white/5 text-gray-200"
                }`}
              >
                Auto {isAutoRefreshEnabled ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => void refreshSessions()}
                disabled={isRefreshingSessions || isLoadingSessions}
                className={`rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
              >
                {isRefreshingSessions ? "Refreshing..." : "Refresh"}
              </button>
              {sessionLoginFilter ? (
                <button
                  onClick={() => setSessionLoginFilter("")}
                  className={`rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                >
                  Clear filter
                </button>
              ) : null}
            </div>
          </div>

          {!isPageVisible && isAutoRefreshEnabled ? (
            <div className="text-xs text-amber-200/80 rounded-lg border border-amber-300/30 bg-amber-500/10 px-2.5 py-1.5">
              Auto refresh paused while tab is inactive
            </div>
          ) : null}
          {isLoadingSessions && sessions.length > 0 ? (
            <div className="text-xs text-cyan-100/80 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1.5">
              Syncing latest sessions...
            </div>
          ) : null}

          <div className="grid gap-2 max-h-[420px] overflow-auto pr-1">
            {isLoadingSessions && sessions.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={`session-skeleton-${idx}`}
                  className="h-20 rounded-xl border border-white/10 bg-white/5 animate-pulse"
                />
              ))
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {filteredSessions.map((session) => (
                    <motion.article
                      layout
                      key={session.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold">{session.login}</span>
                        <span className={session.isActive ? "text-green-400" : "text-gray-400"}>
                          {session.isActive ? "active" : "closed"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-400 space-y-1">
                        <div>device: {shortDevice(session.deviceId)}</div>
                        <div>ip: {session.ip || "-"}</div>
                        <div>login time: {new Date(session.loginTime).toLocaleString()}</div>
                        <div>last seen: {new Date(session.lastSeen).toLocaleString()}</div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => void deleteSession(session.id)}
                          disabled={isBusy || isRefreshingSessions}
                          className={`rounded-lg border border-red-500/50 bg-red-950/20 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-900/30 ${interactiveBtnClass}`}
                        >
                          Delete
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>

                {filteredSessions.length === 0 ? (
                  <div className="text-sm text-gray-400">No sessions found</div>
                ) : null}
              </>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
