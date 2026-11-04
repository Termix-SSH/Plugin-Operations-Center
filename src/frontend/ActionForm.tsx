import { useTranslation } from "@termix-ssh/plugin-sdk/frontend";
import {
  Field,
  Input,
  PasswordInput,
  Select2,
  Switch,
  Textarea,
} from "@termix-ssh/plugin-sdk/ui";
import type { CatalogField } from "./api";

export type FormValues = Record<string, unknown>;

/** Starting values from each field's default. */
export function initialValues(fields: CatalogField[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.default !== undefined) values[field.key] = field.default;
  }
  return values;
}

/** Drops empty values, so the gate fills defaults and checks required ones. */
export function cleanValues(values: FormValues): FormValues {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );
}

/** Draws an action's inputs from its declaration. Core checks them again. */
export function ActionForm({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: CatalogField[];
  values: FormValues;
  onChange: (next: FormValues) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const set = (key: string, value: unknown) =>
    onChange({ ...values, [key]: value });

  const visible = fields.filter(
    (field) => !field.requires || values[field.requires] === true,
  );
  if (visible.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("form.noInputs")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.map((field) => {
        const id = `op-field-${field.key}`;
        const value = values[field.key];
        const label = field.required ? `${field.label} *` : field.label;
        let control;
        switch (field.type) {
          case "boolean":
            control = (
              <Switch
                id={id}
                checked={value === true}
                disabled={disabled}
                onCheckedChange={(checked) => set(field.key, checked)}
              />
            );
            break;
          case "select":
            control = (
              <Select2
                id={id}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onChange={(event) => set(field.key, event.target.value)}
                placeholder={field.placeholder ?? t("form.choose")}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {field.optionLabels?.[option.value] ?? option.value}
                  </option>
                ))}
              </Select2>
            );
            break;
          case "number":
            control = (
              <Input
                id={id}
                type="number"
                min={field.min}
                max={field.max}
                value={value === undefined ? "" : String(value)}
                disabled={disabled}
                placeholder={field.placeholder}
                onChange={(event) => set(field.key, event.target.value)}
              />
            );
            break;
          case "secret":
            control = (
              <PasswordInput
                id={id}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onChange={(event) => set(field.key, event.target.value)}
              />
            );
            break;
          case "textarea":
          case "json":
            control = (
              <Textarea
                id={id}
                rows={field.type === "json" ? 6 : 4}
                className="font-mono text-xs"
                value={
                  typeof value === "string"
                    ? value
                    : value === undefined
                      ? ""
                      : JSON.stringify(value, null, 2)
                }
                disabled={disabled}
                placeholder={field.placeholder}
                onChange={(event) => set(field.key, event.target.value)}
              />
            );
            break;
          case "multiselect":
            control = (
              <Input
                id={id}
                value={Array.isArray(value) ? value.join(", ") : ""}
                disabled={disabled}
                placeholder={t("form.commaList")}
                onChange={(event) =>
                  set(
                    field.key,
                    event.target.value
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean),
                  )
                }
              />
            );
            break;
          default:
            control = (
              <Input
                id={id}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                placeholder={field.placeholder}
                onChange={(event) => set(field.key, event.target.value)}
              />
            );
        }
        return (
          <Field
            key={field.key}
            label={label}
            hint={field.description}
            htmlFor={id}
          >
            {control}
          </Field>
        );
      })}
    </div>
  );
}
