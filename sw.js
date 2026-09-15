// ============================================================
// SERVICE WORKER - Notificações Push (Grupo CLIGED)
// Roda em segundo plano, independente da aba estar aberta.
// É quem recebe o push do sistema operacional e mostra a
// notificação, mesmo com a tela do celular bloqueada.
// ============================================================

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ------------------------------------------------------------
// Recebe o push e mostra a notificação do sistema
// ------------------------------------------------------------

self.addEventListener("push", (event) => {
  let dados = {};

  try {
    dados = event.data ? event.data.json() : {};
  } catch (error) {
    dados = {
      title: "Solicitação concluída ✅",
      body: event.data ? event.data.text() : "Sua solicitação foi finalizada."
    };
  }

  const titulo = dados.title || "Solicitação concluída ✅";

  const opcoes = {
    body: dados.body || "Sua solicitação foi finalizada.",
    icon: "logo.png",
    badge: "logo.png",
    vibrate: [200, 100, 200],
    data: { url: dados.url || "./" }
  };

  event.waitUntil(
    self.registration.showNotification(titulo, opcoes)
  );
});

// ------------------------------------------------------------
// Ao tocar na notificação, abre/foca a aba do sistema
// ------------------------------------------------------------

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "./";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
