export function restoreMutableExports<T extends Record<string, unknown>>(
  target: T,
  original: T,
): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, original);
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
