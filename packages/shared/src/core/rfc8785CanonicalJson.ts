/**
 * RFC 8785: JSON Canonicalization Scheme (JCS) implementation.
 * Ensures deterministic, byte-for-byte identical serialization across languages and platforms
 * for cryptographic state hashing, tamper evidence, and digital signatures.
 *
 * Spec: https://datatracker.ietf.org/doc/html/rfc8785
 */

/**
 * Escapes a string in strict accordance with RFC 8785 Section 3.2.2.2.
 * Only quotation mark, reverse solidus, and control characters (U+0000 to U+001F)
 * are escaped. All other Unicode code points are emitted directly.
 */
function escapeString(str: string): string {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);
    switch (char) {
      case '"':
        result += '\\"';
        break;
      case "\\":
        result += "\\\\";
        break;
      case "\b":
        result += "\\b";
        break;
      case "\f":
        result += "\\f";
        break;
      case "\n":
        result += "\\n";
        break;
      case "\r":
        result += "\\r";
        break;
      case "\t":
        result += "\\t";
        break;
      default:
        if (code < 0x20) {
          result += `\\u00${code.toString(16).padStart(2, "0")}`;
        } else {
          result += char;
        }
    }
  }
  result += '"';
  return result;
}

/**
 * Formats a number in accordance with RFC 8785 Section 3.2.2.3.
 * Uses ECMAScript standard Number::toString representation.
 * -0 is serialized as 0.
 * NaN and Infinity are prohibited in JSON and throw a TypeError.
 */
function serializeNumber(num: number): string {
  if (!Number.isFinite(num)) {
    throw new TypeError(`RFC 8785 prohibits serializing non-finite numbers: ${num}`);
  }
  if (Object.is(num, -0)) {
    return "0";
  }
  return String(num);
}

/**
 * Canonicalizes any JSON-compatible value in strict compliance with RFC 8785.
 *
 * @param value - The input value to serialize canonical JSON from.
 * @returns Deterministic RFC 8785 canonical JSON string.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  const type = typeof value;

  if (type === "boolean") {
    return value ? "true" : "false";
  }

  if (type === "number") {
    return serializeNumber(value as number);
  }

  if (type === "string") {
    return escapeString(value as string);
  }

  if (type === "bigint") {
    return (value as bigint).toString();
  }

  if (type === "undefined" || type === "function" || type === "symbol") {
    return "";
  }

  if (Array.isArray(value)) {
    const elements: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === "undefined" || typeof item === "function" || typeof item === "symbol") {
        elements.push("null");
      } else {
        elements.push(canonicalizeJson(item));
      }
    }
    return `[${elements.join(",")}]`;
  }

  if (type === "object") {
    // If value has a toJSON method (like Date), invoke it first
    if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
      return canonicalizeJson((value as { toJSON: () => unknown }).toJSON());
    }

    const entries = Object.entries(value as Record<string, unknown>);
    // RFC 8785: Object keys must be sorted by their UTF-16 code units
    entries.sort(([keyA], [keyB]) => (keyA < keyB ? -1 : keyA > keyB ? 1 : 0));

    const fields: string[] = [];
    for (const [key, val] of entries) {
      if (typeof val === "undefined" || typeof val === "function" || typeof val === "symbol") {
        continue;
      }
      fields.push(`${escapeString(key)}:${canonicalizeJson(val)}`);
    }

    return `{${fields.join(",")}}`;
  }

  return "";
}
