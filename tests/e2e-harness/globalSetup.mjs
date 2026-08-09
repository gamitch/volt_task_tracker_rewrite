/**
 * Fail the persona suite immediately, with instructions, if the backing
 * services are not running — rather than letting every spec time out on a
 * login form that can never succeed.
 */
const SHIM = 'http://127.0.0.1:54321/__harness/health';

export default async function globalSetup() {
  let response;
  try {
    response = await fetch(SHIM);
  } catch (cause) {
    throw new Error(
      `The Supabase-compatible harness is not reachable at ${SHIM}.\n` +
        'Start the backing services first:\n\n  bash tests/e2e-harness/start.sh\n\n' +
        `(underlying error: ${cause instanceof Error ? cause.message : String(cause)})`,
    );
  }
  if (!response.ok) {
    throw new Error(`Harness health check returned ${response.status} from ${SHIM}.`);
  }
}
