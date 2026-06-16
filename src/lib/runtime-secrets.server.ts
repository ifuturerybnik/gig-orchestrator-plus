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

function readFromGlobalRuntimeEnv(names: string[]): string | undefined {
  const runtimeEnv = (globalThis as typeof globalThis & {
    __CONCERTIVO_RUNTIME_ENV__?: Record<string, unknown>;
  }).__CONCERTIVO_RUNTIME_ENV__;

  return readFromRecord(runtimeEnv, names);
}

async function readFromCloudflareEnv(names: string[]): Promise<string | undefined> {
  try {
    const mod = await import(/* @vite-ignore */ "cloudflare:workers");
    return readFromRecord((mod as { env?: Record<string, unknown> }).env, names);
  } catch {
    return undefined;
  }
}

export async function readRuntimeSecret(names: string[]): Promise<string | undefined> {
  return (
    readFromRecord(process.env as Record<string, unknown>, names) ||
    readFromGlobalRuntimeEnv(names) ||
    (await readFromCloudflareEnv(names))
  );
}