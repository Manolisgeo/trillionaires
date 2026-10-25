export async function register() {
  // Node-only code lives in its own module so the edge build never compiles dotenv / node:path.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
