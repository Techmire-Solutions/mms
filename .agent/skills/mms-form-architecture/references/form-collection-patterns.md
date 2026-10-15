# Form Collection Patterns & Control Recipes

This guide documents the implementation standards for form controls, repeatable collection rows, entity quick-create selectors, and Zod error mapping in MMS.

---

## 1. Repeatable Collection Rows Pattern

All repeatable collections (contacts, journal lines, Wakala distributions, fee schedules, question bank options/citations) must use the standardized triad:
- `FormCollectionShell` (outer wrapper, empty-state, and add button)
- `FormListFieldCard` (individual row container with primary stripe default)
- `FormCardTypeSelect` (discriminative row-header selector, if rows vary by type)
- `CardRemoveButton` / `FormAddAnotherButton`

### Example Implementation

```tsx
import {
  FormCollectionShell,
  FormListFieldCard,
  FormAddAnotherButton,
  FormCardTypeSelect,
} from "@/components/app/FormPrimitives";
import { Input } from "@shared/ui";

interface ItemRow {
  id: string;
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
  const handleAdd = () => {
    onChange([
      ...items,
      { id: crypto.randomUUID(), type: "standard", label: "" },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, patch: Partial<ItemRow>) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  return (
    <FormCollectionShell
      title="Items"
      addLabel="Add Item"
      onAdd={handleAdd}
      allowAdd={true}
    >
      {items.map((item, index) => (
        <FormListFieldCard
          key={item.id}
          onRemove={() => handleRemove(index)}
          typeSelect={
            <FormCardTypeSelect
              value={item.type}
              options={[
                { value: "standard", label: "Standard" },
                { value: "custom", label: "Custom" },
              ]}
              onChange={(type) =>
                handleUpdate(index, { type: type as ItemRow["type"] })
              }
            />
          }
        >
          <div className="space-y-2">
            <Input
              value={item.label}
              onChange={(e) => handleUpdate(index, { label: e.target.value })}
              placeholder="Item label..."
              aria-invalid={Boolean(errors[`items.${index}.label`])}
            />
            {errors[`items.${index}.label`] && (
              <p className="text-xs text-rose-500">
                {errors[`items.${index}.label`]}
              </p>
            )}
          </div>
        </FormListFieldCard>
      ))}
    </FormCollectionShell>
  );
}
```

---

## 2. Entity Quick-Create Selector (`FormSelectWithQuickCreate`)

When an entity foreign key can be created on-the-fly without leaving the form:

```tsx
import { FormSelectWithQuickCreate } from "@/components/app/FormSelectWithQuickCreate";

<FormSelectWithQuickCreate
  label="Department"
  value={selectedDepartmentId}
  options={departments.map((d) => ({ value: d.id, label: d.name }))}
  onChange={setSelectedDepartmentId}
  onCreateNew={() => setDepartmentModalOpen(true)}
  createButtonLabel="Add Department"
  placeholder="Select department..."
/>
```

---

## 3. Zod Error Mapping & Tab Focusing

When validating against shared Zod write schemas:
1. Validate on blur or explicit submit attempt (never while typing).
2. Use `mapZodFormErrors` from `apps/frontend/src/lib/forms/mapZodFormErrors.ts` to transform `ZodError` into a flat key-value dictionary.
3. Automatically activate the tab containing the first invalid field before shifting focus.

```tsx
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { studentWriteDtoSchema } from "@mms/shared";

function handleSave() {
  const result = studentWriteDtoSchema.safeParse(draft);
  if (!result.success) {
    const fieldErrors = mapZodFormErrors(result.error, (msg) => t(msg));
    setErrors(fieldErrors);

    // Switch to first tab with an error
    const firstErrorKey = Object.keys(fieldErrors)[0];
    if (firstErrorKey.startsWith("guardian.")) {
      setActiveTab("guardian");
    } else {
      setActiveTab("general");
    }
    return;
  }
  
  // Proceed with mutation
  mutateAsync(result.data);
}
```
