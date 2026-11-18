// Test-only helpers for environment variables.
//
// With Next.js types, NodeJS.ProcessEnv requires NODE_ENV and marks it
// read-only. Tests pass partial env objects and switch NODE_ENV on purpose;
// these helpers make that type-correct without changing what the code under
// test receives: no variable is added, renamed or defaulted.

/** Types a partial set of variables as an env object, exactly as given. */
export function testEnv(vars: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

/** Sets (or clears, with undefined) process.env.NODE_ENV for the current test. */
export function setTestNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}
