// Custom service worker logic (next-pwa generates sw.js automatically).
// Add custom push notification or background sync handlers here.

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "EnjoyYourScan", {
      body: data.body ?? "",
      icon: "/icons/icon-192x192.png",
    })
  );
});
