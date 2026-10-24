import type { Contact } from "@mms/shared";

export function extractPhoneKeys(contact: Contact): string[] {
  const keys = new Set<string>();
  for (const phone of contact.phones ?? []) {
    const raw = String(phone.number || "").trim();
    if (!raw) continue;
    const digits = raw.replace(/\D/g, "");
    const cc = String(phone.countryCode || "").replace(/\D/g, "");
    const withCountry = `${cc}${digits}`;
    if (digits) keys.add(digits);
    if (withCountry) keys.add(withCountry);
    if (digits.length >= 10) keys.add(digits.slice(-10));
    if (withCountry.length >= 10) keys.add(withCountry.slice(-10));
  }
  return [...keys];
}

export function extractEmails(contact: Contact): string[] {
  const emails = new Set<string>();
  for (const email of contact.emails ?? []) {
    const raw = String(email.address || "")
      .trim()
      .toLowerCase();
    if (raw) emails.add(raw);
  }
  return [...emails];
}

export class PeerContactIndex {
  private phoneMap = new Map<string, Contact>();
  private emailMap = new Map<string, Contact>();
  private nameMap = new Map<string, Contact>();

  constructor(initialPeers: Contact[] = []) {
    for (const peer of initialPeers) {
      this.add(peer);
    }
  }

  add(peer: Contact): void {
    for (const key of extractPhoneKeys(peer)) {
      if (!this.phoneMap.has(key)) this.phoneMap.set(key, peer);
    }
    for (const email of extractEmails(peer)) {
      if (!this.emailMap.has(email)) this.emailMap.set(email, peer);
    }
    const normName = peer.name?.trim().toLowerCase();
    if (normName && !this.nameMap.has(normName)) {
      this.nameMap.set(normName, peer);
    }
  }

  update(_oldPeer: Contact, newPeer: Contact): void {
    this.add(newPeer);
  }

  findMatch(candidate: Contact): Contact | undefined {
    for (const key of extractPhoneKeys(candidate)) {
      const match = this.phoneMap.get(key);
      if (match) return match;
    }
    for (const email of extractEmails(candidate)) {
      const match = this.emailMap.get(email);
      if (match) return match;
    }
    const normName = candidate.name?.trim().toLowerCase();
    if (normName) {
      const match = this.nameMap.get(normName);
      if (match) return match;
    }
    return undefined;
  }
}

export function findMatchingPeer(candidate: Contact, peers: Contact[]): Contact | undefined {
  const candidatePhones = new Set(extractPhoneKeys(candidate));
  const candidateEmails = new Set(extractEmails(candidate));
  const candidateName = candidate.name.trim().toLowerCase();

  for (const peer of peers) {
    for (const key of extractPhoneKeys(peer)) {
      if (candidatePhones.has(key)) return peer;
    }
    for (const email of extractEmails(peer)) {
      if (candidateEmails.has(email)) return peer;
    }
    if (candidateName && peer.name.trim().toLowerCase() === candidateName) {
      return peer;
    }
  }
  return undefined;
}
