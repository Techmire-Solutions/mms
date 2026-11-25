import { calcAge as contractCalcAge, type Student } from "@mms/contracts";
import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).studentsData;

export function calcAge(
  ...args: Parameters<typeof contractCalcAge>
): ReturnType<typeof contractCalcAge> {
  const fn = host()?.calcAge;
  return typeof fn === "function" ? fn(...args) : contractCalcAge(...args);
}

export type { Student };

export const studentsData = {
  calcAge,
};

export default studentsData;
