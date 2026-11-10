import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type Kind = "memory" | "person" | "reminder";
export type Fields = {
  kind: Kind;
  title: string;
  note: string;
  photo: string;
  time: string;
  doneDay: string;
};
export type Entry = Fields & { id: string; createdAt: number };

function entries(userId: string) {
  if (!db) throw new Error("Connect Firebase first.");
  return collection(db, "users", userId, "entries");
}

export async function loadEntries(userId: string) {
  const result = await getDocs(
    query(entries(userId), orderBy("createdAt", "desc")),
  );
  return result.docs.map((item) => ({ ...item.data(), id: item.id }) as Entry);
}

export async function saveEntry(userId: string, fields: Fields, id?: string) {
  if (id) await updateDoc(doc(entries(userId), id), fields);
  else await addDoc(entries(userId), { ...fields, createdAt: Date.now() });
}

export async function deleteEntry(userId: string, id: string) {
  await deleteDoc(doc(entries(userId), id));
}

export async function setReminderDay(userId: string, id: string, day: string) {
  await updateDoc(doc(entries(userId), id), { doneDay: day });
}
