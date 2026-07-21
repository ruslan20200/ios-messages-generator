import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronRight, QrCode, RefreshCw, ScanLine, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { extractOnayTerminalId } from "@/lib/qr";

type QrParseResult = { ok: true; value: string } | { ok: false; error: string };

type QrScannerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
  /** Decode a raw QR string into a code. Defaults to the Onay terminal parser. */
  parse?: (raw: string) => QrParseResult;
  title?: string;
  description?: string;
  /** "kaspi" = full-screen Kaspi-QR styling; "default" = dark bottom sheet. */
  variant?: "default" | "kaspi";
};

const defaultParse = (raw: string): QrParseResult => {
  const parsed = extractOnayTerminalId(raw);
  return parsed.ok
    ? { ok: true, value: parsed.terminalId }
    : { ok: false, error: parsed.error };
};

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

const SCAN_TIMEOUT_MS = 15000;
let jsQrModulePromise: Promise<typeof import("jsqr")> | null = null;

const loadJsQr = async () => {
  if (!jsQrModulePromise) {
    jsQrModulePromise = import("jsqr");
  }

  return jsQrModulePromise;
};

const getBarcodeDetectorConstructor = (): BarcodeDetectorConstructor | null => {
  const maybeConstructor = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
  if (typeof maybeConstructor !== "function") {
    return null;
  }

  return maybeConstructor as BarcodeDetectorConstructor;
};

export function QrScannerSheet({
  open,
  onOpenChange,
  onDetected,
  parse = defaultParse,
  title = "Сканер QR терминала",
  description = "Поддерживается формат: http://c.onay.kz/<TERMINAL_ID>",
  variant = "default",
}: QrScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const scanningActiveRef = useRef(false);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const startScannerRef = useRef<(() => Promise<void>) | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Наведите камеру на QR с терминалом");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detectorSupported = useMemo(() => {
    return typeof window !== "undefined" && "BarcodeDetector" in window;
  }, []);

  const stopScanner = useCallback(() => {
    scanningActiveRef.current = false;

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    if (mountedRef.current) {
      setIsScanning(false);
      setIsStarting(false);
    }
  }, []);

  const handleDetection = useCallback(
    (rawValue: string) => {
      const parsed = parse(rawValue);

      if (!parsed.ok) {
        setErrorMessage(parsed.error);
        setStatusMessage("QR найден, но формат не подходит");
        return;
      }

      stopScanner();
      onDetected(parsed.value);
      onOpenChange(false);
    },
    [onDetected, onOpenChange, parse, stopScanner],
  );

  const decodeWithJsQr = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null;
    }

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await loadJsQr();
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });

    return result?.data ?? null;
  }, []);

  const scanLoop = useCallback(async () => {
    if (!mountedRef.current || !open || !scanningActiveRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      rafRef.current = window.requestAnimationFrame(() => {
        void scanLoop();
      });
      return;
    }

    try {
      let rawValue: string | null = null;

      if (detectorRef.current) {
        const barcodes = await detectorRef.current.detect(video);
        rawValue = barcodes.find((item) => item.rawValue?.trim())?.rawValue?.trim() ?? null;
      }

      if (!rawValue) {
        rawValue = await decodeWithJsQr();
      }

      if (rawValue) {
        handleDetection(rawValue);
        return;
      }
    } catch {
      // keep scanning if a frame fails to decode
    }

    rafRef.current = window.requestAnimationFrame(() => {
      void scanLoop();
    });
  }, [decodeWithJsQr, handleDetection, open]);

  const startScanner = useCallback(async () => {
    stopScanner();
    setErrorMessage(null);
    setStatusMessage("Подключаем камеру...");
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Камера не поддерживается в этом браузере");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Не удалось инициализировать видео-поток");
      }

      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      if (detectorSupported) {
        try {
          const Detector = getBarcodeDetectorConstructor();
          detectorRef.current = Detector ? new Detector({ formats: ["qr_code"] }) : null;
        } catch {
          detectorRef.current = null;
        }
      } else {
        detectorRef.current = null;
      }

      if (!mountedRef.current) return;

      setIsStarting(false);
      setIsScanning(true);
      scanningActiveRef.current = true;
      setStatusMessage("Сканирование запущено. Наведите QR в рамку.");

      timeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setErrorMessage("QR не распознан. Попробуйте приблизить камеру и повторить.");
      }, SCAN_TIMEOUT_MS);

      rafRef.current = window.requestAnimationFrame(() => {
        void scanLoop();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось запустить камеру";
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      const aborted =
        error instanceof DOMException
          ? error.name === "AbortError"
          : /interrupted by a call to pause|operation was aborted/i.test(message);

      if (aborted) {
        stopScanner();
        setStatusMessage("Наведите камеру на QR с терминалом");
        return;
      }

      setErrorMessage(denied ? "Нет доступа к камере. Разрешите доступ и повторите." : message);
      setStatusMessage("Сканирование недоступно");
      stopScanner();
    }
  }, [detectorSupported, scanLoop, stopScanner]);

  useEffect(() => {
    if (open) {
      void loadJsQr().catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    startScannerRef.current = startScanner;
  }, [startScanner]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setErrorMessage(null);
      setStatusMessage("Наведите камеру на QR с терминалом");
      return;
    }

    void startScannerRef.current?.();
  }, [open, stopScanner]);

  if (variant === "kaspi") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[100dvh] max-h-[100dvh] flex-col gap-0 rounded-none border-0 bg-[#d6d6da] p-0 text-black [&>button]:hidden"
        >
          <SheetHeader className="relative flex-row items-center justify-center gap-2 bg-white px-4 py-3.5">
            <QrCode size={22} className="text-[#f14635]" />
            <SheetTitle className="text-lg font-bold text-black">{title}</SheetTitle>
            <SheetDescription className="sr-only">{description}</SheetDescription>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Закрыть"
              className="absolute top-1/2 right-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-gray-200 text-gray-400 active:bg-gray-300"
            >
              <X size={22} strokeWidth={2.2} />
            </button>
          </SheetHeader>

          <div className="relative flex flex-1 flex-col overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              autoPlay
              playsInline
              aria-label="Камера для сканирования QR"
            />
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#d6d6da]">
                <RefreshCw size={26} className="animate-spin text-gray-400" />
              </div>
            )}

            {/* dark translucent mask with a clear scan window in the centre */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="relative h-[248px] w-[248px] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <span className="absolute -top-1.5 -left-1.5 h-9 w-9 rounded-tl-xl border-t-[5px] border-l-[5px] border-[#f14635]" />
                <span className="absolute -top-1.5 -right-1.5 h-9 w-9 rounded-tr-xl border-t-[5px] border-r-[5px] border-[#f14635]" />
                <span className="absolute -bottom-1.5 -left-1.5 h-9 w-9 rounded-bl-xl border-b-[5px] border-l-[5px] border-[#f14635]" />
                <span className="absolute -right-1.5 -bottom-1.5 h-9 w-9 rounded-br-xl border-r-[5px] border-b-[5px] border-[#f14635]" />
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-6 pt-6">
              <p className="min-h-[20px] px-4 text-center text-[15px] font-semibold text-white drop-shadow">
                {statusMessage}
              </p>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 pb-5">
              {errorMessage ? (
                <div className="pointer-events-auto flex items-start gap-2 rounded-xl bg-white/95 px-3 py-2 text-[13px] text-[#b3261e]">
                  <XCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : (
                <p className="px-4 text-center text-[13px] text-white/90 drop-shadow">
                  Наведите камеру на QR-код в рамку
                </p>
              )}
              {!detectorSupported && (
                <p className="mt-2 text-[11px] text-white/80 drop-shadow">
                  Используется резервное распознавание.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-t-2xl bg-white px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
            <h3 className="mb-1 text-xl font-bold text-black">Apply online</h3>

            <div className="flex items-center gap-3 py-1.5">
              <span className="grid h-8 w-14 shrink-0 place-items-center rounded-full bg-[#f14635] text-[12px] font-bold text-white">
                0·0·3
              </span>
              <span className="flex-1 text-[15px] text-black">Buy-now-pay-later</span>
              <ChevronRight size={18} className="text-gray-300" />
            </div>

            <div className="flex items-center gap-3 border-t border-gray-100 py-1.5">
              <span className="grid h-8 w-14 shrink-0 place-items-center rounded-lg bg-[#f14635] text-[10px] font-bold text-white">
                KREDIT
              </span>
              <span className="flex-1">
                <span className="block text-[15px] text-black">Purchase Credit</span>
                <span className="block text-xs text-gray-400">
                  Buy on credit or buy-now-pay-later 0%
                </span>
              </span>
              <ChevronRight size={18} className="text-gray-300" />
            </div>

            <div className="flex items-center gap-3 border-t border-gray-100 py-1.5">
              <span className="grid h-8 w-14 shrink-0 place-items-center rounded-lg bg-[#f14635] text-[10px] font-bold text-white">
                RED
              </span>
              <span className="flex-1 text-[15px] text-black">Kaspi Red</span>
              <ChevronRight size={18} className="text-gray-300" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/10 bg-[#101217] p-0 text-white shadow-[0_-14px_40px_rgba(0,0,0,0.45)]"
      >
        <SheetHeader className="space-y-1 px-4 pb-2 pt-4 text-left">
          <SheetTitle className="text-base font-semibold text-white">{title}</SheetTitle>
          <SheetDescription className="text-xs text-gray-400">
            {description}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#07080b]">
            <video
              ref={videoRef}
              className="h-[42vh] min-h-[260px] w-full object-cover"
              muted
              autoPlay
              playsInline
              aria-label="Камера для сканирования QR"
            />

            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
              <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>

            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                <div className="flex items-center gap-2 rounded-full bg-[#151922]/90 px-3 py-2 text-xs text-gray-100">
                  <RefreshCw size={14} className="animate-spin" />
                  Запускаем камеру...
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-[#171a22] px-3 py-2 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <ScanLine size={14} className="text-gray-400" />
              <span>{statusMessage}</span>
            </div>
            {errorMessage && (
              <div className="mt-2 flex items-start gap-2 text-[#ff8f8f]">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {!detectorSupported && (
              <div className="mt-2 text-[11px] text-gray-500">
                BarcodeDetector недоступен, используется резервное распознавание.
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl bg-white/5 text-white hover:bg-white/10"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Закрыть
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-ios-blue px-4 text-white hover:bg-ios-blue/90"
              onClick={() => {
                void startScanner();
              }}
            >
              <Camera size={14} />
              Повторить
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
