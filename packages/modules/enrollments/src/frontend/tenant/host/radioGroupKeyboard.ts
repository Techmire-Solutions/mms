import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).radioGroupKeyboard;

export function handleRadioGroupKeyDown(...args: any[]): void {
  host()?.handleRadioGroupKeyDown?.(...args);
}

export const radioGroupKeyboard = {
  handleRadioGroupKeyDown,
};

export default radioGroupKeyboard;
