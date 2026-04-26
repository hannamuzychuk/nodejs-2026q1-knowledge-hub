const SENSITIVE_FIELD_PATTERN = /(password|token|authorization)/i;

export const redactSensitiveData = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const output: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value as object)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
      continue;
    }

    output[key] = redactSensitiveData(nestedValue);
  }

  return output as T;
};
