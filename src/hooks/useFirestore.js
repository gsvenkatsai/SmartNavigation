import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc,
  addDoc,
  setDoc,
  serverTimestamp,
  increment,
  writeBatch,
  getDocs
} from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * Hook for real-time Firestore collection data
 */
export function useFirestoreCollection(collectionName, orderField = "last_updated", desc = true) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const colRef = collection(db, collectionName);
    const q = query(colRef, orderBy(orderField, desc ? "desc" : "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error(`Error in useFirestoreCollection (${collectionName}):`, err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, orderField, desc]);

  return { data, loading, error };
}

/**
 * Hook for real-time Firestore document data
 */
export function useFirestoreDoc(collectionName, docId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docId) return;

    const docRef = doc(db, collectionName, docId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setData({ id: snapshot.id, ...snapshot.data() });
      } else {
        setData(null);
      }
      setLoading(false);
    }, (err) => {
      console.error(`Error in useFirestoreDoc (${collectionName}/${docId}):`, err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, docId]);

  return { data, loading, error };
}

/**
 * Helper for writing segment preference
 */
export async function writeSegmentPreference(segmentId, type = "prefer") {
  if (!segmentId) return;

  try {
    const segRef = doc(db, "segments", segmentId);
    await setDoc(
      segRef,
      {
        segment_id: segmentId,
        [type === "prefer" ? "prefer_count" : "avoid_count"]: increment(1),
        last_updated: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error writing segment preference:", error);
    throw error;
  }
}

/**
 * Utility to clear all community heatmap data for a fresh demo.
 */
export async function clearCommunityData() {
  try {
    const colRef = collection(db, "segments");
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("Community data cleared successfully");
  } catch (error) {
    console.error("Error clearing community data:", error);
    throw error;
  }
}
