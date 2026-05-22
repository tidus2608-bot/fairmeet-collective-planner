// FairMeet service worker — handles clicks on chat notifications.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes(url) && 'focus' in w) return w.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
