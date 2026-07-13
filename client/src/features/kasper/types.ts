export type TicketSource = "9909" | "2505";

export type TicketData = {
  id: string;
  source: TicketSource;
  requestedCode: string;
  status: "active";
  expiresAt: string;
  amount?: string;
  paymentDate?: string;
  paymentTime?: string;
  paymentAt?: string;
  phone?: string;
  phoneMasked?: string;
  transportCode?: string;
  plate?: string;
  ticketNumber?: string;
  transaction?: string;
  transport?: string;
  company?: string;
  bin?: string;
  qrPayload: string;
  createdAt: string;
};

export type ConversationMessage = {
  id: string;
  direction: "outgoing" | "incoming" | "error";
  code?: string;
  ticket?: TicketData;
  text?: string;
};
