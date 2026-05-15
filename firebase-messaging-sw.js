importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCoXPhysPJEfeTOFnJUK3ZHR0x66up3L6E",
  authDomain: "littleachievers.firebaseapp.com",
  projectId: "littleachievers",
  storageBucket: "littleachievers.firebasestorage.app",
  messagingSenderId: "811415959587",
  appId: "1:811415959587:web:b6c9911ba8e416ab685996",
  measurementId: "G-YLDS0L7EMF"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || "Little Achievers";

  const options = {
    body: payload.notification?.body || "Имате ново известие.",
    icon: "/logo.jpg",
    badge: "/logo.jpg",
    data: {
      url: payload.data?.url || "/panel.html"
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/panel.html";

  event.waitUntil(
    clients.openWindow(urlToOpen)
  );
});
