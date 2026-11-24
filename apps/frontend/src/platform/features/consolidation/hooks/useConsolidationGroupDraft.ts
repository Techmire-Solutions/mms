import { useState } from "react";
import {
  consolidationGroupPutSchema,
  generateClientEntityId,
  type ConsolidationGroup,
  type ConsolidationGroupPut,
  type ConsolidationMember,
} from "@mms/shared";

export interface MemberDraft {
  key: string;
  memberSubdomain: string;
  ownershipPercent: string;
  isParent: boolean;
  closingRate: string;
  averageRate: string;
  historicalRate: string;
}

export interface GroupDraft {
  id: string;
  name: string;
  presentationCurrency: string;
  intercompanyAccountCodes: string[];
  members: MemberDraft[];
}

const emptyMember = (isParent: boolean): MemberDraft => ({
  key: generateClientEntityId("m", "-"),
  memberSubdomain: "",
  ownershipPercent: "100",
  isParent,
  closingRate: "",
  averageRate: "",
  historicalRate: "",
});

function toDraft(group: ConsolidationGroup | null): GroupDraft {
  if (!group) {
    return {
      id: generateClientEntityId("grp"),
      name: "",
      presentationCurrency: "PKR",
      intercompanyAccountCodes: [],
      members: [emptyMember(true)],
    };
  }
  return {
    id: group.id,
    name: group.name,
    presentationCurrency: group.presentationCurrency,
    intercompanyAccountCodes: group.intercompanyAccountCodes,
    members: group.members.map((member) => ({
      key: generateClientEntityId("m", "-"),
      memberSubdomain: member.memberSubdomain,
      ownershipPercent: String(member.ownershipPercent),
      isParent: member.isParent,
      closingRate: member.closingRate ?? "",
      averageRate: member.averageRate ?? "",
      historicalRate: member.historicalRate ?? "",
    })),
  };
}

function toMember(draft: MemberDraft): ConsolidationMember {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    memberSubdomain: draft.memberSubdomain,
    ownershipPercent: Number(draft.ownershipPercent),
    isParent: draft.isParent,
    closingRate: optional(draft.closingRate),
    averageRate: optional(draft.averageRate),
    historicalRate: optional(draft.historicalRate),
  };
}

/** Apply a member edit; marking a member as parent clears the flag on the others. */
export function applyMemberPatch(
  members: readonly MemberDraft[],
  key: string,
  patch: Partial<MemberDraft>,
): MemberDraft[] {
  return members.map((member) => {
    if (member.key === key) return { ...member, ...patch };
    return patch.isParent ? { ...member, isParent: false } : member;
  });
}

/** Validate a draft against the shared DTO; the message is a translation key. */
export function buildGroupPayload(
  draft: GroupDraft,
): { ok: true; body: ConsolidationGroupPut } | { ok: false; message: string } {
  const result = consolidationGroupPutSchema.safeParse({
    name: draft.name,
    presentationCurrency: draft.presentationCurrency,
    intercompanyAccountCodes: draft.intercompanyAccountCodes,
    members: draft.members.filter((member) => member.memberSubdomain).map(toMember),
  });
  return result.success
    ? { ok: true, body: result.data }
    : { ok: false, message: result.error.issues[0]?.message ?? "common.formPleaseFixErrors" };
}

/** A fresh draft (or one hydrated from a stored group). */
export const createGroupDraft = toDraft;

/** Form state for creating or editing a consolidation group, validated by the shared DTO. */
export function useConsolidationGroupDraft(initial: ConsolidationGroup | null) {
  const [draft, setDraft] = useState<GroupDraft>(() => toDraft(initial));

  const updateMember = (key: string, patch: Partial<MemberDraft>) =>
    setDraft((current) => ({ ...current, members: applyMemberPatch(current.members, key, patch) }));

  const parse = () => buildGroupPayload(draft);

  return {
    draft,
    setDraft,
    updateMember,
    addMember: () =>
      setDraft((current) => ({ ...current, members: [...current.members, emptyMember(false)] })),
    removeMember: (key: string) =>
      setDraft((current) => ({
        ...current,
        members: current.members.filter((m) => m.key !== key),
      })),
    parse,
  };
}
