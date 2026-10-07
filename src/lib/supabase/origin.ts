export function applicationOrigin(request: Request) {
  const target = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url);
  const loopback = ["localhost", "127.0.0.1"];
  if (target.protocol === "http:" && loopback.includes(target.hostname)) {
    const host = request.headers.get("host");
    if (host) {
      try {
        const incoming = new URL(`http://${host}`);
        if (
          loopback.includes(incoming.hostname) &&
          incoming.port === target.port
        )
          return incoming.origin;
      } catch {
        /* Fall back to the configured origin. */
      }
    }
  }
  return target.origin;
}
