// MODIFIED BY AI: 2026-02-12 - align login screen with elastic iOS glass design and smoother motion
// FILE: client/src/pages/Login.tsx

import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/deviceId";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const shortenDeviceId = (value: string) => {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const glassCardClass =
  "rounded-3xl border border-white/12 bg-[#0f1016]/82 backdrop-blur-xl shadow-[0_20px_60px_rgba(2,8,22,0.55)]";

export default function Login() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();

  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // MODIFIED BY AI: 2026-02-12 - keep password eye toggle inside new elastic card UI
  // FILE: client/src/pages/Login.tsx
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    if (!user) return;
    navigate(user.role === "admin" ? "/admin" : "/chat?mode=api", { replace: true });
  }, [user, navigate]);

  const shortDeviceId = useMemo(() => shortenDeviceId(deviceId), [deviceId]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!loginValue.trim() || !passwordValue || !deviceId) {
      setError("Fill login and password first");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const nextUser = await login({
        login: loginValue,
        password: passwordValue,
        deviceId,
      });

      navigate(nextUser.role === "admin" ? "/admin" : "/chat?mode=api", {
        replace: true,
      });
    } catch (apiError) {
      if (apiError instanceof ApiError) {
        setError(apiError.message);
      } else {
        setError("Login failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04050a] text-white safe-area-top safe-area-bottom">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[-16%] h-80 w-80 rounded-full bg-cyan-500/22 blur-3xl" />
        <div className="absolute -right-20 bottom-[-18%] h-96 w-96 rounded-full bg-blue-600/22 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-8">
        <motion.div
          className="w-full space-y-5"
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-center">
            <h1 className="text-[36px] font-bold tracking-tight">Login</h1>
          </div>

          <form onSubmit={onSubmit} className={`${glassCardClass} space-y-4 p-4`}>
            <div className="space-y-2">
              <label className="ml-1 text-sm text-gray-300" htmlFor="loginField">
                Login
              </label>
              <input
                id="loginField"
                autoComplete="username"
                value={loginValue}
                onChange={(event) => setLoginValue(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/12 bg-[#191c24]/80 px-4 text-base placeholder:text-gray-500 focus:border-white/25"
                placeholder="name"
              />
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm text-gray-300" htmlFor="passwordField">
                Password
              </label>
              <div className="relative">
                <input
                  id="passwordField"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={passwordValue}
                  onChange={(event) => setPasswordValue(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/12 bg-[#191c24]/80 px-4 pr-11 text-base placeholder:text-gray-500 focus:border-white/25"
                  placeholder="******"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {shortDeviceId ? (
              <div className="rounded-2xl border border-white/10 bg-[#151925]/70 px-3 py-2 text-sm text-gray-300">
                Device: {shortDeviceId}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-500/45 bg-red-950/45 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-ios-blue py-3 text-base font-semibold transition-all duration-200 active:scale-[0.99] disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
