export interface KpiCategoryFlags {
  isContactsCategory: boolean;
  isStudentsCategory: boolean;
  isFacultyCategory: boolean;
  isSessionsCategory: boolean;
  isEnrollmentsCategory: boolean;
  isObligationsCategory: boolean;
  isAccountingCategory: boolean;
  isUsersCategory: boolean;
  isMessagingCategory: boolean;
  needsContactAnalytics: boolean;
}

export function getKpiCategoryFlags(category: string): KpiCategoryFlags {
  const isContactsCategory = category === "contacts";
  const isStudentsCategory = category === "students";
  const isFacultyCategory = category === "faculty";
  const isSessionsCategory = category === "sessions";
  const isEnrollmentsCategory = category === "enrollments";
  const isObligationsCategory = category === "obligations";
  const isAccountingCategory = category === "accounting";
  const isUsersCategory = category === "users";
  const isMessagingCategory = category === "messaging";
  const needsContactAnalytics = isContactsCategory || isStudentsCategory || isSessionsCategory;
  return {
    isContactsCategory,
    isStudentsCategory,
    isFacultyCategory,
    isSessionsCategory,
    isEnrollmentsCategory,
    isObligationsCategory,
    isAccountingCategory,
    isUsersCategory,
    isMessagingCategory,
    needsContactAnalytics,
  };
}
