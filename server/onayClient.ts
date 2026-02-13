// MODIFIED BY AI: 2026-02-12 - optimize Onay client with keep-alive, PAN cache and in-flight request dedupe
// FILE: server/onayClient.ts

import axios, { AxiosInstance } from "axios";
import https from "https";

type TokenBundle = {
  token: string;
  shortToken: string;
  deviceId: string;
};

type PanCacheEntry = {
  value: string;
  expiresAt: number;
};

export type OnayConfig = {
  baseUrl: string;
  appToken: string;
  deviceId: string;
  os: string;
  version: string;
  userAgent: string;
  phoneNumber: string;
  password: string;
  pushToken: string;
  cityId: string;
  verbose: boolean;
  requestTimeoutMs: number;
  panCacheTtlMs: number;
};

export type OnayTrip = {
  route?: string;
  plate?: string;
  cost?: number;
  terminalCode?: string;
  pan?: string;
  refreshed?: boolean;
  rawTerminal?: unknown;
};

const defaultBaseUrl = "https://nwqsr0rz5earuiy2t8z8.tha.kz";
const defaultRequestTimeoutMs = 12000;
const defaultPanCacheTtlMs = 30 * 60 * 1000;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isAuthError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
};

const mask = (value: string) =>
  value.length <= 6 ? "***" : `${value.slice(0, 3)}***${value.slice(-2)}`;

// Clean conductor/plate field coming from API (e.g., "(2550)524EY02" -> "524EY02").
const normalizePlate = (plate: unknown): string | undefined => {
  if (typeof plate !== "string") return undefined;
  return plate.replace(/^\s*\([^)]*\)\s*/, "").trim();
};

export function loadOnayConfig(): OnayConfig {
  const required = (key: string) => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required env ${key} for Onay API`);
    }
    return value;
  };

  return {
    baseUrl: process.env.ONAY_BASE_URL || defaultBaseUrl,
    appToken: required("ONAY_APP_TOKEN"),
    deviceId: required("ONAY_DEVICE_ID"),
    os: process.env.ONAY_OS || "2",
    version: process.env.ONAY_VERSION || "3.2.1",
    userAgent:
      process.env.ONAY_USER_AGENT ||
      "Onay/3.2.1 (kz.onay.Onay; build:6; iOS 26.2.0) Alamofire/5.4.4",
    phoneNumber: required("ONAY_PHONE_NUMBER"),
    password: required("ONAY_PASSWORD"),
    pushToken: required("ONAY_PUSH_TOKEN"),
    cityId: process.env.ONAY_CITY_ID || "1",
    verbose: process.env.ONAY_VERBOSE_LOGS === "true",
    requestTimeoutMs: parsePositiveInt(
      process.env.ONAY_TIMEOUT_MS,
      defaultRequestTimeoutMs,
    ),
    panCacheTtlMs: parsePositiveInt(
      process.env.ONAY_PAN_CACHE_TTL_MS,
      defaultPanCacheTtlMs,
    ),
  };
}

export class OnayClient {
  private http: AxiosInstance;
  private tokens?: TokenBundle;
  private signInPromise?: Promise<TokenBundle>;
  private panPromise?: Promise<string>;
  private panCache?: PanCacheEntry;
  private qrStartInFlight = new Map<string, Promise<OnayTrip>>();

  constructor(private config: OnayConfig) {
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 32,
      keepAliveMsecs: 30_000,
    });

    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.requestTimeoutMs,
      httpsAgent,
      headers: {
        "x-ma-os": config.os,
        "x-ma-version": config.version,
        "user-agent": config.userAgent,
      },
    });
  }

  private log(message: string, extra?: unknown) {
    if (!this.config.verbose) return;
    if (extra !== undefined) {
      console.log(`[onay] ${message}`, extra);
    } else {
      console.log(`[onay] ${message}`);
    }
  }

  async signIn(force = false) {
    if (this.tokens && !force) return this.tokens;
    if (this.signInPromise) return this.signInPromise;

    const signInTask = (async () => {
      const appTokenHeader = this.config.appToken.startsWith("Bearer ")
        ? this.config.appToken
        : `Bearer ${this.config.appToken}`;

      const headers = {
        "content-type": "application/json",
        "x-application-token": appTokenHeader,
        "x-ma-d": this.config.deviceId,
        "x-ma-os": this.config.os,
        "x-ma-version": this.config.version,
        "user-agent": this.config.userAgent,
      };

      const payload = {
        phoneNumber: this.config.phoneNumber,
        password: this.config.password,
        deviceOs: Number(this.config.os) || 2,
        pushToken: this.config.pushToken,
      };

      this.log("sign-in request", {
        phone: mask(this.config.phoneNumber),
        device: mask(this.config.deviceId),
      });

      const { data } = await this.http.put(
        "/v1/external/user/sign-in",
        payload,
        { headers },
      );

      const tokenData = data?.result?.data;

      if (!tokenData?.token || !tokenData?.shortToken) {
        throw new Error("Onay sign-in: token is missing in response");
      }

      this.tokens = {
        token: tokenData.token,
        shortToken: tokenData.shortToken,
        deviceId: tokenData.d || this.config.deviceId,
      };

      this.log("sign-in success", { device: mask(this.tokens.deviceId) });
      return this.tokens;
    })();

    this.signInPromise = signInTask;
    try {
      return await signInTask;
    } finally {
      if (this.signInPromise === signInTask) {
        this.signInPromise = undefined;
      }
    }
  }

  private requireToken() {
    if (!this.tokens?.shortToken) {
      throw new Error("Onay auth token is not ready");
    }

    return {
      "content-type": "application/json",
      "x-short-token": this.tokens.shortToken,
      "x-ma-d": this.config.deviceId,
      "x-ma-version": this.config.version,
      "user-agent": this.config.userAgent,
    };
  }

  private readCachedPan() {
    if (!this.panCache) return null;
    if (this.panCache.expiresAt <= Date.now()) {
      this.panCache = undefined;
      return null;
    }
    return this.panCache.value;
  }

  private setCachedPan(value: string) {
    this.panCache = {
      value,
      expiresAt: Date.now() + this.config.panCacheTtlMs,
    };
  }

  private async fetchFirstPanFromApi(): Promise<string> {
    const headers = this.requireToken();
    const url = `/v2/external/customer/cards?cityId=${this.config.cityId}`;
    const { data } = await this.http.get(url, { headers });

    if (!data?.success) {
      throw new Error("Onay cards call failed");
    }

    const cards = data?.result?.data;
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      throw new Error("Onay: no cards found for account");
    }

    const pan = cards[0]?.pan;
    if (!pan) {
      throw new Error("Onay: first card has no PAN");
    }

    const normalizedPan = String(pan);
    this.setCachedPan(normalizedPan);
    this.log("pan retrieved", { pan: mask(normalizedPan) });
    return normalizedPan;
  }

  private async getFirstPan(forceRefresh = false): Promise<string> {
    if (!forceRefresh) {
      const cachedPan = this.readCachedPan();
      if (cachedPan) return cachedPan;
      if (this.panPromise) return this.panPromise;
    }

    const panTask = (async () => {
      await this.signIn(forceRefresh);
      try {
        return await this.fetchFirstPanFromApi();
      } catch (error) {
        if (isAuthError(error)) {
          this.log("cards auth failed, retrying sign-in");
          await this.signIn(true);
          return this.fetchFirstPanFromApi();
        }
        throw error;
      }
    })();

    this.panPromise = panTask;
    try {
      return await panTask;
    } finally {
      if (this.panPromise === panTask) {
        this.panPromise = undefined;
      }
    }
  }

  private normalizeTrip(data: any, pan?: string): OnayTrip {
    const terminal = data?.result?.data?.terminal || {};
    const cleanedPlate = normalizePlate(terminal.conductor);
    return {
      route: terminal.route,
      plate: cleanedPlate,
      cost: typeof terminal.cost === "number" ? terminal.cost : undefined,
      terminalCode: terminal.code || terminal.terminal,
      pan,
      rawTerminal: this.config.verbose ? terminal : undefined,
    };
  }

  async qrStart(terminal: string): Promise<OnayTrip> {
    const normalizedTerminal = terminal.trim();
    if (!normalizedTerminal) {
      throw new Error("Terminal code is required");
    }

    const inFlight = this.qrStartInFlight.get(normalizedTerminal);
    if (inFlight) {
      this.log("qr-start dedupe hit", { terminal: normalizedTerminal });
      return inFlight;
    }

    const task = (async () => {
      let pan = await this.getFirstPan();

      const attempt = async (forced: boolean) => {
        if (forced) {
          await this.signIn(true);
          pan = await this.getFirstPan(true);
        }

        const headers = this.requireToken();
        const payload = { terminal: normalizedTerminal, pan };
        this.log("qr-start request", { terminal: normalizedTerminal });
        const { data } = await this.http.put(
          "/v1/external/customer/card/acquiring/qr/start",
          payload,
          { headers },
        );
        this.log("qr-start success");
        return this.normalizeTrip(data, pan);
      };

      try {
        return await attempt(false);
      } catch (error) {
        if (isAuthError(error)) {
          this.log("auth failed, retrying sign-in");
          return attempt(true);
        }

        if (axios.isAxiosError(error)) {
          const details = {
            status: error.response?.status,
            data: error.response?.data,
          };
          this.log("qr-start failed", details);
        }

        throw error;
      }
    })();

    this.qrStartInFlight.set(normalizedTerminal, task);
    try {
      return await task;
    } finally {
      if (this.qrStartInFlight.get(normalizedTerminal) === task) {
        this.qrStartInFlight.delete(normalizedTerminal);
      }
    }
  }

  // MODIFIED BY AI: 2026-02-12 - optional preloading to cut first-request latency after startup
  // FILE: server/onayClient.ts
  async warmup() {
    await this.signIn();
    await this.getFirstPan();
  }
}
