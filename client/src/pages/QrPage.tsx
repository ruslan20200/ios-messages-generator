import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type QrPageProps = {
  params: {
    code?: string;
  };
};

export default function QrPage({ params }: QrPageProps) {
  const [_, navigate] = useLocation();
  const [qrSize, setQrSize] = useState(230);
  const rawCode = (params?.code || "").trim();
  const displayCode = rawCode ? rawCode.toUpperCase() : "0000X";
  const qrValue = rawCode ? `https://qr.tha.kz/${rawCode}` : "https://qr.tha.kz";
  const year = new Date().getFullYear();

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth || 360;
      const next = Math.max(180, Math.min(260, Math.floor(width * 0.6)));
      setQrSize(next);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#1c1c1e] flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-[460px] mx-auto flex flex-col min-h-[90vh]">
        <div className="relative flex items-center justify-between mb-5 ">
          <img src="/logo.png" alt="SMS Verifier" className="w-50 h-auto" />
          <button
            type="button"
            aria-label="Help"
            className="w-6 h-6 rounded-full bg-[#d9d9d9] text-[#ffffff] flex items-center justify-center text-lg font-semibold shadow-sm"
          >
            ?
          </button>
        </div>

        <div className="p-2 space-y-2 flex-1">
          <p className="w-full max-w-[320px] mx-auto text-center text-[14px] text-[#2f2f31] font-medium bg-[#f1f1f1] border border-dashed border-[#909090] px-3 py-1">
            SMS билетінізді тексерген кезде контроллерге QR кодын көрсетіңіз.
          </p>

          <div className="bg-white border border-[#e0e0e0] flex items-center justify-center p-8 w-fit mx-auto">
            <QRCodeSVG value={qrValue} size={qrSize} bgColor="#ffffff" fgColor="#000000" />
          </div>

          <p className="w-full max-w-[320px] mx-auto text-[14px] text-[#2f2f31] bg-[#f1f1f1] border border-dashed border-[#909090] px-3 py-1">
            При проверке SMS билета пожалуйста, покажите QR код контролеру.
          </p>

          <div className="text-[1rem] font-semibold text-[#1c1c1e] text-center">
            {displayCode}
          </div>

          {!rawCode && (
            <div className="inline-block text-[#454545] text-[13px] font-semibold border border-dotted border-[#909090] bg-[#f1f1f1] px-3 py-1">
              Мұндай тексеру коды жоқ.<br />
              <br />
              Нет такого проверочного кода.
            </div>
          )}
        </div>
        <hr className="my-4 border-t border-[#d1d1d1]" />
      </div>
        <div className="text-sm text-[#8a8a8f] text-center mt-4">© {year} ONAY!</div>
    </div>
  );
}
