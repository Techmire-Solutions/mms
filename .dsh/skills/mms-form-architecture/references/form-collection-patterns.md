# Form Collection Patterns & Control Recipes

This guide documents the implementation standards for form controls, repeatable collection rows,
entity quick-create selectors, stable row identity, payload sanitization, and Zod/API error
mapping in MMS. Norms live in `mms-form-architecture.md` §1, §3, §4, §8.

---

## 1. Repeatable collection rows

All repeatable collections (contacts phones/emails/addresses, journal lines, Wakala
distributions, fee schedules, question-bank options/citations, designation holdings) use the
standardized triad:

- `FormCollectionShell` — outer wrapper, empty state, and the `FormAddAnotherButton`
- `FormListFieldCard` — row container with the primary stripe default and `CardRemoveButton`
- `FormCardTypeSelect` — discriminative row-header selector (only when rows vary by type)

### Example implementation

```tsx
import {
  Field,
  FormCardTypeSelect,
  FormCollectionShell,
  FormListFieldCard,
  FormSelect,
} from "@/components/app/FormPrimitives";
import { Input } from "@mms/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useStableRowList } from "@/lib/forms/useStableRowList";

interface ItemRow {
  type: "standard" | "custom";
  label: string;
}

interface ItemCollectionEditorProps {
  items: ItemRow[];
  onChange: (items: ItemRow[]) => void;
  errors?: Record<string, string>;
}

export function ItemCollectionEditor({
  items,
  onChange,
  errors = {},
}: ItemCollectionEditorProps) {
  const { t } = useTranslation();
  const { rows, append, removeAt, updateAt } = useStableRowList<ItemRow>({
    values: items,
    onChange,
    createValue: () => ({ type: "standard", label: "" }),
    // Order-sensitive identity: an external reset (record switch) rebuilds row ids.
    serialize: (values) => JSON.stringify(values),
  });

  return (
    <FormCollectionShell
      addLabel={t("formTemplate.collection.add")}
      onAdd={append}
      isEmpty={rows.length === 0}
      onEnsureRow={append}
      allowAdd
    >
      {rows.map((row, index) => (
        <FormListFieldCard
          // Identity key — never the array index (see §2).
          key={row.id}
          id={row.id}
          index={index}
          removeLabel={t("common.delete")}
          onRemove={() => removeAt(index)}
          typeSelect={
            <FormCardTypeSelect label={t("formTemplate.field.type")}>
              <FormSelect
                id={`item-type-${row.id}`}
                value={row.value.type}
                options={[
                  { value: "standard", label: t("formTemplate.type.standard") },
                  { value: "custom", label: t("formTemplate.type.custom") },
                ]}
                onChange={(type) =>
                  updateAt(index, (current) => ({ ...current, type: type as ItemRow["type"] }))
                }
              />
            </FormCardTypeSelect>
          }
        >
          <Field
            id={`item-label-${row.id}`}
            label={t("formTemplate.field.name")}
            required
            error={errors[`items.${index}.label`]}
          >
            <Input
              id={`item-label-${row.id}`}
              value={row.value.label}
              onChange={(event) =>
                updateAt(index, (current) => ({ ...current, label: event.target.value }))
              }
            />
          </Field>
        </FormListFieldCard>
      ))}
    </FormCollectionShell>
  );
}
```

`FormCollectionShell` renders the `FormAddAnotherButton` itself when `addLabel` + `onAdd` are
passed; `FormListFieldCard` renders the `CardRemoveButton` from `removeLabel`. Do not add a
second append control — the shell owns it.

---

## 2. Stable row identity

- Keys come from identity: `crypto.randomUUID()` at append time, or the server row id on
  hydrate. `useStableRowList` owns append/remove/move and carries the id with the value.
- Index keys (`key={index}`, `` key={`row-${i}`} ``) are banned: removing or reordering a row
  moves the value, the error, and the focus to a different input (`formCollectionKeys.test.ts`).
- Marker-derived blank rows that have no add/remove/reorder affordance are the only documented
  exception; the allowlist entry must carry the reason.
- Reordering a row must move the value, not swap two inputs' state.

---

## 3. Empty rows, stripping, and value coercion

The draft is not the payload. Normalize, then validate:

| Field shape | Draft value | Payload |
|---|---|---|
| optional text | `""` | `undefined` (or the schema's default) — never `"null"` |
| nullable text (schema allows null) | `""` | `null` |
| optional number | `""` | `undefined` |
| nullable number | `""` | `null` — never `0`, never `NaN` |
| money | `"12.50"` | decimal **string**, unrounded, no locale formatting |
| date | `""` | `undefined` / `null` per schema; validate with `isoDateSchema` / `isoDateOrEmptySchema` |
| optional repeatable row with every field blank | present in draft | stripped before submit |
| repeatable collection emptied by the user | `[]` | `[]` — authoritative clear, never omitted |

```ts
function toPayload(draft: ItemDraft): ItemWriteDto {
  return {
    name: draft.name.trim(),
    notes: draft.notes.trim() || undefined,
    amount: draft.amount === "" ? undefined : draft.amount,
    rows: draft.rows.filter((row) => row.label.trim().length > 0),
  };
}
```

Validate the normalized payload against the shared write schema — validating the raw draft lets
a blank optional row pass local validation and then fail (or silently store `""`) on the server.

---

## 4. Entity quick-create selector (`FormSelectWithQuickCreate`)

When an entity foreign key can be created without leaving the form:

```tsx
import { FormSelectWithQuickCreate } from "@/components/app/FormSelectWithQuickCreate";
import { useTranslation } from "@/hooks/useTranslation";

const { t } = useTranslation();

<FormSelectWithQuickCreate
  id="department"
  label={t("formTemplate.field.department")}
  value={selectedDepartmentId}
  options={departments.map((department) => ({
    value: department.id,
    label: department.name,
  }))}
  onChange={setSelectedDepartmentId}
  placeholder={t("formTemplate.placeholder.department")}
  canAdd={canWriteDepartments}
  onOpenAdd={() => setDepartmentModalOpen(true)}
  addAriaLabel={t("formTemplate.action.addDepartment")}
/>
```

Use it for entity-catalog FKs that already have a create `FormModal`; use `EditableSelect` for
string lookups, `ContactPicker` for people, and plain `FormSelect` for enums. Gate the Plus
affordance with the owning write permission.

---

## 5. Zod and API error mapping

1. Validate on blur or explicit submit — never while typing.
2. `mapZodFormErrors` (`@/lib/forms/mapZodFormErrors`) turns a `ZodError` into `field → message`.
3. `mapApiFormError` (`@/lib/forms/serverFormErrors`) turns a contract/domain rejection into
   `fieldErrors` + a form-level `message` + `isConflict`. Both use the same field keys.
4. Activate the tab containing the first invalid field before focusing it.
5. Close the modal only after `mutateAsync` resolved.

```tsx
import { useFormSubmission } from "@/lib/forms/useFormSubmission";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { translateValidationMessage } from "@/lib/forms/translateValidationMessage";
import { itemWriteSchema } from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";

const { t } = useTranslation();
const [errors, setErrors] = useState<Record<string, string>>({});

const { submitting, formError, submit } = useFormSubmission<ItemWriteDto>({
  save: onSave,
  onSuccess: onClose,
  onFieldErrors: setErrors,
  fallbackMessage: t("errors.state.generic"),
  conflictMessage: t("formTemplate.error.staleWrite"),
  // Zod/API messages are English at the boundary; the resolver localizes them.
  resolveMessage: (message) => translateValidationMessage(message, t),
});

async function handleSave(draft: ItemDraft) {
  const parsed = itemWriteSchema.safeParse(toPayload(draft));
  if (!parsed.success) {
    const fieldErrors = mapZodFormErrors(parsed.error, (message) =>
      translateValidationMessage(message, t),
    );
    setErrors(fieldErrors);

    const firstErrorKey = Object.keys(fieldErrors)[0] ?? "";
    setActiveTab(firstErrorKey.startsWith("guardian.") ? "guardian" : "general");
    return;
  }

  setErrors({});
  // One guarded path: double-submit safe, awaits the mutation + invalidators,
  // maps server field errors, and keeps the draft on failure.
  await submit(parsed.data);
}
```
