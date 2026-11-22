"use client";

import { useEffect, useState } from "react";

export interface AttemptRecord {
  quizId: number;
  title: string;
  skill: "reading" | "listening" | "writing" | "speaking";
  correct?: number;
  total?: number;
  band?: number;
  words?: number;
  durationSec: number;
  completedAt: string;
}

const STORAGE_KEY = "ielts_ledger_attempts_v1";

export function readAttempts(): AttemptRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAttempt(record: AttemptRecord) {
  if (typeof window === "undefined") return;
  const list = readAttempts();
  const next = [record, ...list.filter((x) => x.quizId !== record.quizId)].slice(0, 500);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("ielts-attempts-updated"));
}

export function useAttempts() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);

  useEffect(() => {
    setAttempts(readAttempts());
    const handler = () => setAttempts(readAttempts());
    window.addEventListener("ielts-attempts-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("ielts-attempts-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return attempts;
}
