function readFromRecord(source: Record<string, unknown> | undefined, names: string[]): string | undefined {
  if (!source) return undefined;

  for (const name of names) {
    const value = source[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

async function readCloudflareEnv(names: string[]): Promise<string | undefined> {
  try {
    const mod = (await import("cloudflare:workers")) as { env?: Record<string, unknown> };
    return readFromRecord(mod.env, names);
  } catch {
    return undefined;
  }
}

export async function readRuntimeSecret(names: string[]): Promise<string | undefined> {
  return (
    readFromRecord(process.env as Record<string, unknown>, names) ||
    (await readCloudflareEnv(names))
  );
}