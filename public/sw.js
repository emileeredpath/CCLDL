// Never cache authenticated pages, API requests, or result photographs.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>CCLDL offline</title><body style="font-family:system-ui;padding:32px;background:#fff8fb"><h1>CCLDL</h1><p>You are offline. Reconnect to securely access league records.</p></body></html>',
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
      ),
    );
});
