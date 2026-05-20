// MODIFIED BY AI: 2026-03-27 — replace onboarding instructions with a mandatory lawful-use agreement gate
// FILE: client/src/components/UpdateNotice.tsx

import { ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const UPDATE_STORAGE_KEY = "ios_msg_seen_update_id";
const AGREEMENT_STORAGE_KEY = "ios_msg_seen_agreement_id";
const LEGAL_AGREEMENT_VERSION = "2026-03-27-lawful-use-kz";
const CURRENT_UPDATE_ID = "2026-03-27-home-and-2505";

type NoticeMode = "agreement" | "update";

const agreementClauses = [
  "Вы подтверждаете, что используете приложение исключительно в законных целях и самостоятельно оцениваете правомерность каждого своего действия.",
  "Вы обязуетесь соблюдать законодательство Республики Казахстан, а также иные применимые правила, требования перевозчиков, платежных систем, договоров и публичных оферт.",
  "Приложение не предоставляет разрешение на обход ограничений, проверок, правил оплаты, правил идентификации либо иных установленных законом или договором процедур.",
  "Все вводимые вами данные, сообщения, маршруты, QR-коды, коды транспорта и иные результаты использования формируются по вашей инициативе, на ваш риск и под вашу личную ответственность.",
  "В случае нарушений закона, договорных условий, правил перевозчика, требований государственных органов или прав третьих лиц ответственность за последствия, претензии, проверки, штрафы, убытки и иные меры несет пользователь.",
  "Настоящее согласие является уведомлением о законном использовании и не является юридической консультацией. Для точной правовой оценки по законодательству Республики Казахстан необходимо получить консультацию профильного юриста.",
];

const updateHighlights = [
  "Главный экран стал чище и быстрее открывается на слабом интернете.",
  "Добавлен локальный чат 2505 с сохранением маршрутов прямо на устройстве.",
  "Улучшена стабильность чата и клавиатуры на iPhone.",
];

export function UpdateNotice() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NoticeMode>("agreement");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    try {
      const acceptedAgreement = localStorage.getItem(AGREEMENT_STORAGE_KEY);
      const seenVersion = localStorage.getItem(UPDATE_STORAGE_KEY);

      if (acceptedAgreement !== LEGAL_AGREEMENT_VERSION) {
        setMode("agreement");
        setAgreed(false);
        setOpen(true);
        return;
      }

      if (seenVersion !== CURRENT_UPDATE_ID) {
        setMode("update");
        setOpen(true);
      }
    } catch {
      setMode("agreement");
      setAgreed(false);
      setOpen(true);
    }
  }, []);

  const canCloseWithoutAction = mode === "update";

  const agreementSummary = useMemo(
    () =>
      "Перед продолжением вы должны подтвердить, что понимаете условия законного использования и принимаете личную ответственность за свои действия.",
    []
  );

  const acceptAgreement = () => {
    try {
      localStorage.setItem(AGREEMENT_STORAGE_KEY, LEGAL_AGREEMENT_VERSION);
      localStorage.setItem(UPDATE_STORAGE_KEY, CURRENT_UPDATE_ID);
    } catch {
      // ignore storage errors
    }

    setOpen(false);
  };

  const closeUpdate = () => {
    try {
      localStorage.setItem(UPDATE_STORAGE_KEY, CURRENT_UPDATE_ID);
    } catch {
      // ignore storage errors
    }

    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    if (canCloseWithoutAction) {
      closeUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] rounded-2xl border-white/15 bg-[#12151d]/96 p-0 text-white shadow-[0_20px_48px_rgba(0,0,0,0.52)] sm:max-w-[420px]"
      >
        {/* Flex column so the button is always in view — content scrolls, button stays pinned */}
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div
              className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full ${
                mode === "agreement" ? "bg-amber-500/18 text-amber-300" : "bg-ios-blue/20 text-ios-blue"
              }`}
            >
              {mode === "agreement" ? <ShieldAlert size={19} /> : <Sparkles size={18} />}
            </div>

            <DialogTitle className="text-left text-[20px] font-semibold tracking-tight text-white">
              {mode === "agreement" ? "Соглашение об использовании" : "Что нового"}
            </DialogTitle>

            <DialogDescription className="mt-1 text-left text-[13px] leading-5 text-gray-300">
              {mode === "agreement"
                ? agreementSummary
                : "Мы обновили домашний экран, улучшили локальный чат 2505 и сделали работу на iPhone стабильнее."}
            </DialogDescription>

            {mode === "agreement" ? (
              <>
                <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/8 px-3 py-2 text-[12px] leading-5 text-amber-100">
                  Без подтверждения доступ к приложению закрыт.
                </div>

                <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] leading-5 text-gray-200">
                  {agreementClauses.map((clause, index) => (
                    <div key={clause} className="flex gap-2.5">
                      <div className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-semibold text-gray-200">
                        {index + 1}
                      </div>
                      <p className="leading-5">{clause}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-[#0e1118] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="lawful-use-consent"
                      checked={agreed}
                      onCheckedChange={(checked) => setAgreed(checked === true)}
                      className="shrink-0 border-white/25 bg-white/5 text-white data-[state=checked]:border-ios-blue data-[state=checked]:bg-ios-blue"
                    />
                    <Label
                      htmlFor="lawful-use-consent"
                      className="cursor-pointer text-[13px] leading-5 text-gray-200"
                    >
                      Я прочитал(а) условия и принимаю личную ответственность.
                    </Label>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[13px] leading-6 text-gray-200">
                {updateHighlights.map((item) => (
                  <div key={item} className="flex gap-2">
                    <span className="text-ios-blue">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Button always visible at the bottom — outside the scroll area */}
          <div className="shrink-0 border-t border-white/8 p-4 sm:px-5 sm:pb-5">
            <Button
              type="button"
              className="h-11 w-full rounded-xl bg-ios-blue text-sm font-semibold text-white hover:bg-ios-blue/90 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={mode === "agreement" && !agreed}
              onClick={mode === "agreement" ? acceptAgreement : closeUpdate}
            >
              {mode === "agreement" ? "Принять и продолжить" : "Понятно"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
