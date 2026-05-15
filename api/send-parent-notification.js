import admin from "firebase-admin";

function getServiceAccount() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64");
  }

  const json = Buffer
    .from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64")
    .toString("utf8");

  return JSON.parse(json);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount())
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const childId = req.body?.childId || "";
    const childCode = req.body?.childCode || "";
    const childName = req.body?.childName || "детето";
    const messageText = req.body?.messageText || "Имате ново съобщение.";

    if (!childId) {
      return res.status(400).json({ error: "Missing childId" });
    }

    const childRef = db.collection("children").doc(childId);
    const childSnap = await childRef.get();

    if (!childSnap.exists) {
      return res.status(404).json({ error: "Child not found" });
    }

    const child = childSnap.data();

    const tokens = Array.isArray(child.parentNotificationTokens)
      ? child.parentNotificationTokens.filter(Boolean)
      : [];

    if (!tokens.length) {
      return res.status(200).json({
        success: true,
        message: "No parent notification tokens saved yet"
      });
    }

    const shortText =
      messageText.length > 80
        ? messageText.substring(0, 80) + "..."
        : messageText;

    const pushMessage = {
      tokens: tokens,
      notification: {
        title: "Ново съобщение от Little Achievers",
        body: `${childName}: ${shortText}`
      },
      data: {
        url: `/status.html?code=${encodeURIComponent(childCode)}`,
        childCode: String(childCode),
        childName: String(childName)
      },
      webpush: {
        fcmOptions: {
          link: `https://little-achievers-learn.vercel.app/status.html?code=${encodeURIComponent(childCode)}`
        },
        notification: {
          icon: "/logo.jpg",
          badge: "/logo.jpg",
          requireInteraction: true
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(pushMessage);

    if (response.failureCount > 0) {
      const validTokens = [];

      response.responses.forEach((item, index) => {
        if (item.success) {
          validTokens.push(tokens[index]);
        }
      });

      await childRef.set({
        parentNotificationTokens: validTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return res.status(200).json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message
    });
  }
}