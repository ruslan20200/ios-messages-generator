// MODIFIED BY AI: 2026-03-26 - cover grouped-route storage and reply generation for the 2505 local transport mode
// FILE: client/src/lib/chat2505.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildChat2505ReplyText,
  countChat2505Transports,
  createChat2505Conversation,
  formatChat2505TransportDraft,
  maskChat2505Phone,
  normalizeChat2505Plate,
  normalizeChat2505Phone,
  parseChat2505TransportInput,
} from "./chat2505";

describe("chat2505 helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes and masks phone numbers", () => {
    expect(normalizeChat2505Phone("+7 770 001 111")).toBe("7770001111");
    expect(maskChat2505Phone("7770001111")).toBe("777XXX1111");
  });

  it("parses transport input in the screenshot format", () => {
    expect(parseChat2505TransportInput("26010(628ВН05)")).toEqual({
      code: "26010",
      plate: "628ВН05",
    });
    expect(parseChat2505TransportInput("24506(761AJ05)")).toEqual({
      code: "24506",
      plate: "761AJ05",
    });
    expect(parseChat2505TransportInput("26010 (628ВН05)")).toEqual({
      code: "26010",
      plate: "628ВН05",
    });
    expect(parseChat2505TransportInput("26010(628BH05)")).toEqual({
      code: "26010",
      plate: "628BH05",
    });
    expect(parseChat2505TransportInput("26010(628ВНО5)")).toEqual({
      code: "26010",
      plate: "628ВН05",
    });
    expect(parseChat2505TransportInput("24506(761AJO5)")).toEqual({
      code: "24506",
      plate: "761AJ05",
    });
    expect(parseChat2505TransportInput("26010-628ВН05")).toBeNull();
  });

  it("formats draft transport input into the strict storage shape", () => {
    expect(formatChat2505TransportDraft("24506761aj05")).toBe("24506(761AJ05)");
    expect(formatChat2505TransportDraft("24506761ajo5")).toBe("24506(761AJ05)");
    expect(formatChat2505TransportDraft("24506 761AJ05")).toBe("24506(761AJ05)");
    expect(formatChat2505TransportDraft("24506(761AJ05)")).toBe("24506(761AJ05)");
    expect(formatChat2505TransportDraft("24506")).toBe("24506(");
    expect(formatChat2505TransportDraft("2450")).toBe("2450");
  });

  it("normalizes legacy zero-like plates into the strict format", () => {
    expect(normalizeChat2505Plate("761AJO5")).toBe("761AJ05");
    expect(normalizeChat2505Plate("628ВНО5")).toBe("628ВН05");
    expect(normalizeChat2505Plate("761AJ05")).toBe("761AJ05");
  });

  it("counts transports across all route groups", () => {
    expect(
      countChat2505Transports({
        phone: "7770001111",
        routes: [
          {
            id: "route-1",
            name: "5",
            transports: [{ id: "transport-1", code: "26010", plate: "628ВН05" }],
          },
          {
            id: "route-2",
            name: "12",
            transports: [
              { id: "transport-2", code: "12001", plate: "111AAA1" },
              { id: "transport-3", code: "12002", plate: "222BBB2" },
            ],
          },
        ],
      }),
    ).toBe(3);
  });

  it("builds the expected reply structure", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const text = buildChat2505ReplyText({
      code: "26010",
      plate: "628ВН05",
      phone: "7770001111",
      now: new Date("2026-03-26T11:27:43"),
    });

    const lines = text.split("\n");

    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe("БИЛЕТ: 0111:15:1111");
    expect(lines[1]).toBe("СУММА: 120 ТГ.");
    expect(lines[2]).toBe("ДАТА: 26.03.2026 11:27:43");
    expect(lines[3]).toBe("ТРАНСПОРТ: 26010 (628ВН05)");
    expect(lines[4]).toBe("ТЕЛ: 777XXX1111");
    expect(lines[5]).toBe("ТРАНЗАКЦИЯ: 1111111111");
    expect(lines[6]).toBe("ТОО АЛМАТЫ ОБЛЫСЫНЫҢ");
    expect(lines[7]).toBe("ЖОЛАУШЫЛАРДЫ ТАСЫМА");
  });

  it("returns route-aware details for travel stats when the code is found", () => {
    const result = createChat2505Conversation({
      code: "26010",
      settings: {
        phone: "7770001111",
        routes: [
          {
            id: "route-1",
            name: "5",
            transports: [{ id: "transport-1", code: "26010", plate: "628ВН05" }],
          },
        ],
      },
      now: new Date("2026-03-26T11:27:43"),
    });

    expect(result.responseMessage.details?.route).toBe("5");
    expect(result.responseMessage.details?.number).toBe("628ВН05");
    expect(result.responseMessage.details?.transportCode).toBe("26010");
  });

  it("returns an error response when the transport code is missing", () => {
    const result = createChat2505Conversation({
      code: "26099",
      settings: {
        phone: "7770001111",
        routes: [
          {
            id: "route-1",
            name: "5",
            transports: [{ id: "transport-1", code: "26010", plate: "628ВН05" }],
          },
        ],
      },
      now: new Date("2026-03-26T11:27:43"),
    });

    expect(result.userMessage.text).toBe("26099");
    expect(result.responseMessage.text).toBe(
      "Ошибка. Код транспорта не найден в сохранённых транспортах.",
    );
  });
});
