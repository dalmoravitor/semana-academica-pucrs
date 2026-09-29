import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Flame,
  Sparkles,
  RefreshCw,
  User,
  Terminal,
  Play,
  AlertCircle,
  ArrowRight,
  Check,
  X,
  Eye,
  Clock,
} from "lucide-react";
import {
  fetchNextCard,
  submitGuess,
  fetchLeaderboard,
  savePlayerScore,
} from "./services/api";
import type { CardPublic, GuessResult, LeaderboardEntry } from "./services/api";
import { SwipeCard } from "./components/SwipeCard";

const TOTAL_ROUNDS = 10;
const TIME_LIMIT_SECONDS = 15;
const SPEED_BONUS_PER_SECOND = 5;
const BONUS_BASE = 25;
const BONUS_MULTIPLIER = 1.4;

const getStreakBonus = (currentStreak: number) =>
  currentStreak === 0 ? 0 : Math.round(BONUS_BASE * BONUS_MULTIPLIER ** (currentStreak - 1));

const createAnonymousParticipantId = () => {
  const randomPart = crypto.randomUUID?.().replaceAll("-", "").slice(0, 20)
    ?? `${Date.now()}${Math.random().toString(36).slice(2)}`.slice(0, 20);
  return `first-${randomPart}`;
};

const PARTICIPANT_ID_STORAGE_KEY = "real-ou-ia-participant-id";

const normalizePlayerName = (name: string) => name.trim().toLocaleLowerCase("pt-BR");

interface RoundReport {
  card: CardPublic;
  choice: "real" | "ai" | "timeout";
  result: GuessResult;
  speedBonus: number;
}

export default function App() {
  // Estados de navegação: "start" | "playing" | "game_over"
  const [gameState, setGameState] = useState<"start" | "playing" | "game_over">("start");
  const [playerName, setPlayerName] = useState<string>("");
  const [participantId, setParticipantId] = useState<string>("");
  const [isFirstTime, setIsFirstTime] = useState<boolean>(true);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Jogo
  const [currentCard, setCurrentCard] = useState<CardPublic | null>(null);
  const [playedIds, setPlayedIds] = useState<string[]>([]);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedChoice, setSelectedChoice] = useState<"real" | "ai" | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(TIME_LIMIT_SECONDS);
  const [roundReports, setRoundReports] = useState<RoundReport[]>([]);

  // Placar
  const [round, setRound] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingRanking, setLoadingRanking] = useState<boolean>(false);

  // Carregar Leaderboard
  const refreshLeaderboard = useCallback(async () => {
    setLoadingRanking(true);
    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data);
    } catch {
      // Backend pode estar iniciando
    } finally {
      setLoadingRanking(false);
    }
  }, []);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  // Carregar card
  const loadNext = useCallback(async (currentExcluded: string[]) => {
    setLoadingCard(true);
    setApiError(null);
    setSelectedChoice(null);
    try {
      const card = await fetchNextCard(currentExcluded);
      setCurrentCard(card);
      setPlayedIds((prev) => [...prev, card.id]);
    } catch (err: any) {
      setApiError(
        "Não foi possível conectar ao servidor (localhost:8000). Verifique se o backend está rodando no terminal com uvicorn."
      );
    } finally {
      setLoadingCard(false);
    }
  }, []);

  // Iniciar partida
  const startGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const normalizedName = normalizePlayerName(playerName);
    const knownName = leaderboard.some(
      (entry) => normalizePlayerName(entry.name) === normalizedName
    );
    if (!knownName && !isFirstTime) {
      setRegistrationError("Ainda não encontramos esse nome no ranking. Marque “É minha primeira vez jogando” para começar.");
      return;
    }
    setRegistrationError(null);

    const storedParticipantId = localStorage.getItem(PARTICIPANT_ID_STORAGE_KEY);
    const resolvedParticipantId = isFirstTime
      ? createAnonymousParticipantId()
      : storedParticipantId || createAnonymousParticipantId();

    localStorage.setItem(PARTICIPANT_ID_STORAGE_KEY, resolvedParticipantId);
    setParticipantId(resolvedParticipantId);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setRound(1);
    setPlayedIds([]);
    setRoundReports([]);
    setGameState("playing");
    loadNext([]);
  };

  // Reiniciar para novo jogador
  const handleResetToStart = () => {
    setPlayerName("");
    setParticipantId("");
    setIsFirstTime(true);
    setGameState("start");
    refreshLeaderboard();
  };

  const knownPlayerName = leaderboard.some(
    (entry) => normalizePlayerName(entry.name) === normalizePlayerName(playerName)
  );

  // Voto
  const handleChoice = async (choice: "real" | "ai", reportChoice: "real" | "ai" | "timeout" = choice) => {
    if (!currentCard || submitting || selectedChoice || gameState !== "playing") return;
    setSelectedChoice(choice);
    setSubmitting(true);

    try {
      const result = await submitGuess(currentCard.id, choice);
      const evaluatedResult = reportChoice === "timeout" ? { ...result, correct: false } : result;
      const speedBonus = evaluatedResult.correct ? timeLeft * SPEED_BONUS_PER_SECOND : 0;
      setRoundReports((prev) => [...prev, { card: currentCard, choice: reportChoice, result: evaluatedResult, speedBonus }]);

      const nextStreak = evaluatedResult.correct ? streak + 1 : 0;
      const nextBestStreak = evaluatedResult.correct ? Math.max(bestStreak, nextStreak) : bestStreak;
      const nextScore = evaluatedResult.correct ? score + 100 + getStreakBonus(streak) + speedBonus : score;

      if (evaluatedResult.correct) {
        const bonus = getStreakBonus(streak);
        setScore((prev) => prev + 100 + bonus + speedBonus);
        setStreak(nextStreak);
        setBestStreak(nextBestStreak);
      } else {
        setStreak(0);
      }

      await new Promise((r) => setTimeout(r, 1200));

      if (round >= TOTAL_ROUNDS) {
        // Salva a pontuação automaticamente no SQLite
        try {
          const savedScore = await savePlayerScore(
            playerName.trim(),
            participantId.trim(),
            nextScore,
            nextBestStreak,
            isFirstTime,
          );
          setPlayerName(savedScore.name);
          await refreshLeaderboard();
        } catch (saveErr) {
          console.error("Erro ao salvar pontuação:", saveErr);
        }
        setGameState("game_over");
      } else {
        setRound((prev) => prev + 1);
        await loadNext(playedIds);
      }
    } catch {
      setApiError("Erro ao enviar palpite ao servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (gameState !== "playing" || !currentCard || loadingCard || submitting || selectedChoice) return;

    setTimeLeft(TIME_LIMIT_SECONDS);
    const intervalId = window.setInterval(() => {
      setTimeLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);
    const timeoutId = window.setTimeout(() => {
      void handleChoice("real", "timeout");
    }, TIME_LIMIT_SECONDS * 1000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [currentCard?.id, gameState, loadingCard, submitting, selectedChoice]);

  // Atalhos de teclado (Setas ou A/D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== "playing" || submitting || selectedChoice) return;
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        handleChoice("ai");
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        handleChoice("real");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState, currentCard, submitting, selectedChoice, streak]);

  return (
    <div className="app-shell flex flex-col min-h-screen max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 justify-between select-none">
      {/* ========================================================================= */}
      {/* 1. TELA DE REGISTRO E BOAS-VINDAS (START)                                 */}
      {/* ========================================================================= */}
      {gameState === "start" && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="start-screen flex-1 flex flex-col items-center justify-center gap-6"
        >
          <div className="start-layout w-full">
            <div className="start-primary flex flex-col items-center lg:items-start">
              <div className="start-copy text-center lg:text-left">
                <span className="inline-block px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs font-mono text-zinc-400 mb-3">
                  Semana Acadêmica • PUCRS
                </span>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Real ou IA?
                </h1>
                <p className="text-lg text-zinc-400 mt-2 max-w-md mx-auto lg:mx-0">
                  Teste seu olhar contra modelos generativos modernos. Faça 10 escolhas e dispute o topo do ranking.
                </p>
              </div>

              <form
                onSubmit={startGame}
                className="start-form mt-8 w-full max-w-sm flex flex-col gap-3 bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-md"
              >
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" /> Como podemos chamar você?
                </label>
                <input
                  type="text"
                  required
                  maxLength={20}
                  value={playerName}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    const isKnown = leaderboard.some(
                      (entry) => normalizePlayerName(entry.name) === normalizePlayerName(nextName)
                    );
                    setPlayerName(nextName);
                    setIsFirstTime(!nextName.trim() || !isKnown);
                    setRegistrationError(null);
                  }}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 transition"
                  autoFocus
                />
                <label className="flex items-start gap-2 mt-1 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isFirstTime}
                onChange={(e) => {
                  setIsFirstTime(e.target.checked);
                  setRegistrationError(null);
                  if (e.target.checked) setParticipantId("");
                }}
                className="mt-0.5 accent-cyan-400"
              />
              <span>
                <strong className="font-semibold text-zinc-200">É minha primeira vez jogando</strong>
                <span className="block mt-1 text-[11px] leading-4 text-zinc-500">
                  {knownPlayerName
                    ? "Desmarque para continuar de onde você parou."
                    : "Vamos criar seu histórico automaticamente, sem pedir matrícula."}
                </span>
              </span>
                </label>
                {registrationError && (
                  <p className="text-xs leading-4 text-rose-300 bg-rose-950/40 border border-rose-900/70 rounded-xl px-3 py-2">
                    {registrationError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!playerName.trim()}
                  className="w-full py-3 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  <Play className="w-4 h-4 fill-zinc-950" /> Iniciar Desafio
                </button>
              </form>
            </div>

            {/* Leaderboard completo na entrada */}
            <div className="start-leaderboard w-full bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs font-bold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" /> Ranking completo
              </span>
              <button
                onClick={refreshLeaderboard}
                title="Atualizar"
                className="text-zinc-500 hover:text-zinc-300"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRanking ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="leaderboard-scroll divide-y divide-zinc-800/50">
              {leaderboard.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-3">Nenhum jogador registrado ainda.</p>
              ) : (
                leaderboard.map((entry, index) => (
                  <div key={index} className="flex justify-between items-center py-2 text-xs">
                    <span className="text-zinc-300 font-medium">
                      <strong className="text-zinc-500 mr-2">#{index + 1}</strong>
                      {entry.name}
                    </span>
                    <span className="font-mono text-zinc-100 font-bold">
                      {entry.score.toLocaleString("pt-BR")} pts
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 2. TELA DO JOGO (PLAYING)                                                 */}
      {/* ========================================================================= */}
      {gameState === "playing" && (
        <>
          {/* Header Superior */}
          <header className="game-header flex items-center justify-between bg-zinc-900/70 border border-zinc-800 px-5 py-3 rounded-2xl backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-zinc-100">{score.toLocaleString("pt-BR")} pts</span>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-zinc-800/60 rounded-full text-zinc-300 border border-zinc-700/50">
              {playerName} • {round} de {TOTAL_ROUNDS}
            </span>
            <div className={`flex items-center gap-1.5 text-xs font-bold font-mono ${timeLeft <= 5 ? "text-rose-400" : "text-cyan-300"}`}>
              <Clock className="w-4 h-4" />
              <span>{timeLeft}s</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className={`w-4 h-4 ${streak > 0 ? "text-orange-400 fill-orange-400" : "text-zinc-600"}`} />
              <span className="text-xs font-bold text-orange-400 font-mono">{streak}x</span>
            </div>
          </header>

          {/* Área Central / Card */}
          <main className="relative flex-1 flex flex-col items-center justify-center my-4">
            {apiError ? (
              <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-6 text-center max-w-md">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-rose-200">Falha de Comunicação</h3>
                <p className="text-xs text-rose-300 mt-1 leading-relaxed">{apiError}</p>
                <button
                  onClick={() => loadNext(playedIds)}
                  className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : loadingCard ? (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                <span className="text-xs text-zinc-500 font-medium">Carregando imagem...</span>
              </div>
            ) : currentCard ? (
              <div className="game-layout w-full">
                <div className="card-column relative w-full">
                  <SwipeCard
                    card={currentCard}
                    onSwipe={handleChoice}
                    disabled={submitting}
                    decision={selectedChoice}
                  />
                </div>

                <div className="game-info flex flex-col justify-center text-left">
                  <h1 className="mt-3 text-xl sm:text-2xl font-black tracking-tight text-white">É real ou IA?</h1>
                  <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
                    Analise a imagem, leia o possível prompt e descubra se ela nasceu de uma câmera ou de um modelo generativo.
                  </p>

                  <div className="prompt-panel mt-8 w-full rounded-2xl bg-zinc-900/70 border border-zinc-800 p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 text-zinc-200">
                        <Terminal className="w-4 h-4 text-cyan-300" />
                        <span className="text-xs font-bold uppercase tracking-[0.18em]">Possível prompt</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">ANÁLISE #{round.toString().padStart(2, "0")}</span>
                    </div>
                    <p className="text-sm leading-6 text-zinc-300">{currentCard.prompt}</p>
                    <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center gap-2 text-[11px] text-zinc-500">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Observe textura, luz, anatomia e perspectiva.</span>
                    </div>
                  </div>

                  <div className="game-actions mt-8 flex items-center gap-4">
                    <button
                      onClick={() => handleChoice("ai")}
                      disabled={submitting || loadingCard}
                      className="flex flex-1 flex-col items-center justify-center h-16 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-rose-500 hover:bg-rose-500/10 text-zinc-300 hover:text-rose-400 transition active:scale-95 disabled:opacity-30 shadow-md group"
                    >
                      <span className="text-base font-bold">IA</span>
                      <span className="text-[9px] font-mono text-zinc-500 group-hover:text-rose-400">[ ← ]</span>
                    </button>
                    <button
                      onClick={() => handleChoice("real")}
                      disabled={submitting || loadingCard}
                      className="flex flex-1 flex-col items-center justify-center h-16 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500 hover:bg-emerald-500/10 text-zinc-300 hover:text-emerald-400 transition active:scale-95 disabled:opacity-30 shadow-md group"
                    >
                      <span className="text-base font-bold">Real</span>
                      <span className="text-[9px] font-mono text-zinc-500 group-hover:text-emerald-400">[ → ]</span>
                    </button>
                  </div>
                  <span className="mt-3 text-[11px] text-zinc-500">Arraste o card ou escolha uma das respostas</span>
                </div>
              </div>
            ) : null}
          </main>

        </>
      )}

      {/* ========================================================================= */}
      {/* 3. TELA DE RESULTADOS & LEADERBOARD COMPLETO (GAME OVER)                  */}
      {/* ========================================================================= */}
      {gameState === "game_over" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="results-shell flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto w-full"
        >
          <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Desafio Concluído!
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Parabéns, {playerName}!
            </h2>
            <p className="text-3xl font-black text-amber-400 mt-2 font-mono">
              {score.toLocaleString("pt-BR")}{" "}
              <span className="text-sm font-normal text-zinc-400">pontos</span>
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Maior sequência: <strong className="text-zinc-200">{bestStreak} acertos seguidos</strong>
            </p>

            <div className="report-grid mt-8 text-left">
              <section className="report-panel border border-zinc-800 rounded-2xl bg-zinc-900/75 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-300">Seu relatório</p>
                    <p className="text-[11px] text-zinc-500 mt-1">O gabarito completo das suas escolhas</p>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">{roundReports.length}/{TOTAL_ROUNDS}</span>
                </div>
                <div className="divide-y divide-zinc-800/60 max-h-[29rem] overflow-y-auto">
                  {roundReports.map((item, idx) => (
                    <article key={`${item.card.id}-${idx}`} className="p-4">
                      <div className="flex items-start gap-3">
                        <img src={item.card.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-zinc-700" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono text-zinc-500">ITEM {String(idx + 1).padStart(2, "0")}</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${item.result.correct ? "text-emerald-400" : "text-rose-400"}`}>
                              {item.result.correct ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              {item.result.correct ? "Acerto" : "Erro"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-200 mt-1 truncate">{item.result.subject}</p>
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Você: {item.choice === "timeout" ? "Tempo esgotado" : item.choice === "ai" ? "IA" : "Real"} · Gabarito: {item.result.is_ai ? "IA" : "Real"}
                            {item.speedBonus > 0 && ` · +${item.speedBonus} velocidade`}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs leading-5 text-zinc-400 mt-3">{item.result.explanation}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="report-panel border border-zinc-800 rounded-2xl bg-zinc-950/60 overflow-hidden text-left">
                <div className="px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 flex justify-between text-xs font-bold text-zinc-400">
                  <span>Leaderboard da Semana</span>
                  <span>Pontos</span>
                </div>
                <div className="leaderboard-scroll divide-y divide-zinc-800/40">
                  {leaderboard.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-4 py-2.5 text-xs ${
                        item.name === playerName.trim() && item.participant_id === participantId.trim()
                          ? "bg-amber-400/10 text-amber-300 font-bold"
                          : "text-zinc-300"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-zinc-500 font-mono w-4">#{idx + 1}</span>
                        {item.name}
                      </span>
                      <span className="font-mono text-zinc-100">{item.score.toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <button
              onClick={handleResetToStart}
              className="mt-6 w-full py-3.5 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 active:scale-95 shadow-md"
            >
              Próximo Jogador <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}