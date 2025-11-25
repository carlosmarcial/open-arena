/**
 * UI overrides for model metadata.
 * Used to remap legacy Gemini entries to the new Mistral Medium 3.1 branding.
 */

type ModelLike = {
  name?: string | null;
  api_model?: string | null;
  color?: string | null;
  icon?: string | null;
  fallbackIcon?: string | null;
};

const MODEL_NAME_OVERRIDES = new Map<string, string>([
  ['gemini 2.5 pro', 'Mistral Medium 3.1'],
  ['gemini 2.0 flash exp', 'Mistral Medium 3.1'],
  ['gemini 2.0 flash', 'Mistral Medium 3.1'],
]);

const MODEL_API_OVERRIDE_ENTRIES: Array<[string, string]> = [
  ['google/gemini-2.5-pro', 'mistralai/mistral-medium-3.1'],
  ['google/gemini-2.0-flash-exp', 'mistralai/mistral-medium-3.1'],
  ['google/gemini-2.0-flash-exp:free', 'mistralai/mistral-medium-3.1'],
];

const MODEL_API_OVERRIDES = new Map<string, string>(
  MODEL_API_OVERRIDE_ENTRIES.map(([key, value]) => [key.toLowerCase(), value])
);

const MISTRAL_UI_PROPS = {
  color: '#0ea5e9',
  icon: '🌊',
  fallbackIcon: '🌊',
};

export function normalizeModelName(name?: string | null): string {
  if (!name) {
    return '';
  }
  const trimmed = name.trim();
  return MODEL_NAME_OVERRIDES.get(trimmed.toLowerCase()) ?? trimmed;
}

export function normalizeApiModel(apiModel?: string | null): string {
  if (!apiModel) {
    return '';
  }
  const trimmed = apiModel.trim();
  return MODEL_API_OVERRIDES.get(trimmed.toLowerCase()) ?? trimmed;
}

export function applyModelUIOverrides<T extends ModelLike>(model: T): T {
  const originalName = model.name ?? '';
  const originalApiModel = model.api_model ?? '';

  const normalizedName = normalizeModelName(originalName);
  const normalizedApiModel = normalizeApiModel(originalApiModel);

  const shouldOverrideName =
    normalizedName.length > 0 && normalizedName !== originalName.trim();
  const shouldOverrideApiModel =
    normalizedApiModel.length > 0 && normalizedApiModel !== originalApiModel.trim();

  if (!shouldOverrideName && !shouldOverrideApiModel) {
    return model;
  }

  return {
    ...model,
    ...(shouldOverrideName ? { name: normalizedName } : {}),
    ...(shouldOverrideApiModel ? { api_model: normalizedApiModel } : {}),
    ...MISTRAL_UI_PROPS,
  };
}

export function normalizeModelsArray<T extends ModelLike>(models: T[] | null | undefined): T[] {
  if (!models) {
    return [];
  }
  return models.map((model) => applyModelUIOverrides(model));
}
