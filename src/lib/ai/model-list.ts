export interface ModelListItem {
  id: string;
}

export interface ModelListPayload {
  models: ModelListItem[];
  error?: string;
}

function normalizeModels(models: unknown): ModelListItem[] {
  if (!Array.isArray(models)) return [];
  return models
    .map((model) => {
      if (typeof model === 'string') return { id: model };
      if (model && typeof model === 'object' && typeof (model as { id?: unknown }).id === 'string') {
        return { id: (model as { id: string }).id };
      }
      return null;
    })
    .filter((model): model is ModelListItem => Boolean(model?.id));
}

function getPayloadError(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return undefined;
}

export function normalizeModelListPayload(payload: unknown): ModelListPayload {
  if (!payload || typeof payload !== 'object') return { models: [] };
  const error = getPayloadError(payload);
  return {
    models: normalizeModels((payload as { models?: unknown }).models),
    ...(error ? { error } : {}),
  };
}

export async function readModelListResponse(response: Response, fallbackError: string): Promise<ModelListPayload> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const normalized = normalizeModelListPayload(payload);
  if (!response.ok && !normalized.error) {
    normalized.error = `${fallbackError} (${response.status})`;
  }
  return normalized;
}

export function getModelListFetchError(error: unknown, fallbackError: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallbackError;
}
