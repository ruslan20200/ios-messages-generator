import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, RefreshCw, ScanLine, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { extractOnayTerminalId } from "@/lib/qr";

type QrScannerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (terminalId: string) => void;
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

const getBarcodeDetectorConstructor = (): BarcodeDetectorConstructor | null => {
  const maybeConstructor = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
  if (typeof maybeConstructor !== "function") {
    return null;
  }

  return maybeConstructor as BarcodeDetectorConstructor;
};

export function QrScannerSheet({ open, onOpenChange, onDetected }: QrScannerSheetProps) {
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
      const parsed = extractOnayTerminalId(rawValue);

      if (!parsed.ok) {
        setErrorMessage(parsed.error);
        setStatusMessage("QR найден, но формат не подходит");
        return;
      }

      stopScanner();
      onDetected(parsed.terminalId);
      onOpenChange(false);
    },
    [onDetected, onOpenChange, stopScanner],
  );

  const decodeWithJsQr = useCallback((): string | null => {
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
        rawValue = decodeWithJsQr();
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-white/10 bg-[#101217] p-0 text-white shadow-[0_-14px_40px_rgba(0,0,0,0.45)]"
      >
        <SheetHeader className="space-y-1 px-4 pb-2 pt-4 text-left">
          <SheetTitle className="text-base font-semibold text-white">Сканер QR терминала</SheetTitle>
          <SheetDescription className="text-xs text-gray-400">
            Поддерживается формат: http://c.onay.kz/&lt;TERMINAL_ID&gt;
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
