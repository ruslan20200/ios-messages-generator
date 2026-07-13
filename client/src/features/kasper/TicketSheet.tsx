import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import type { TicketData } from "./types";
import styles from "./KasperPage.module.css";

type TicketSheetProps = {
  ticket: TicketData | null;
  isOpen: boolean;
  onClose: () => void;
};

const getRemainingMs = (expiresAt: string) =>
  Math.max(0, new Date(expiresAt).getTime() - Date.now());

const formatRemainingTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map(part => String(part).padStart(2, "0")).join(":");
};

export function TicketSheet({ ticket, isOpen, onClose }: TicketSheetProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    ticket ? getRemainingMs(ticket.expiresAt) : 0
  );

  useEffect(() => {
    if (!ticket || !isOpen) return;

    const update = () => setRemainingMs(getRemainingMs(ticket.expiresAt));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [isOpen, ticket]);

  const expired = remainingMs <= 0;
  const remaining = formatRemainingTime(remainingMs);

  // Opens partial (page title behind visible). Drag anywhere on the sheet:
  // up -> full screen, down -> collapse (or close when already partial).
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  const detailItems = ticket
    ? (ticket.source === "2505"
        ? [
            ["Дата оплаты", ticket.paymentDate],
            ["Время оплаты", ticket.paymentTime],
            ["Стоимость", ticket.amount],
            ["Номер телефона", ticket.phone],
            ["Билет", ticket.ticketNumber],
            ["Транспорт", ticket.transport],
            ["Компания", ticket.company],
            ["Категория пассажира", "Обычный пассажир"],
          ]
        : [
            ["Дата оплаты", ticket.paymentDate],
            ["Время оплаты", ticket.paymentTime],
            ["Стоимость", ticket.amount],
            ["Номер маршрута", ticket.transportCode],
            ["Госномер транспорта", ticket.plate],
            ["Билет", ticket.qrPayload],
          ]
      ).filter(([, value]) => Boolean(value))
    : [];

  const sheetTitle =
    ticket?.source === "9909"
      ? "Билет Onay. Оплата проезда"
      : "Оплата проезда по QR";

  return (
    <AnimatePresence>
      {isOpen && ticket ? (
        <>
          <motion.button
            type="button"
            aria-label="Закрыть билет"
            className={styles.sheetOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            className={`${styles.ticketSheet} ${expanded ? styles.sheetExpanded : ""}`}
            aria-modal="true"
            aria-label="Активный билет"
            role="dialog"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              const down = info.offset.y > 90 || info.velocity.y > 500;
              const up = info.offset.y < -90 || info.velocity.y < -500;
              if (up) setExpanded(true);
              else if (down) {
                if (expanded) setExpanded(false);
                else onClose();
              }
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              stiffness: 210,
              damping: 26,
              mass: 0.9,
            }}
          >
            <div className={styles.ticketContent}>
              <section className={styles.statusCard}>
                <div className={styles.dragHandle}>
                  <div className={styles.grabber} />
                </div>
                <div className={styles.statusHead}>
                  <h2>{sheetTitle}</h2>
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Закрыть"
                  >
                    <X size={24} strokeWidth={1.8} />
                  </button>
                </div>
                <div
                  className={`${styles.successIcon} ${expired ? styles.expiredIcon : ""}`}
                  aria-hidden="true"
                >
                  {expired ? <X size={30} strokeWidth={2.6} /> : <Check size={30} strokeWidth={2.4} />}
                </div>
                <p>{expired ? "Билет недействителен" : "Билет активен"}</p>
                <strong className={expired ? styles.timerExpired : ""}>{remaining}</strong>
              </section>

              {detailItems.length > 0 ? (
                <section
                  className={styles.detailsCard}
                  aria-label="Реквизиты билета"
                >
                  {detailItems.map(([label, value]) => (
                    <div className={styles.detailItem} key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </section>
              ) : null}

              <section className={styles.qrCard} aria-label="QR-код билета">
                <div className={styles.qrFrame}>
                  <QRCodeSVG
                    value={ticket.qrPayload}
                    size={168}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                  />
                </div>
              </section>
            </div>
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}
