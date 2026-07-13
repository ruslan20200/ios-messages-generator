import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Camera, ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import {
  type FormEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import { QrScannerSheet } from "@/components/QrScannerSheet";
import { detectKasperQr, type QrParseResult } from "./qr";
import {
  createLocalTicket,
  readActiveTab,
  readOpenTicket,
  readTicketHistory,
  requestApiTicket,
  saveActiveTab,
  saveOpenTicket,
  saveTicketHistory,
} from "./ticketService";
import { TicketSheet } from "./TicketSheet";
import type { ConversationMessage, TicketData, TicketSource } from "./types";
import styles from "./KasperPage.module.css";

type Tab = TicketSource;

const TAB_ORDER: Tab[] = ["9909", "2505"];

const tabLabels: Record<Tab, string> = {
  "9909": "QR-9909",
  "2505": "QR-2505",
};

const isTicketExpired = (ticket: TicketData) =>
  Date.now() >= new Date(ticket.expiresAt).getTime();

const TicketListItem = memo(function TicketListItem({
  ticket,
  onOpen,
  onDelete,
}: {
  ticket: TicketData;
  onOpen: (ticket: TicketData) => void;
  onDelete?: (id: string) => void;
}) {
  const amount = (ticket.amount ?? "").replace("₸", "").trim();
  const expired = isTicketExpired(ticket);
  const meta = [ticket.transportCode, amount ? `${amount} ₸` : null, ticket.paymentTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      className={styles.listRow}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" className={styles.card} onClick={() => onOpen(ticket)}>
        <span className={styles.cardMain}>
          <span className={styles.cardHead}>
            <span
              className={`${styles.dot} ${expired ? styles.dotExpired : ""}`}
              aria-hidden="true"
            />
            {expired ? "Билет недействителен" : "Билет активен"}
          </span>
          <span className={styles.cardMeta}>{meta}</span>
        </span>
        <ChevronRight className={styles.cardChevron} size={20} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {onDelete ? (
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => onDelete?.(ticket.id)}
          aria-label={`Удалить билет ${ticket.ticketNumber ?? ""}`}
        >
          <Trash2 size={19} strokeWidth={1.8} />
        </button>
      ) : null}
    </motion.div>
  );
});

export default function KasperPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>(readActiveTab);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Record<Tab, ConversationMessage[]>>({
    "9909": [],
    "2505": [],
  });
  const [tickets, setTickets] = useState<TicketData[]>(readTicketHistory);
  // Restore the ticket that was open when the PWA was last closed.
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(readOpenTicket);
  const [isSheetOpen, setIsSheetOpen] = useState(() => readOpenTicket() !== null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeTickets = tickets.filter(ticket => !isTicketExpired(ticket));
  const expiredTickets = tickets.filter(ticket => isTicketExpired(ticket));

  useEffect(() => {
    saveTicketHistory(tickets);
  }, [tickets]);

  useEffect(() => {
    saveActiveTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    // Only the 9909 feed appends at the bottom; 2505 prepends, so no auto-scroll there.
    if (activeTab !== "9909") return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeTab, messages]);

  const openTicket = useCallback((ticket: TicketData) => {
    setSelectedTicket(ticket);
    setIsSheetOpen(true);
    saveOpenTicket(ticket);
  }, []);

  const closeTicket = useCallback(() => {
    setIsSheetOpen(false);
    saveOpenTicket(null);
  }, []);

  const addMessage = (tab: Tab, message: ConversationMessage) => {
    setMessages(current => ({ ...current, [tab]: [...current[tab], message] }));
  };

  const showError = (message: string) => {
    setError(message);
    setShakeKey(current => current + 1);
  };

  const submitCode = async (rawCode: string, source: Tab = activeTab) => {
    if (isLoading) return;
    const normalizedCode = rawCode.replace(/\D/g, "");

    if (normalizedCode.length < 4) {
      showError("Введите не менее 4 цифр кода.");
      return;
    }

    if (source !== activeTab) setActiveTab(source);
    setError(null);
    setCode("");
    setIsLoading(true);

    try {
      const ticket =
        source === "9909"
          ? await requestApiTicket(normalizedCode)
          : createLocalTicket(normalizedCode);

      if (source === "2505") {
        setTickets(current => [ticket, ...current]);
      } else {
        addMessage("9909", { id: nanoid(), direction: "incoming", ticket });
      }

      openTicket(ticket);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Не удалось получить ответ.";
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitCode(code);
  };

  // The scanner auto-detects Onay (9909) vs SMSBUS (2505); route to the right flow.
  const scanSourceRef = useRef<Tab | null>(null);
  const parseScan = useCallback((raw: string): QrParseResult => {
    const detected = detectKasperQr(raw);
    if (!detected.ok) return { ok: false, error: detected.error };
    scanSourceRef.current = detected.source;
    return { ok: true, value: detected.value };
  }, []);

  const handleScanDetected = (value: string) => {
    const source = scanSourceRef.current ?? activeTab;
    scanSourceRef.current = null;
    void submitCode(value, source);
  };

  // Autoscan: opening from Home with ?scan=1 launches the camera immediately.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("scan") === "1") {
      setIsScannerOpen(true);
      window.history.replaceState({}, "", "/kasper");
    }
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setError(null);
  };

  const deleteTicket = useCallback((ticketId: string) => {
    setTickets(current => current.filter(ticket => ticket.id !== ticketId));
  }, []);

  const deleteMessage = useCallback((ticketId: string) => {
    setMessages(current => ({
      ...current,
      "9909": current["9909"].filter(message => message.ticket?.id !== ticketId),
    }));
  }, []);

  const currentMessages = messages[activeTab];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate("/home")}
            aria-label="На главную"
          >
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <h1>Оплата проезда по QR</h1>
        </header>

        <nav className={styles.tabs} aria-label="Тип QR-кода">
          <span
            className={`${styles.tabIndicator} ${activeTab === "2505" ? styles.tabIndicatorSecond : ""}`}
            aria-hidden="true"
          />
          {TAB_ORDER.map(tab => (
            <button
              type="button"
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => handleTabChange(tab)}
              aria-selected={activeTab === tab}
              role="tab"
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={activeTab}
            className={styles.panel}
            role="tabpanel"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              const left = info.offset.x < -60 || info.velocity.x < -450;
              const right = info.offset.x > 60 || info.velocity.x > 450;
              if (left && activeTab === "9909") handleTabChange("2505");
              else if (right && activeTab === "2505") handleTabChange("9909");
            }}
            initial={{ opacity: 0, x: activeTab === "2505" ? 14 : -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === "2505" ? -14 : 14 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.list}>
              {activeTab === "2505" ? (
                <>
                  {activeTickets.length > 0 ? (
                    <>
                      <div className={styles.groupHead}>Активные</div>
                      {activeTickets.map(ticket => (
                        <TicketListItem
                          key={ticket.id}
                          ticket={ticket}
                          onOpen={openTicket}
                          onDelete={deleteTicket}
                        />
                      ))}
                    </>
                  ) : null}

                  {expiredTickets.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className={styles.groupToggle}
                        onClick={() => setInactiveOpen(open => !open)}
                        aria-expanded={inactiveOpen}
                      >
                        <span>Неактивные ({expiredTickets.length})</span>
                        <ChevronDown
                          className={`${styles.groupChevron} ${inactiveOpen ? styles.groupChevronOpen : ""}`}
                          size={18}
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      </button>
                      {inactiveOpen
                        ? expiredTickets.map(ticket => (
                            <TicketListItem
                              key={ticket.id}
                              ticket={ticket}
                              onOpen={openTicket}
                              onDelete={deleteTicket}
                            />
                          ))
                        : null}
                    </>
                  ) : null}
                </>
              ) : (
                currentMessages.map(message =>
                  message.ticket ? (
                    <TicketListItem
                      key={message.id}
                      ticket={message.ticket}
                      onOpen={openTicket}
                      onDelete={deleteMessage}
                    />
                  ) : null,
                )
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              className={styles.composer}
              onSubmit={handleSubmit}
              noValidate
            >
              <div
                key={shakeKey}
                className={`${styles.composerRow} ${error ? styles.shake : ""}`}
              >
                <button
                  type="button"
                  className={styles.plusButton}
                  onClick={() => setIsScannerOpen(true)}
                  disabled={isLoading}
                  aria-label="Сканировать QR"
                >
                  <Camera size={22} strokeWidth={2} aria-hidden="true" />
                </button>
                <input
                  id="kasper-code"
                  className={styles.input}
                  value={code}
                  onChange={event =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 12))
                  }
                  placeholder="Введите код"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`Код QR-${activeTab}`}
                  aria-describedby="kasper-code-error"
                  aria-invalid={Boolean(error)}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isLoading || code.length < 4}
                  aria-label="Отправить"
                >
                  {isLoading ? (
                    <span className={styles.spinner} aria-hidden="true" />
                  ) : (
                    <ArrowUp size={22} strokeWidth={2.6} aria-hidden="true" />
                  )}
                </button>
              </div>
              <p
                id="kasper-code-error"
                className={styles.errorText}
                role="alert"
              >
                {error ?? ""}
              </p>
            </form>
          </motion.section>
        </AnimatePresence>
      </div>

      <TicketSheet
        ticket={selectedTicket}
        isOpen={isSheetOpen}
        onClose={closeTicket}
      />

      <QrScannerSheet
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onDetected={handleScanDetected}
        parse={parseScan}
        variant="kaspi"
        title="Kaspi QR"
      />

      {isLoading ? (
        <div className={styles.processing} aria-live="polite" aria-label="Обработка">
          <span className={styles.processingSpinner} />
        </div>
      ) : null}
    </main>
  );
}
