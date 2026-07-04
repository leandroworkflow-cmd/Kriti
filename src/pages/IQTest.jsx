import { db } from "@/lib/db";
import React, { useState, useEffect, useCallback, useRef } from "react";

import { Brain, Clock, CheckCircle, XCircle, Loader2, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const TOTAL_QUESTIONS = 30;
const TIME_PER_QUESTION = 12;
const PASS_THRESHOLD = 18; // 60% to pass
const MAX_ATTEMPTS = 2;

// Retorna a chave do mês-calendário atual, ex: "2026-07"
const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Quantos dias faltam até o dia 1 do próximo mês
const getDaysUntilNextMonth = () => {
  const now = new Date();
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((firstOfNextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export default function IQTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("checking"); // checking, locked, intro, loading, test, result
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [profile, setProfile] = useState(null);
  const [daysUntilRetry, setDaysUntilRetry] = useState(0);
  const timerRef = useRef(null);
  const questionStartRef = useRef(null);

  // Ao carregar a página, verifica se o usuário já esgotou as tentativas do mês corrente
  useEffect(() => {
    const checkAttempts = async () => {
      try {
        const me = await db.auth.me();
        const existing = await db.entities.UserProfile.filter({ user_id: me.id });
        const currentProfile = existing[0] || null;
        setProfile(currentProfile);

        const currentMonthKey = getCurrentMonthKey();
        if (currentProfile?.test_window_started_at === currentMonthKey) {
          const attempts = currentProfile.test_attempts || 0;
          if (attempts >= MAX_ATTEMPTS) {
            setDaysUntilRetry(getDaysUntilNextMonth());
            setPhase("locked");
            return;
          }
        }
        setPhase("intro");
      } catch (e) {
        console.error(e);
        setPhase("intro");
      }
    };
    checkAttempts();
  }, []);

  const fetchQuestions = useCallback(async (batchIndex) => {
    const categories = ["lógica", "matemática", "padrões visuais", "raciocínio verbal", "sequências numéricas", "analogias", "interpretação"];
    const randomCats = categories.sort(() => Math.random() - 0.5).slice(0, 3).join(", ");
    
    const res = await db.integrations.Core.InvokeLLM({
      prompt: `Gere 10 perguntas de QI únicas e desafiadoras em português brasileiro. 
As perguntas devem cobrir: ${randomCats}.
Cada pergunta deve ser respondível em 5 segundos por alguém inteligente.
As perguntas devem ser DIFERENTES a cada vez - use números, palavras e padrões aleatórios.
Misture dificuldades: 3 fáceis, 4 médias, 3 difíceis.
Timestamp de aleatoriedade: ${Date.now()}-${Math.random()}`,
      response_json_schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct_index: { type: "number" }
              }
            }
          }
        }
      }
    });
    return res.questions;
  }, []);

  const startTest = async () => {
    setPhase("loading");
    setLoading(true);
    try {
      const batch1 = await fetchQuestions(0);
      setQuestions(batch1);
      setPhase("test");
      setCurrentIndex(0);
      setTimeLeft(TIME_PER_QUESTION);
      questionStartRef.current = Date.now();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Load next batch when reaching question 7
  useEffect(() => {
    if (currentIndex === 7 && questions.length <= 10 && !loadingBatch) {
      setLoadingBatch(true);
      fetchQuestions(1).then(batch => {
        setQuestions(prev => [...prev, ...batch]);
        setLoadingBatch(false);
      });
    }
    if (currentIndex === 17 && questions.length <= 20 && !loadingBatch) {
      setLoadingBatch(true);
      fetchQuestions(2).then(batch => {
        setQuestions(prev => [...prev, ...batch]);
        setLoadingBatch(false);
      });
    }
  }, [currentIndex]);

  // Timer
  useEffect(() => {
    if (phase !== "test") return;
    questionStartRef.current = Date.now();
    setTimeLeft(TIME_PER_QUESTION);
    setSelectedAnswer(null);

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - questionStartRef.current) / 1000;
      const remaining = TIME_PER_QUESTION - elapsed;
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        moveToNext(false);
      } else {
        setTimeLeft(remaining);
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [currentIndex, phase]);

  const moveToNext = (correct) => {
    clearInterval(timerRef.current);
    if (correct) setScore(prev => prev + 1);
    
    if (currentIndex + 1 >= TOTAL_QUESTIONS) {
      const finalScore = correct ? score + 1 : score;
      finishTest(finalScore);
    } else {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Wait for questions to load
        const waitInterval = setInterval(() => {
          if (questions.length > currentIndex + 1) {
            clearInterval(waitInterval);
            setCurrentIndex(prev => prev + 1);
          }
        }, 100);
      }
    }
  };

  const handleAnswer = (index) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    const isCorrect = index === questions[currentIndex].correct_index;
    setTimeout(() => moveToNext(isCorrect), 300);
  };

  const finishTest = async (finalScore) => {
    setPhase("result");
    const passed = finalScore >= PASS_THRESHOLD;
    const iqEstimate = Math.round(70 + (finalScore / TOTAL_QUESTIONS) * 80);

    try {
      const me = await db.auth.me();
      const existing = await db.entities.UserProfile.filter({ user_id: me.id });
      const currentProfile = existing[0] || null;
      const currentMonthKey = getCurrentMonthKey();

      // Se ainda estamos no mesmo mês-calendário da última tentativa, soma; senão, reinicia a contagem
      const sameMonth = currentProfile?.test_window_started_at === currentMonthKey;
      const attempts = sameMonth ? (currentProfile.test_attempts || 0) + 1 : 1;

      const payload = {
        iq_score: iqEstimate,
        test_passed: passed,
        test_taken_at: new Date().toISOString(),
        test_attempts: attempts,
        test_window_started_at: currentMonthKey,
      };

      if (currentProfile) {
        await db.entities.UserProfile.update(currentProfile.id, payload);
      } else {
        await db.entities.UserProfile.create({
          user_id: me.id,
          display_name: me.full_name || me.email.split("@")[0],
          username: me.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
          ...payload
        });
      }

      setProfile({ ...currentProfile, ...payload });
    } catch (e) {
      console.error(e);
    }
  };

  if (phase === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "locked") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full bg-card rounded-2xl border border-border p-8 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Limite de tentativas atingido</h2>
          <p className="text-muted-foreground mb-6">
            Você já usou suas {MAX_ATTEMPTS} tentativas deste mês. Novas tentativas liberam em{" "}
            <strong>{daysUntilRetry} {daysUntilRetry === 1 ? "dia" : "dias"}</strong> (dia 1 do próximo mês).
          </p>
          <Button
            onClick={() => db.auth.logout("/")}
            variant="outline"
            className="w-full h-12"
          >
            Sair
          </Button>
        </motion.div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-6">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-display text-4xl font-bold mb-3">Kriti</h1>
            <p className="text-muted-foreground text-lg">Rede Intelectual</p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Teste de Acesso</h2>
              <p className="text-muted-foreground text-sm">
                Para garantir a qualidade da comunidade, você precisa passar por um teste cognitivo.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-sm"><strong>30 perguntas</strong> geradas por IA — nunca se repetem</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <Clock className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="text-sm"><strong>12 segundos</strong> por pergunta — sem tempo para consultas</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <Shield className="w-5 h-5 text-green-400 shrink-0" />
                <span className="text-sm">Mínimo de <strong>60% de acertos</strong> para acesso</span>
              </div>
            </div>

            <Button
              onClick={startTest}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
            >
              Iniciar Teste
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Gerando perguntas únicas com IA...</p>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const passed = score >= PASS_THRESHOLD;
    const iqEstimate = Math.round(70 + (score / TOTAL_QUESTIONS) * 80);
    const attemptsUsed = profile?.test_attempts || 0;
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptsUsed);

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full bg-card rounded-2xl border border-border p-8 text-center"
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            passed ? "bg-green-500/20" : "bg-red-500/20"
          }`}>
            {passed ? (
              <CheckCircle className="w-10 h-10 text-green-400" />
            ) : (
              <XCircle className="w-10 h-10 text-red-400" />
            )}
          </div>

          <h2 className="text-2xl font-display font-bold mb-2">
            {passed ? "Parabéns!" : "Não foi desta vez"}
          </h2>
          <p className="text-muted-foreground mb-2">
            {passed
              ? "Você demonstrou capacidade intelectual excepcional."
              : "Continue estudando e tente novamente."}
          </p>
          {!passed && (
            <p className="text-xs text-muted-foreground mb-4">
              {attemptsLeft > 0
                ? `Você ainda tem ${attemptsLeft} ${attemptsLeft === 1 ? "tentativa" : "tentativas"} neste mês.`
                : `Você usou suas ${MAX_ATTEMPTS} tentativas deste mês.`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-2xl font-bold">{score}/{TOTAL_QUESTIONS}</p>
              <p className="text-xs text-muted-foreground">Acertos</p>
            </div>
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-2xl font-bold">{iqEstimate}</p>
              <p className="text-xs text-muted-foreground">QI Estimado</p>
            </div>
          </div>

          {passed ? (
            <Button
              onClick={() => navigate("/")}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
            >
              Entrar na Kriti
            </Button>
          ) : attemptsLeft > 0 ? (
            <Button
              onClick={() => {
                setPhase("intro");
                setScore(0);
                setQuestions([]);
                setCurrentIndex(0);
              }}
              variant="outline"
              className="w-full h-12"
            >
              Tentar Novamente
            </Button>
          ) : (
            <Button
              onClick={() => db.auth.logout("/")}
              variant="outline"
              className="w-full h-12"
            >
              Sair
            </Button>
          )}
        </motion.div>
      </div>
    );
  }

  // TEST PHASE
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const progressPercent = ((currentIndex + 1) / TOTAL_QUESTIONS) * 100;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Progress */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <span className="text-muted-foreground">Pergunta {currentIndex + 1}/{TOTAL_QUESTIONS}</span>
          <span className="text-muted-foreground">Acertos: {score}</span>
        </div>
        <div className="w-full h-1 bg-secondary rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Timer bar */}
        <div className="w-full h-1.5 bg-secondary rounded-full mb-8 overflow-hidden">
          <div
            key={currentIndex}
            className="h-full rounded-full timer-bar"
            style={{
              background: timeLeft > 3 ? "hsl(262, 80%, 60%)" : "hsl(0, 72%, 55%)"
            }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <p className="text-lg font-medium mb-6 leading-relaxed">{currentQuestion.question}</p>

            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={selectedAnswer !== null}
                  className={`w-full text-left p-4 rounded-xl border transition-all text-sm ${
                    selectedAnswer === idx
                      ? idx === currentQuestion.correct_index
                        ? "border-green-500 bg-green-500/10 text-green-400"
                        : "border-red-500 bg-red-500/10 text-red-400"
                      : "border-border hover:border-primary/50 hover:bg-secondary"
                  }`}
                >
                  <span className="font-medium mr-2 text-muted-foreground">{String.fromCharCode(65 + idx)}.</span>
                  {option}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center mt-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className={`w-4 h-4 ${timeLeft <= 3 ? "text-red-400" : "text-muted-foreground"}`} />
            <span className={`font-mono font-bold text-lg ${timeLeft <= 3 ? "text-red-400" : "text-foreground"}`}>
              {Math.ceil(timeLeft)}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}