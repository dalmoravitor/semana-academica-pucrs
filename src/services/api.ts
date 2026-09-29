const DEFAULT_API_URL = import.meta.env.PROD
  ? "https://semana-academica-api.onrender.com"
  : "http://localhost:8000";
const BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

export interface CardPublic {
  id: string;
  imageUrl: string;
  category: "wildlife" | "architecture";
  prompt: string;
}

export interface GuessResult {
  correct: boolean;
  is_ai: boolean;
  subject: string;
  explanation: string;
}

export interface LeaderboardEntry {
  name: string;
  participant_id: string;
  score: number;
  streak: number;
}

function normalizeCardImageUrl(card: CardPublic): CardPublic {
  return card.imageUrl.startsWith("/")
    ? { ...card, imageUrl: `${BASE_URL}${card.imageUrl}` }
    : card;
}

export async function fetchNextCard(excludedIds: string[] = []): Promise<CardPublic> {
  const query = excludedIds.length > 0 ? `?exclude=${excludedIds.join(",")}` : "";
  const res = await fetch(`${BASE_URL}/api/cards/next${query}`);
  if (!res.ok) {
    throw new Error("Erro ao obter o próximo desafio.");
  }
  return normalizeCardImageUrl(await res.json());
}

export async function submitGuess(cardId: string, choice: "real" | "ai"): Promise<GuessResult> {
  const res = await fetch(`${BASE_URL}/api/cards/${cardId}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice }),
  });
  if (!res.ok) {
    throw new Error("Erro ao validar o palpite.");
  }
  return res.json();
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE_URL}/api/leaderboard`);
  if (!res.ok) {
    throw new Error("Erro ao carregar ranking.");
  }
  return res.json();
}

export interface SavedScore {
  name: string;
  participant_id: string;
}

export async function savePlayerScore(
  name: string,
  participantId: string,
  score: number,
  streak: number,
  firstTime: boolean,
): Promise<SavedScore> {
  const res = await fetch(`${BASE_URL}/api/leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, participant_id: participantId, score, streak, first_time: firstTime }),
  });
  if (!res.ok) {
    throw new Error("Erro ao salvar pontuação no leaderboard.");
  }
  return res.json();
}