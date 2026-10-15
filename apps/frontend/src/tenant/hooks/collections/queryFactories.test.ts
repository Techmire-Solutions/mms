import { describe, expect, it } from "vitest";
import * as contactsFacade from "./contacts";
import * as studentsFacade from "./students";
import * as facultyFacade from "./faculty";
import * as sessionsFacade from "./sessions";
import * as enrollmentsFacade from "./enrollments";
import * as financeFacade from "./finance";
import * as attendanceFacade from "./attendance";
import * as accountingFacade from "./accounting";
import * as hasanatFacade from "./hasanat";
import * as obligationsFacade from "./obligations";
import * as examinationsFacade from "./examinations";
import * as questionBankFacade from "./questionBank";
import * as messagingFacade from "./messaging";
import * as usersFacade from "./users";
import { SUMMARY_STALE_TIME } from "@/lib/queryClient";

describe("TanStack Query v5 Query Options Factories (P8)", () => {
  describe("contacts collection facade", () => {
    it("exports contactsListQueryOptions and contactsCommandMetricsQueryOptions", () => {
      expect(typeof contactsFacade.contactsListQueryOptions).toBe("function");
      expect(typeof contactsFacade.contactsInfiniteQueryOptions).toBe("function");
      expect(typeof contactsFacade.contactsCommandMetricsQueryOptions).toBe("function");

      const listOptions = contactsFacade.contactsListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");
      expect(listOptions.staleTime).toBe(15_000);

      const infiniteOptions = contactsFacade.contactsInfiniteQueryOptions({ limit: 25 });
      expect(infiniteOptions.queryKey).toBeDefined();
      expect(typeof infiniteOptions.queryFn).toBe("function");
      expect(typeof infiniteOptions.getNextPageParam).toBe("function");
      expect(infiniteOptions.staleTime).toBe(15_000);

      const metricsOptions = contactsFacade.contactsCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["contacts", "metrics"]);
      expect(typeof metricsOptions.queryFn).toBe("function");
      expect(metricsOptions.staleTime).toBe(SUMMARY_STALE_TIME);
    });
  });

  describe("students collection facade", () => {
    it("exports studentsListQueryOptions and studentsCommandMetricsQueryOptions", () => {
      expect(typeof studentsFacade.studentsListQueryOptions).toBe("function");
      expect(typeof studentsFacade.studentsInfiniteQueryOptions).toBe("function");
      expect(typeof studentsFacade.studentsCommandMetricsQueryOptions).toBe("function");

      const listOptions = studentsFacade.studentsListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");
      expect(listOptions.staleTime).toBe(15_000);

      const infiniteOptions = studentsFacade.studentsInfiniteQueryOptions({ limit: 25 });
      expect(infiniteOptions.queryKey).toBeDefined();
      expect(typeof infiniteOptions.queryFn).toBe("function");
      expect(typeof infiniteOptions.getNextPageParam).toBe("function");
      expect(infiniteOptions.staleTime).toBe(15_000);

      const metricsOptions = studentsFacade.studentsCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["students", "metrics"]);
      expect(typeof metricsOptions.queryFn).toBe("function");
      expect(metricsOptions.staleTime).toBe(SUMMARY_STALE_TIME);
    });
  });

  describe("faculty collection facade", () => {
    it("exports facultyListQueryOptions and facultyCommandMetricsQueryOptions", () => {
      expect(typeof facultyFacade.facultyListQueryOptions).toBe("function");
      expect(typeof facultyFacade.facultyCommandMetricsQueryOptions).toBe("function");

      const listOptions = facultyFacade.facultyListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");
      expect(listOptions.staleTime).toBe(15_000);

      const metricsOptions = facultyFacade.facultyCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["faculty", "metrics"]);
      expect(typeof metricsOptions.queryFn).toBe("function");
      expect(metricsOptions.staleTime).toBe(SUMMARY_STALE_TIME);
    });
  });

  describe("sessions collection facade", () => {
    it("exports sessionsListQueryOptions and sessionsCommandMetricsQueryOptions", () => {
      expect(typeof sessionsFacade.sessionsListQueryOptions).toBe("function");
      expect(typeof sessionsFacade.sessionsCommandMetricsQueryOptions).toBe("function");

      const listOptions = sessionsFacade.sessionsListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");
      expect(listOptions.staleTime).toBe(15_000);

      const metricsOptions = sessionsFacade.sessionsCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["sessions", "metrics"]);
      expect(typeof metricsOptions.queryFn).toBe("function");
      expect(metricsOptions.staleTime).toBe(SUMMARY_STALE_TIME);
    });
  });

  describe("enrollments collection facade", () => {
    it("exports enrollmentsListQueryOptions and enrollmentsCommandMetricsQueryOptions", () => {
      expect(typeof enrollmentsFacade.enrollmentsListQueryOptions).toBe("function");
      expect(typeof enrollmentsFacade.enrollmentsCommandMetricsQueryOptions).toBe("function");

      const listOptions = enrollmentsFacade.enrollmentsListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");
      expect(listOptions.staleTime).toBe(15_000);

      const metricsOptions = enrollmentsFacade.enrollmentsCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["enrollments", "metrics"]);
      expect(typeof metricsOptions.queryFn).toBe("function");
      expect(metricsOptions.staleTime).toBe(SUMMARY_STALE_TIME);
    });
  });

  describe("finance collection facade", () => {
    it("exports finance invoices/payments list and command metrics queryOptions", () => {
      expect(typeof financeFacade.financeInvoicesListQueryOptions).toBe("function");
      expect(typeof financeFacade.financePaymentsListQueryOptions).toBe("function");
      expect(typeof financeFacade.financeCommandMetricsQueryOptions).toBe("function");

      const invoiceOptions = financeFacade.financeInvoicesListQueryOptions({ page: 1, limit: 25 });
      expect(invoiceOptions.queryKey).toBeDefined();
      expect(typeof invoiceOptions.queryFn).toBe("function");

      const metricsOptions = financeFacade.financeCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["finance", "metrics"]);
      expect(typeof metricsOptions.queryFn).toBe("function");
    });
  });

  describe("attendance collection facade", () => {
    it("exports attendanceListQueryOptions and attendanceCommandMetricsQueryOptions", () => {
      expect(typeof attendanceFacade.attendanceListQueryOptions).toBe("function");
      expect(typeof attendanceFacade.attendanceCommandMetricsQueryOptions).toBe("function");

      const listOptions = attendanceFacade.attendanceListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");

      const metricsOptions = attendanceFacade.attendanceCommandMetricsQueryOptions("2026-09-11");
      expect(metricsOptions.queryKey).toEqual(["attendance", "metrics", "2026-09-11"]);
      expect(typeof metricsOptions.queryFn).toBe("function");
    });
  });

  describe("accounting collection facade", () => {
    it("exports accounting query options factories", () => {
      expect(typeof accountingFacade.accountingAccountsListQueryOptions).toBe("function");
      expect(typeof accountingFacade.accountingEntriesListQueryOptions).toBe("function");
      expect(typeof accountingFacade.accountingFiscalYearsListQueryOptions).toBe("function");
      expect(typeof accountingFacade.accountingCommandMetricsQueryOptions).toBe("function");

      const entriesOptions = accountingFacade.accountingEntriesListQueryOptions({
        page: 1,
        limit: 25,
      });
      expect(entriesOptions.queryKey).toBeDefined();
      expect(typeof entriesOptions.queryFn).toBe("function");

      const metricsOptions = accountingFacade.accountingCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["accounting", "metrics"]);
    });
  });

  describe("hasanat collection facade", () => {
    it("exports hasanatListQueryOptions and hasanatCommandMetricsQueryOptions", () => {
      expect(typeof hasanatFacade.hasanatListQueryOptions).toBe("function");
      expect(typeof hasanatFacade.hasanatCommandMetricsQueryOptions).toBe("function");

      const listOptions = hasanatFacade.hasanatListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");

      const metricsOptions = hasanatFacade.hasanatCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["hasanat", "metrics"]);
    });
  });

  describe("obligations collection facade", () => {
    it("exports obligationsCollectionsListQueryOptions and obligationsCommandMetricsQueryOptions", () => {
      expect(typeof obligationsFacade.obligationsCollectionsListQueryOptions).toBe("function");
      expect(typeof obligationsFacade.obligationsCommandMetricsQueryOptions).toBe("function");

      const listOptions = obligationsFacade.obligationsCollectionsListQueryOptions({
        page: 1,
        limit: 25,
      });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");

      const metricsOptions = obligationsFacade.obligationsCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["obligations", "metrics"]);
    });
  });

  describe("examinations collection facade", () => {
    it("exports examinationsExamsListQueryOptions and examinationsCommandMetricsQueryOptions", () => {
      expect(typeof examinationsFacade.examinationsExamsListQueryOptions).toBe("function");
      expect(typeof examinationsFacade.examinationsCommandMetricsQueryOptions).toBe("function");

      const listOptions = examinationsFacade.examinationsExamsListQueryOptions({
        page: 1,
        limit: 25,
      });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");

      const metricsOptions = examinationsFacade.examinationsCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["examinations", "metrics"]);
    });
  });

  describe("questionBank collection facade", () => {
    it("exports questionBankQuestionsListQueryOptions and questionBankCommandMetricsQueryOptions", () => {
      expect(typeof questionBankFacade.questionBankQuestionsListQueryOptions).toBe("function");
      expect(typeof questionBankFacade.questionBankCommandMetricsQueryOptions).toBe("function");

      const listOptions = questionBankFacade.questionBankQuestionsListQueryOptions({
        page: 1,
        limit: 25,
      });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");

      const metricsOptions = questionBankFacade.questionBankCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["questionBank", "metrics"]);
    });
  });

  describe("messaging collection facade", () => {
    it("exports messagingLogsListQueryOptions and messagingCommandMetricsQueryOptions", () => {
      expect(typeof messagingFacade.messagingLogsListQueryOptions).toBe("function");
      expect(typeof messagingFacade.messagingCommandMetricsQueryOptions).toBe("function");

      const listOptions = messagingFacade.messagingLogsListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");

      const metricsOptions = messagingFacade.messagingCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["messaging", "metrics"]);
    });
  });

  describe("users collection facade", () => {
    it("exports usersListQueryOptions and usersCommandMetricsQueryOptions", () => {
      expect(typeof usersFacade.usersListQueryOptions).toBe("function");
      expect(typeof usersFacade.usersCommandMetricsQueryOptions).toBe("function");

      const listOptions = usersFacade.usersListQueryOptions({ page: 1, limit: 25 });
      expect(listOptions.queryKey).toBeDefined();
      expect(typeof listOptions.queryFn).toBe("function");

      const metricsOptions = usersFacade.usersCommandMetricsQueryOptions();
      expect(metricsOptions.queryKey).toEqual(["users", "metrics"]);
    });
  });
});

/**
 * Key-parity guardrail: every exported list queryOptions factory (both the
 * contract-driven generation and any legacy factories re-exported through a
 * facade) must build its queryKey under the module's collection key, because
 * the module invalidators (`invalidate*Queries`) target keys that share that
 * prefix. A factory keyed outside the collection prefix would never be
 * invalidated by its module's mutations.
 */
describe("module list query-key parity (invalidator coverage)", () => {
  type ListOptionsFactory = (query: { page: number; limit: number }) => { queryKey: readonly unknown[] };

  const modules: Array<[string, Record<string, unknown>]> = [
    ["contacts", contactsFacade],
    ["students", studentsFacade],
    ["faculty", facultyFacade],
    ["sessions", sessionsFacade],
    ["enrollments", enrollmentsFacade],
    ["finance", financeFacade],
    ["attendance", attendanceFacade],
    ["accounting", accountingFacade],
    ["hasanat", hasanatFacade],
    ["obligations", obligationsFacade],
    ["examinations", examinationsFacade],
    ["questionBank", questionBankFacade],
    ["messaging", messagingFacade],
    ["users", usersFacade],
  ];

  for (const [collectionKey, facade] of modules) {
    it(`all ${collectionKey} list queryOptions keys start with ["${collectionKey}"] and an invalidator is exported`, () => {
      const invalidatorNames = Object.keys(facade).filter((name) =>
        /^invalidate\w+Queries$/.test(name),
      );
      expect(invalidatorNames.length).toBeGreaterThanOrEqual(1);

      const factoryNames = Object.keys(facade).filter(
        (name) =>
          name.endsWith("ListQueryOptions") || name.endsWith("InfiniteQueryOptions"),
      );
      expect(factoryNames.length).toBeGreaterThanOrEqual(1);

      for (const name of factoryNames) {
        const factory = facade[name] as ListOptionsFactory;
        const options = factory({ page: 1, limit: 25 });
        expect(options.queryKey[0], `${name} queryKey[0]`).toBe(collectionKey);
      }
    });
  }
});
