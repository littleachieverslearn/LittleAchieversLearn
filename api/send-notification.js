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
    const childName = req.body?.childName || "Ново дете";
    const birthDate = req.body?.birthDate || "";
    const childCode = req.body?.childCode || "";

    const title = req.body?.title || "Ново записано дете";
    const body = req.body?.body || `${childName} | Код: ${childCode}`;

    const snapshot = await db
      .collection("notificationTokens")
      .where("active", "==", true)
      .get();

    const tokens = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    if (!tokens.length) {
      return res.status(200).json({
        success: true,
        message: "No saved admin tokens"
      });
    }

    const pushMessage = {
      tokens: tokens,
      notification: {
        title: title,
        body: body
      },
      data: {
        url: "/panel.html",
        childName: String(childName),
        birthDate: String(birthDate),
        childCode: String(childCode)
      },
      webpush: {
        fcmOptions: {
          link: "https://little-achievers-learn.vercel.app/panel.html"
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
      const batch = db.batch();

      response.responses.forEach((item, index) => {
        if (!item.success) {
          const tokenRef = db.collection("notificationTokens").doc(tokens[index]);

          batch.set(tokenRef, {
            active: false,
            error: item.error?.message || "Unknown error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      });

      await batch.commit();
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