const admin = require("firebase-admin");

// Initialize Firebase Admin SDK with your service account
admin.initializeApp({
  credential: admin.credential.cert(require("../backend/service-account.json")), // Updated path
});
const db = admin.firestore();

async function migrateLikeCount() {
  const postsRef = db.collection("posts");
  const snapshot = await postsRef.get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.LikeCount !== undefined) {
      console.log(`Migrating doc ${doc.id}`);
      await doc.ref.update({
        like_count: data.LikeCount,
        LikeCount: admin.firestore.FieldValue.delete(),
      });
      console.log(`Migrated doc ${doc.id}`);
    }
  }
  console.log("Migration complete");
}

migrateLikeCount().catch(console.error);