// One origin for the runner, Vite, Playwright and the deny-by-default mock router.
const rawPort = process.env.GPMS_BROWSER_PORT || "5187";
if (!/^\d+$/.test(rawPort))
  throw new Error("GPMS_BROWSER_PORT must be an integer.");
const browserPort = Number(rawPort);
if (browserPort < 1024 || browserPort > 65535 || browserPort === 5173)
  throw new Error(
    "Use a dedicated browser-test port (1024–65535, except 5173).",
  );
module.exports = {
  browserPort,
  browserOrigin: `http://127.0.0.1:${browserPort}`,
};
