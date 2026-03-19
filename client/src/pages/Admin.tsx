// MODIFIED BY AI: 2026-02-13 - redesign admin panel with elastic iOS styling, adaptive layout and smooth motion
// FILE: client/src/pages/Admin.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { apiRequest, apiRequestWithMeta, ApiError } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
    source?: "env" | "admin";
    phoneNumberMasked?: string;
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
type CreateUserTerm = "1w" | "1m" | "3m" | "6m" | "permanent";
type ExtendUserTerm = "1m" | "3m" | "6m" | "permanent";
type OnayAccount = {
  source: "env" | "admin";
  phoneNumberMasked: string;
  updatedAt: string | null;
  updatedByLogin: string | null;
};

type OnayAccountResponse = {
  success: boolean;
  data: {
    account: OnayAccount;
  };
};

type OnaySaveAccountResponse = {
  success: boolean;
  data?: {
    account: OnayAccount;
    tokens: NonNullable<OnaySignInResponse["data"]>;
  };
};

type CleanupSessionsResponse = {
  success: boolean;
  data: {
    deletedCount: number;
  };
};

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

// MODIFIED BY AI: 2026-02-12 - keep 1-week trial only for user creation; extension starts from 1 month
// FILE: client/src/pages/Admin.tsx
const toFutureIsoByTerm = (term: Exclude<CreateUserTerm, "permanent">) => {
  const date = new Date();
  if (term === "1w") {
    date.setDate(date.getDate() + 7);
    return date.toISOString();
  }

  const months =
    term === "1m"
      ? 1
      : term === "3m"
        ? 3
        : 6;
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
};

const glassCardClass =
  "rounded-2xl border border-white/10 bg-[#101114]/85 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]";

const interactiveBtnClass =
  "transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

// MODIFIED BY AI: 2026-02-12 - increase sessions auto-refresh interval from 15s to 10m
// FILE: client/src/pages/Admin.tsx
const SESSIONS_AUTO_REFRESH_MS = 10 * 60 * 1000;
const SWIPE_OPEN_THRESHOLD = 48;
const SWIPE_CLOSE_THRESHOLD = 32;

export default function Admin() {
  const { user, token } = useAuth();
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
  const [isLoadingOnayAccount, setIsLoadingOnayAccount] = useState(false);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  const [swipedUserId, setSwipedUserId] = useState<number | null>(null);
  const swipeStartXRef = useRef<Record<number, number>>({});
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [busyActionLabel, setBusyActionLabel] = useState("");

  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // MODIFIED BY AI: 2026-02-12 - add password visibility toggle in admin create-user form
  // FILE: client/src/pages/Admin.tsx
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newTerm, setNewTerm] = useState<CreateUserTerm>("1m");
  // MODIFIED BY AI: 2026-02-13 - add Onay tools state (sign-in + terminal test) in admin panel
  // FILE: client/src/pages/Admin.tsx
  const [onayTerminal, setOnayTerminal] = useState("");
  const [onayBusy, setOnayBusy] = useState(false);
  const [onayError, setOnayError] = useState("");
  const [onayBusyActionKey, setOnayBusyActionKey] = useState<string | null>(null);
  const [onayBusyLabel, setOnayBusyLabel] = useState("");
  const [isOnayToolsOpen, setIsOnayToolsOpen] = useState(false);
  const [onayTokens, setOnayTokens] = useState<OnaySignInResponse["data"] | null>(null);
  const [onayTrip, setOnayTrip] = useState<OnayQrStartResponse["data"] | null>(null);
  const [onayAccount, setOnayAccount] = useState<OnayAccount | null>(null);
  const [showOnayAccountDialog, setShowOnayAccountDialog] = useState(false);
  const [showOnayRefreshConfirm, setShowOnayRefreshConfirm] = useState(false);
  const [showOnayPassword, setShowOnayPassword] = useState(false);
  const [showResetOnayAccountConfirm, setShowResetOnayAccountConfirm] = useState(false);
  const [showCleanupClosedConfirm, setShowCleanupClosedConfirm] = useState(false);
  const [onayPhoneNumber, setOnayPhoneNumber] = useState("");
  const [onayPassword, setOnayPassword] = useState("");
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
      // MODIFIED BY AI: 2026-03-19 - keep non-admin users inside the shared Home flow if they reach /admin
      // FILE: client/src/pages/Admin.tsx
      navigate("/home", { replace: true });
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

  const loadOnayAccount = useCallback(async () => {
    setIsLoadingOnayAccount(true);
    try {
      const response = await apiRequest<OnayAccountResponse>("/admin/onay/account", { token });
      setOnayAccount(response.data.account);
    } finally {
      setIsLoadingOnayAccount(false);
    }
  }, [token]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      await Promise.all([loadUsers(), loadSessions(), loadOnayAccount()]);
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError("Failed to load admin data");
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadOnayAccount, loadUsers, loadSessions]);

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

  const closedSessionsCount = useMemo(
    () => sessions.filter((session) => !session.isActive).length,
    [sessions],
  );

  const runAction = async (params: {
    action: () => Promise<void>;
    busyKey: string;
    busyLabel: string;
    successMessage?: string;
    reload?: "all" | "users" | "sessions" | "none";
  }) => {
    setIsBusy(true);
    setBusyActionKey(params.busyKey);
    setBusyActionLabel(params.busyLabel);
    setError("");

    try {
      await params.action();

      if (params.reload === "users") {
        await loadUsers();
      } else if (params.reload === "sessions") {
        await loadSessions();
      } else if (params.reload !== "none") {
        await Promise.all([loadUsers(), loadSessions()]);
      }

      if (params.successMessage) {
        toast.success(params.successMessage);
      }
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError("Action failed");
      }
    } finally {
      setIsBusy(false);
      setBusyActionKey(null);
      setBusyActionLabel("");
    }
  };

  const isPendingAction = (key: string) => isBusy && busyActionKey === key;

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newLogin.trim() || !newPassword) {
      setError("Fill login and password");
      return;
    }

    const expiresAt =
      newTerm === "permanent"
        ? null
        : toFutureIsoByTerm(newTerm);

    await runAction({
      busyKey: "create-user",
      busyLabel: `Creating user ${newLogin.trim()}...`,
      successMessage: `User ${newLogin.trim()} created`,
      action: async () => {
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
        setNewTerm("1m");
        setShowCreateForm(false);
      },
    });
  };

  const resetDevice = async (targetUserId: number) => {
    const entry = users.find((item) => item.id === targetUserId);
    await runAction({
      busyKey: `user:${targetUserId}:reset`,
      busyLabel: `Resetting device for ${entry?.login || "user"}...`,
      successMessage: `Device reset for ${entry?.login || "user"}`,
      action: async () => {
        await apiRequest(`/admin/users/${targetUserId}/reset-device`, {
          method: "POST",
          token,
        });
      },
    });
  };

  const deleteUser = async (targetUserId: number) => {
    if (!window.confirm("Delete user and all related sessions?")) return;

    const entry = users.find((item) => item.id === targetUserId);
    await runAction({
      busyKey: `user:${targetUserId}:delete`,
      busyLabel: `Deleting ${entry?.login || "user"}...`,
      successMessage: `User ${entry?.login || "user"} deleted`,
      action: async () => {
        await apiRequest(`/admin/users/${targetUserId}`, {
          method: "DELETE",
          token,
        });
      },
    });
  };

  const extendUser = async (targetUserId: number, mode: ExtendUserTerm) => {
    const payload =
      mode === "permanent"
        ? { permanent: true }
        : { months: mode === "1m" ? 1 : mode === "3m" ? 3 : 6 };
    const entry = users.find((item) => item.id === targetUserId);

    await runAction({
      busyKey: `user:${targetUserId}:extend:${mode}`,
      busyLabel: `Updating ${entry?.login || "user"}...`,
      successMessage:
        mode === "permanent"
          ? `${entry?.login || "User"} is now permanent`
          : `${entry?.login || "User"} extended by ${mode === "1m" ? "1 month" : mode === "3m" ? "3 months" : "6 months"}`,
      action: async () => {
        await apiRequest(`/admin/users/${targetUserId}/extend`, {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      },
    });
  };

  // MODIFIED BY AI: 2026-02-12 - allow deleting single session log from admin sessions block
  // FILE: client/src/pages/Admin.tsx
  const deleteSession = async (sessionId: number) => {
    if (!window.confirm("Delete this session log?")) return;
    const session = sessions.find((entry) => entry.id === sessionId);

    await runAction({
      busyKey: `session:${sessionId}:delete`,
      busyLabel: `Deleting session for ${session?.login || "user"}...`,
      successMessage: "Session log deleted",
      reload: "sessions",
      action: async () => {
        await apiRequest(`/admin/sessions/${sessionId}`, {
          method: "DELETE",
          token,
        });
      },
    });
  };

  const cleanupExpired = async (mode: "deactivate" | "delete") => {
    const confirmed =
      mode === "delete"
        ? window.confirm("Delete all expired users permanently?")
        : true;

    if (!confirmed) return;

    await runAction({
      busyKey: `cleanup-expired:${mode}`,
      busyLabel: mode === "delete" ? "Deleting expired users..." : "Deactivating expired users...",
      successMessage: mode === "delete" ? "Expired users deleted" : "Expired users deactivated",
      action: async () => {
        await apiRequest("/admin/cleanup-expired", {
          method: "POST",
          token,
          body: JSON.stringify({ mode }),
        });
      },
    });
  };

  const cleanupClosedSessions = async () => {
    await runAction({
      busyKey: "sessions:cleanup-closed",
      busyLabel: "Cleaning up closed sessions...",
      reload: "sessions",
      action: async () => {
        const response = await apiRequest<CleanupSessionsResponse>("/admin/sessions/cleanup", {
          method: "POST",
          token,
          body: JSON.stringify({ scope: "closed" }),
        });
        toast.success(`Closed sessions removed: ${response.data.deletedCount}`);
      },
    });
  };

  const runOnayAction = async (
    params: {
      action: () => Promise<void>;
      endpoint?: OnayLatencyEndpoint;
      busyKey: string;
      busyLabel: string;
      successMessage?: string;
    },
  ) => {
    setOnayBusy(true);
    setOnayBusyActionKey(params.busyKey);
    setOnayBusyLabel(params.busyLabel);
    setOnayError("");

    try {
      await params.action();
      if (params.successMessage) {
        toast.success(params.successMessage);
      }
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        if (params.endpoint) {
          recordOnayLatency(apiError.headers, params.endpoint);
        }
        setOnayError(apiError.message);
      } else if (apiError instanceof Error) {
        setOnayError(apiError.message);
      } else {
        setOnayError("Onay action failed");
      }
    } finally {
      setOnayBusy(false);
      setOnayBusyActionKey(null);
      setOnayBusyLabel("");
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
    setShowOnayRefreshConfirm(false);
    await runOnayAction({
      endpoint: "sign-in",
      busyKey: "onay:refresh",
      busyLabel: "Refreshing Onay token bundle...",
      successMessage: "Onay token bundle refreshed",
      action: async () => {
        const response = await apiRequestWithMeta<OnaySignInResponse>("/api/onay/sign-in", {
          method: "POST",
          token,
        });
        recordOnayLatency(response.headers, "sign-in");

        if (!response.data.success || !response.data.data) {
          throw new Error(response.data.message || "Onay sign-in failed");
        }

        setOnayTokens(response.data.data);
        if (response.data.data.source && response.data.data.phoneNumberMasked) {
          setOnayAccount((prev) => ({
            source: response.data.data?.source || prev?.source || "env",
            phoneNumberMasked:
              response.data.data?.phoneNumberMasked || prev?.phoneNumberMasked || "-",
            updatedAt: prev?.updatedAt || null,
            updatedByLogin: prev?.updatedByLogin || null,
          }));
        } else {
          await loadOnayAccount();
        }
      },
    });
  };

  const handleOnayTerminalCheck = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedTerminal = onayTerminal.trim();
    if (!trimmedTerminal) {
      setOnayError("Enter terminal code");
      return;
    }

    await runOnayAction({
      endpoint: "qr-start",
      busyKey: "onay:terminal",
      busyLabel: `Checking terminal ${trimmedTerminal}...`,
      successMessage: `Terminal ${trimmedTerminal} checked`,
      action: async () => {
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
      },
    });
  };

  const handleSaveOnayAccount = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!onayPhoneNumber.trim() || !onayPassword) {
      setOnayError("Enter phone number and password");
      return;
    }

    await runOnayAction({
      busyKey: "onay:save-account",
      busyLabel: "Saving and verifying new Onay account...",
      successMessage: "New Onay account saved and activated",
      action: async () => {
        const response = await apiRequest<OnaySaveAccountResponse>("/admin/onay/account", {
          method: "POST",
          token,
          body: JSON.stringify({
            phoneNumber: onayPhoneNumber.trim(),
            password: onayPassword,
          }),
        });

        if (!response.success || !response.data) {
          throw new Error("Failed to save Onay account");
        }

        setOnayAccount(response.data.account);
        setOnayTokens(response.data.tokens);
        setOnayPhoneNumber("");
        setOnayPassword("");
        setShowOnayPassword(false);
        setShowOnayAccountDialog(false);
      },
    });
  };

  const handleResetOnayAccount = async () => {
    setShowResetOnayAccountConfirm(false);
    await runOnayAction({
      busyKey: "onay:reset-account",
      busyLabel: "Switching back to env Onay account...",
      successMessage: "Onay account reset to env defaults",
      action: async () => {
        const response = await apiRequest<OnayAccountResponse>("/admin/onay/account", {
          method: "DELETE",
          token,
        });

        setOnayAccount(response.data.account);
        setOnayTokens(null);
      },
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

  const handleSwipeExtend = async (targetUserId: number, mode: ExtendUserTerm) => {
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
              <p className="mt-1 text-sm text-gray-400">Smooth iOS-style control center</p>
            </div>
            <button
              onClick={() => navigate("/home")}
              className={`inline-flex items-center gap-2 self-start rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 ${interactiveBtnClass}`}
            >
              <ArrowLeft className="size-4" />
              Назад на главный экран
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
                  onChange={(event) => setNewTerm(event.target.value as CreateUserTerm)}
                  className="rounded-xl bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-[#0A84FF]/70 transition-colors"
                >
                  <option value="1w">1 week (trial)</option>
                  <option value="1m">1 month</option>
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

        <AnimatePresence initial={false}>
          {busyActionLabel ? (
            <motion.div
              key={busyActionLabel}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50"
            >
              <LoaderCircle className="size-4 animate-spin" />
              <span>{busyActionLabel}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {onayBusyLabel ? (
            <motion.div
              key={onayBusyLabel}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50"
            >
              <LoaderCircle className="size-4 animate-spin" />
              <span>{onayBusyLabel}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.02 }}
          className={`${glassCardClass} p-4 space-y-3`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Onay Tools</h2>
              <p className="mt-1 text-xs text-gray-400">Аккаунт, refresh токена и проверка терминала.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOnayToolsOpen((prev) => !prev)}
              className={`rounded-xl border border-white/15 bg-white/5 p-2.5 hover:bg-white/10 ${interactiveBtnClass}`}
              aria-label={isOnayToolsOpen ? "Collapse Onay tools" : "Expand Onay tools"}
            >
              <ChevronDown
                className={`size-5 transition-transform duration-200 ${isOnayToolsOpen ? "rotate-180" : "rotate-0"}`}
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {isOnayToolsOpen ? (
              <motion.div
                key="onay-tools-body"
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3 overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setShowOnayAccountDialog(true)}
                    disabled={onayBusy}
                    className={`rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 ${interactiveBtnClass}`}
                  >
                    Change account
                  </button>
                  <button
                    onClick={() => setShowOnayRefreshConfirm(true)}
                    disabled={onayBusy}
                    className={`rounded-lg bg-gradient-to-r from-[#0A84FF] to-[#2f9bff] px-3 py-2 text-xs font-semibold ${interactiveBtnClass}`}
                  >
                    {onayBusyActionKey === "onay:refresh" ? "Refreshing..." : "Refresh token bundle"}
                  </button>
                </div>

          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(25,32,48,0.95),rgba(11,15,23,0.92))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Current Onay account</div>
                <div className="text-xs text-gray-400">
                  {onayAccount?.source === "admin"
                    ? "Saved override from admin panel"
                    : "Using Render env defaults"}
                </div>
              </div>
              <div className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                {isLoadingOnayAccount ? "Loading" : onayAccount?.source || "env"}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Phone</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {onayAccount?.phoneNumberMasked || "-"}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Updated</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {onayAccount?.updatedAt ? formatDate(onayAccount.updatedAt) : "From env"}
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 sm:col-span-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Changed by</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {onayAccount?.updatedByLogin || "Render / env config"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowOnayAccountDialog(true)}
                disabled={onayBusy}
                className={`rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 ${interactiveBtnClass}`}
              >
                Authorize new account
              </button>
              {onayAccount?.source === "admin" ? (
                <button
                  onClick={() => setShowResetOnayAccountConfirm(true)}
                  disabled={onayBusy}
                  className={`rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/15 ${interactiveBtnClass}`}
                >
                  Use env default
                </button>
              ) : null}
            </div>
          </div>

          {onayError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {onayError}
            </div>
          ) : null}

          {/* MODIFIED BY AI: 2026-03-19 - move Sign-in result directly under the current account card and place latency beneath it */}
          {/* FILE: client/src/pages/Admin.tsx */}
          <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-3">
              <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
                <div className="text-sm font-semibold text-white">Sign-in result</div>
                <div>source: {onayTokens?.source || onayAccount?.source || "-"}</div>
                <div>phone: {onayTokens?.phoneNumberMasked || onayAccount?.phoneNumberMasked || "-"}</div>
                <div>deviceId: {onayTokens?.deviceId || "-"}</div>
                <div>token: {onayTokens?.token ? maskToken(onayTokens.token) : "-"}</div>
                <div>shortToken: {onayTokens?.shortToken ? maskToken(onayTokens.shortToken) : "-"}</div>
              </div>

              <div className="grid grid-cols-1 gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100/90">
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
                <div>
                  updated:{" "}
                  <span className="font-semibold text-cyan-50">
                    {onayLatencyUpdatedAt ? onayLatencyUpdatedAt.toLocaleTimeString() : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
              <div className="text-sm font-semibold text-white">Terminal result</div>
              <div>route: {onayTrip?.route || "-"}</div>
              <div>plate: {onayTrip?.plate || "-"}</div>
              <div>cost: {typeof onayTrip?.cost === "number" ? onayTrip.cost : "-"}</div>
              <div>terminal: {onayTrip?.terminal || "-"}</div>
              <div>pan: {onayTrip?.pan || "-"}</div>
            </div>
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
                {onayBusyActionKey === "onay:terminal" ? "Running..." : "Run"}
              </button>
            </div>
          </form>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.section>

        <Dialog open={showOnayAccountDialog} onOpenChange={setShowOnayAccountDialog}>
          <DialogContent className="border-white/10 bg-[#0d1017] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Authorize new Onay account</DialogTitle>
              <DialogDescription className="text-gray-400">Введите новый номер и пароль. Если вход пройдет успешно, этот аккаунт станет активным по умолчанию для refresh token bundle и terminal check.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveOnayAccount} className="space-y-3">
              <input
                value={onayPhoneNumber}
                onChange={(event) => setOnayPhoneNumber(event.target.value)}
                placeholder="+7707..."
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 outline-none transition-colors focus:border-[#0A84FF]/70"
              />
              <div className="relative">
                <input
                  type={showOnayPassword ? "text" : "password"}
                  value={onayPassword}
                  onChange={(event) => setOnayPassword(event.target.value)}
                  placeholder="Onay password"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 pr-11 outline-none transition-colors focus:border-[#0A84FF]/70"
                />
                <button
                  type="button"
                  onClick={() => setShowOnayPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
                  aria-label={showOnayPassword ? "Hide password" : "Show password"}
                >
                  {showOnayPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setShowOnayAccountDialog(false)}
                  className={`rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 ${interactiveBtnClass}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onayBusy}
                  className={`rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#2f9bff] px-3 py-2 text-sm font-semibold ${interactiveBtnClass}`}
                >
                  {onayBusyActionKey === "onay:save-account" ? "Saving..." : "Save and authorize"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showOnayRefreshConfirm} onOpenChange={setShowOnayRefreshConfirm}>
          <DialogContent className="border-white/10 bg-[#0d1017] text-white sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Refresh token bundle?</DialogTitle>
              <DialogDescription className="text-gray-400">Будет выполнен лишний запрос в Onay. Продолжить refresh для текущего аккаунта{onayAccount?.phoneNumberMasked ? ` ${onayAccount.phoneNumberMasked}` : ""}?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowOnayRefreshConfirm(false)}
                className={`rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 ${interactiveBtnClass}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleOnaySignIn()}
                disabled={onayBusy}
                className={`rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#2f9bff] px-3 py-2 text-sm font-semibold ${interactiveBtnClass}`}
              >
                Continue
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResetOnayAccountConfirm} onOpenChange={setShowResetOnayAccountConfirm}>
          <DialogContent className="border-white/10 bg-[#0d1017] text-white sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Use env default account?</DialogTitle>
              <DialogDescription className="text-gray-400">Сохраненный аккаунт из админки будет отключен, и система снова начнет использовать Render env по умолчанию.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowResetOnayAccountConfirm(false)}
                className={`rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 ${interactiveBtnClass}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleResetOnayAccount()}
                disabled={onayBusy}
                className={`rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/15 ${interactiveBtnClass}`}
              >
                Switch to env
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                {filteredUsers.length} / {users.length}
              </div>
              <button
                onClick={() => void refreshUsers()}
                disabled={isLoadingUsers}
                className={`rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
              >
                {isLoadingUsers ? "Refreshing..." : "Refresh"}
              </button>
            </div>
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

          {/* MODIFIED BY AI: 2026-03-19 - use native overflow scrolling for the users list so it stays inside its section on mobile */}
          {/* FILE: client/src/pages/Admin.tsx */}
          <div className="max-h-[520px] overflow-y-auto pr-1 sm:max-h-[620px]">
            <div className="grid gap-3 pr-2 pb-1">
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
                      className="relative overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(9,12,18,0.94),rgba(6,9,14,0.98))]"
                    >
                      <div className="sm:hidden absolute inset-y-0 right-0 w-52 grid grid-cols-3 gap-2 border-l border-white/10 bg-[linear-gradient(90deg,rgba(6,8,13,0.98),rgba(10,14,21,0.94))] p-2">
                        <button
                          onClick={() => void handleSwipeResetDevice(entry.id)}
                          disabled={isBusy}
                          className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-[11px] ${interactiveBtnClass}`}
                        >
                          {isPendingAction(`user:${entry.id}:reset`) ? "..." : "Reset"}
                        </button>
                        <button
                          onClick={() => void handleSwipeExtend(entry.id, "1m")}
                          disabled={isBusy}
                          className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-[11px] ${interactiveBtnClass}`}
                        >
                          {isPendingAction(`user:${entry.id}:extend:1m`) ? "..." : "+1M"}
                        </button>
                        <button
                          onClick={() => void handleSwipeExtend(entry.id, "3m")}
                          disabled={isBusy}
                          className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-[11px] ${interactiveBtnClass}`}
                        >
                          {isPendingAction(`user:${entry.id}:extend:3m`) ? "..." : "+3M"}
                        </button>
                        <button
                          onClick={() => void handleSwipeExtend(entry.id, "6m")}
                          disabled={isBusy}
                          className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2 text-[11px] ${interactiveBtnClass}`}
                        >
                          {isPendingAction(`user:${entry.id}:extend:6m`) ? "..." : "+6M"}
                        </button>
                        <button
                          onClick={() => void handleSwipeDeleteUser(entry.id)}
                          disabled={isBusy}
                          className={`rounded-lg border border-red-500/50 bg-red-950/20 px-2 py-2 text-[11px] text-red-200 ${interactiveBtnClass}`}
                        >
                          {isPendingAction(`user:${entry.id}:delete`) ? "..." : "Delete"}
                        </button>
                      </div>

                      {/* MODIFIED BY AI: 2026-03-19 - bring back a subtle translucent front layer so swipe actions softly show through behind the card */}
                      {/* FILE: client/src/pages/Admin.tsx */}
                      <motion.div
                        animate={{ x: swipedUserId === entry.id ? -208 : 0 }}
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
                        className="relative z-10 space-y-3 bg-[linear-gradient(135deg,rgba(16,20,27,0.78),rgba(11,15,22,0.72))] p-3 backdrop-blur-[10px]"
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

                        <div className="hidden sm:grid grid-cols-5 gap-2">
                          <button
                            onClick={() => resetDevice(entry.id)}
                            disabled={isBusy}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            {isPendingAction(`user:${entry.id}:reset`) ? "Resetting..." : "Reset Device"}
                          </button>
                          <button
                            onClick={() => extendUser(entry.id, "1m")}
                            disabled={isBusy}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            {isPendingAction(`user:${entry.id}:extend:1m`) ? "Saving..." : "+1 Month"}
                          </button>
                          <button
                            onClick={() => extendUser(entry.id, "3m")}
                            disabled={isBusy}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            {isPendingAction(`user:${entry.id}:extend:3m`) ? "Saving..." : "+3 Months"}
                          </button>
                          <button
                            onClick={() => extendUser(entry.id, "6m")}
                            disabled={isBusy}
                            className={`rounded-lg border border-white/20 bg-white/5 px-2 py-2.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
                          >
                            {isPendingAction(`user:${entry.id}:extend:6m`) ? "Saving..." : "+6 Months"}
                          </button>
                          <button
                            onClick={() => deleteUser(entry.id)}
                            disabled={isBusy}
                            className={`rounded-lg border border-red-500/50 bg-red-950/20 px-2 py-2.5 text-xs text-red-200 hover:bg-red-900/30 ${interactiveBtnClass}`}
                          >
                            {isPendingAction(`user:${entry.id}:delete`) ? "Deleting..." : "Delete"}
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
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                closed: {closedSessionsCount}
              </div>
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
              <button
                onClick={() => setShowCleanupClosedConfirm(true)}
                disabled={isBusy || closedSessionsCount === 0}
                className={`rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 ${interactiveBtnClass}`}
              >
                {isPendingAction("sessions:cleanup-closed") ? "Cleaning..." : "Clear closed"}
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
                          {isPendingAction(`session:${session.id}:delete`) ? "Deleting..." : "Delete"}
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

        <Dialog open={showCleanupClosedConfirm} onOpenChange={setShowCleanupClosedConfirm}>
          <DialogContent className="border-white/10 bg-[#0d1017] text-white sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Clear closed sessions?</DialogTitle>
              <DialogDescription className="text-gray-400">Будут удалены все закрытые session logs. Активные сессии останутся на месте.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowCleanupClosedConfirm(false)}
                className={`rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 ${interactiveBtnClass}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCleanupClosedConfirm(false);
                  void cleanupClosedSessions();
                }}
                disabled={isBusy}
                className={`rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#2f9bff] px-3 py-2 text-sm font-semibold ${interactiveBtnClass}`}
              >
                Continue
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

