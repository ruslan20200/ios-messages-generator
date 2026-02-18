import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const UPDATE_STORAGE_KEY = "ios_msg_seen_update_id";
const ONBOARDING_STORAGE_KEY = "ios_msg_seen_onboarding";
const CURRENT_UPDATE_ID = "2026-02-18-ui-performance";

type NoticeMode = "onboarding" | "update";

export function UpdateNotice() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NoticeMode>("onboarding");

  useEffect(() => {
    try {
      const onboardingSeen = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
      const seenVersion = localStorage.getItem(UPDATE_STORAGE_KEY);

      if (!onboardingSeen) {
        setMode("onboarding");
        setOpen(true);
        return;
      }

      if (seenVersion !== CURRENT_UPDATE_ID) {
        setMode("update");
        setOpen(true);
      }
    } catch {
      setMode("onboarding");
      setOpen(true);
    }
  }, []);

  const closeNotice = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
      localStorage.setItem(UPDATE_STORAGE_KEY, CURRENT_UPDATE_ID);
    } catch {
      // ignore storage errors
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? closeNotice() : setOpen(true))}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] rounded-2xl border-white/15 bg-[#12151d]/96 p-0 text-white shadow-[0_20px_48px_rgba(0,0,0,0.52)] sm:max-w-[360px]"
      >
        <div className="p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ios-blue/20 text-ios-blue">
            <Sparkles size={18} />
          </div>

          <DialogTitle className="text-left text-[21px] font-semibold tracking-tight text-white">
            {mode === "onboarding" ? "Как пользоваться приложением" : "Что нового"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-left text-sm text-gray-300">
            {mode === "onboarding"
              ? "Коротко: что здесь можно делать и как это работает."
              : "Мы улучшили скорость и удобство работы приложения."}
          </DialogDescription>

          {mode === "onboarding" ? (
            <>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-gray-200">
                📷 Нажмите + в чате, чтобы сканировать QR терминала.
                <br />
                💬 Долгое нажатие на сообщение: Скопировать / Удалить.
                <br />
                🎫 QR на странице билета содержит сам код для проверки.
              </div>

              <div className="mt-2 rounded-xl border border-white/8 bg-[#0e1118] px-3 py-2 text-[12px] text-gray-300">
                1) Введите или отсканируйте код терминала.
                <br />
                2) Отправьте код в чат.
                <br />
                3) Покажите полученный QR при проверке.
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-gray-200">
              ⚡ Быстрее открытие на слабом интернете.
              <br />
              📷 Стабильнее сканер QR на iPhone и Android.
              <br />
              ✨ Удобное меню сообщений: Скопировать / Удалить.
            </div>
          )}

          <Button
            type="button"
            className="mt-4 h-10 w-full rounded-xl bg-ios-blue text-sm font-semibold text-white hover:bg-ios-blue/90"
            onClick={closeNotice}
          >
            {mode === "onboarding" ? "Начать" : "Понятно"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
