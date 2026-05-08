import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // paste M2's config object here exactly
  apiKey: "placeholder-api-key",
  projectId: "placeholder-project-id",
  appId: "placeholder-app-id"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
