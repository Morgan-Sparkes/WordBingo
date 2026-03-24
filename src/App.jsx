import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

const GRID_SIZE = 4;
const STORAGE_PREFIX = "wordbingo-v1";

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
}

function shuffleFromSeed(items, seed) {
  const arr = [...items];
  const rand = mulberry32(seed);

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function getWinningLines() {
  const lines = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    lines.push(Array.from({ length: GRID_SIZE }, (_, col) => row * GRID_SIZE + col));
  }

  for (let col = 0; col < GRID_SIZE; col++) {
    lines.push(Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + col));
  }

  lines.push(Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + i));
  lines.push(Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + (GRID_SIZE - 1 - i)));

  return lines;
}

const WINNING_LINES = getWinningLines();

function getCompletedLine(selected) {
  for (const line of WINNING_LINES) {
    if (line.every((index) => selected[index])) {
      return line;
    }
  }
  return null;
}

function getNearWins(selected) {
  return WINNING_LINES.filter(
    (line) => line.filter((index) => selected[index]).length === GRID_SIZE - 1
  );
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
const CONFETTI_COLORS = [
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#facc15",
  "#fb7185",
  "#38bdf8",
  "#c084fc",
  "#f97316",
];

function createConfettiPieces(count = 42) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${Date.now()}-${i}`,
    left: Math.random() * 100,
    size: 8 + Math.random() * 10,
    height: 10 + Math.random() * 14,
    drift: (Math.random() - 0.5) * 220,
    drop: 650 + Math.random() * 300,
    rotate: 180 + Math.random() * 540,
    duration: 1.6 + Math.random() * 0.9,
    delay: Math.random() * 0.18,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    round: Math.random() > 0.65,
  }));
}
export default function App() {
  const todayKey = useMemo(() => getTodayKey(), []);
  const [wordsLoaded, setWordsLoaded] = useState(false);
  const [wordList, setWordList] = useState([]);
  const [selected, setSelected] = useState(Array(16).fill(false));
  const [hasWon, setHasWon] = useState(false);
  const [winningLine, setWinningLine] = useState(null);
  const [showSplash, setShowSplash] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState([]);

  useEffect(() => {
    fetch("/data/google-10000-english.txt")
      .then((res) => res.text())
      .then((text) => {
        const words = text
          .split("\n")
          .map((w) => w.trim().toLowerCase())
          .filter((w) => w.length >= 4 && /^[a-z]+$/.test(w));

        const filtered = words.slice(0, 5000);
        setWordList(filtered);
        setWordsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load dataset:", err);
      });
  }, []);

  const board = useMemo(() => {
    if (!wordsLoaded) return Array(16).fill("...");
    const seed = seedFromString(`wordbingo-${todayKey}`);
    return shuffleFromSeed(wordList, seed).slice(0, GRID_SIZE * GRID_SIZE);
  }, [todayKey, wordsLoaded, wordList]);

  useEffect(() => {
    const savedSelected = loadJson(
      `${STORAGE_PREFIX}-selected-${todayKey}`,
      Array(16).fill(false)
    );

    setSelected(savedSelected);

    const line = getCompletedLine(savedSelected);
    if (line) {
      setWinningLine(line);
      setHasWon(true);
    }
  }, [todayKey]);

  useEffect(() => {
    saveJson(`${STORAGE_PREFIX}-selected-${todayKey}`, selected);
  }, [selected, todayKey]);

  useEffect(() => {
    if (showResultModal) {
      setCopied(false);
    }
  }, [showResultModal]);

  useEffect(() => {
  if (confettiPieces.length === 0) return;

  const timer = window.setTimeout(() => {
    setConfettiPieces([]);
  }, 2400);

  return () => window.clearTimeout(timer);
}, [confettiPieces]);

  const nearWins = useMemo(() => getNearWins(selected), [selected]);

  const getShareText = () => {
    const emojiRows = [];

    for (let row = 0; row < GRID_SIZE; row++) {
      let line = "";
      for (let col = 0; col < GRID_SIZE; col++) {
        const index = row * GRID_SIZE + col;
        line += selected[index] ? "🟩" : "⬜";
      }
      emojiRows.push(line);
    }

    return [
      `WordBingo ${todayKey}`,
      ...emojiRows,
      hasWon ? "BINGO!" : "Still playing..."
    ].join("\n");
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Copy failed:", err);
      alert(getShareText());
    }
  };

  const toggleTile = (index) => {
    if (hasWon) return;

    const next = [...selected];
    next[index] = !next[index];
    setSelected(next);

    const line = getCompletedLine(next);
    if (line) {
      setWinningLine(line);
      setHasWon(true);
      setShowSplash(true);
      setConfettiPieces(createConfettiPieces());

      window.setTimeout(() => {
        setShowSplash(false);
        setShowResultModal(true);
      }, 1900);
    }
  };

  const resetToday = () => {
    const cleared = Array(16).fill(false);
    setSelected(cleared);
    setHasWon(false);
    setWinningLine(null);
    setShowSplash(false);
    setShowResultModal(false);
    setCopied(false);
    setConfettiPieces([]);
    saveJson(`${STORAGE_PREFIX}-selected-${todayKey}`, cleared);
  };

  if (!wordsLoaded) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "Poppins, sans-serif",
          padding: "24px"
        }}
      >
        Loading words...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#fafafa",
        padding: "24px 14px 32px",
        fontFamily: "Inter, Arial, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "860px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center"
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: "22px",
            width: "100%"
          }}
        >
          <h1
            style={{
              fontSize: "clamp(40px, 8vw, 72px)",
              fontWeight: 900,
              margin: 0,
              lineHeight: 1.08,
              letterSpacing: "-0.03em"
            }}
          >
            WordBingo
          </h1>

          <p
            style={{
              color: "#a1a1aa",
              marginTop: "12px",
              maxWidth: "520px",
              marginLeft: "auto",
              marginRight: "auto",
              fontSize: "clamp(14px, 3.5vw, 18px)",
              lineHeight: 1.45
            }}
          >
            Click the words you’ve used today. Get 4 in a row — diagonals count.
          </p>

          <p
            style={{
              fontSize: "14px",
              color: "#71717a",
              marginTop: "10px"
            }}
          >
            Daily board: {todayKey}
          </p>
        </motion.div>

        <div
          style={{
            background: "rgba(24,24,27,0.82)",
            border: "1px solid #27272a",
            borderRadius: "32px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
            overflow: "hidden",
            width: "100%",
            maxWidth: "560px",
            margin: "0 auto"
          }}
        >
          <div
            style={{
              padding: "clamp(16px, 4vw, 24px)"
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "12px"
              }}
            >
              {board.map((word, index) => {
                const isSelected = selected[index];
                const isWinnerTile = winningLine?.includes(index);
                const isNearWinTile = !isSelected && nearWins.some((line) => line.includes(index));

                return (
                  <motion.button
                    key={`${todayKey}-${word}-${index}`}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => toggleTile(index)}
                    style={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: "20px",
                      perspective: "1000px",
                      border: "none",
                      padding: 0,
                      background: "transparent",
                      cursor: hasWon ? "default" : "pointer"
                    }}
                  >
                    <motion.div
                      animate={{ rotateY: isSelected || hasWon ? 180 : 0 }}
                      transition={{ duration: 0.5 }}
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        transformStyle: "preserve-3d"
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "20px",
                          border: isNearWinTile
                            ? "1px solid rgba(16,185,129,0.7)"
                            : "1px solid #3f3f46",
                          textAlign: "center",
                          padding: "8px",
                          fontWeight: 700,
                          fontSize: "clamp(13px, 1.3vw, 18px)",
                          lineHeight: 1.2,
                          background: "#09090b",
                          color: "#fafafa",
                          boxShadow: isNearWinTile
                            ? "0 0 0 1px rgba(16,185,129,0.15), 0 10px 25px rgba(16,185,129,0.08)"
                            : "none",
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden"
                        }}
                      >
                        {word}
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "20px",
                          border: isWinnerTile ? "1px solid #bbf7d0" : "1px solid #15803d",
                          textAlign: "center",
                          padding: "8px",
                          fontWeight: 800,
                          fontSize: "clamp(13px, 1.3vw, 18px)",
                          lineHeight: 1.2,
                          background: isWinnerTile ? "#22c55e" : "#16a34a",
                          color: "#ffffff",
                          transform: "rotateY(180deg)",
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden"
                        }}
                      >
                        {word}
                      </div>
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: "24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                width: "100%"
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: 700 }}>
                  {hasWon ? "BINGO!" : `${selected.filter(Boolean).length}/16 words selected`}
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    color: "#a1a1aa",
                    marginTop: "6px",
                    maxWidth: "420px",
                    marginLeft: "auto",
                    marginRight: "auto",
                    lineHeight: 1.45
                  }}
                >
                  {hasWon
                    ? "You completed a line on today’s board."
                    : nearWins.length > 0
                    ? "You’re one word away from a Bingo line."
                    : "Find any full row, column, or diagonal."}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  width: "100%",
                  marginTop: "6px"
                }}
              >
                <button
                  onClick={resetToday}
                  style={{
                    width: "100%",
                    borderRadius: "18px",
                    padding: "14px",
                    border: "1px solid #3f3f46",
                    background: "transparent",
                    color: "#fafafa",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "18px",
            fontSize: "14px",
            color: "#71717a",
            textAlign: "center",
            maxWidth: "520px",
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.45
          }}
        >
          Honor system rules: just tap the words you genuinely used today.
        </div>
      </div>

      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 180, damping: 12 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              padding: "20px"
            }}
          >
            <motion.div
              initial={{ rotate: -8 }}
              animate={{ rotate: [-8, 6, -3, 0] }}
              transition={{ duration: 0.7 }}
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px"
              }}
            >
              <div
                style={{
                  fontSize: "clamp(64px, 12vw, 128px)",
                  fontWeight: 900,
                  letterSpacing: "0.15em",
                  lineHeight: 0.95,
                  color: "#4ade80",
                  textShadow: "0 10px 30px rgba(74,222,128,0.22)",
                  paddingLeft: "0.15em"
                }}
              >
                BINGO
              </div>

              <div
                style={{
                  color: "#fafafa",
                  fontSize: "20px",
                  lineHeight: 1.35,
                  marginTop: "4px"
                }}
              >
                You got 4 in a row.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

           <AnimatePresence>
        {showResultModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.62)",
              backdropFilter: "blur(6px)",
              padding: "18px"
            }}
          >
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              style={{
                width: "100%",
                maxWidth: "420px",
                background: "rgba(24,24,27,0.96)",
                border: "1px solid #27272a",
                borderRadius: "28px",
                boxShadow: "0 30px 70px rgba(0,0,0,0.4)",
                padding: "22px"
              }}
            >
              <div style={{ textAlign: "center" }}>
                <h2 style={{ margin: 0, fontSize: "30px" }}>BINGO!</h2>
                <p style={{ color: "#a1a1aa" }}>
                  You completed today’s board.
                </p>
              </div>

              <div style={{ marginTop: "18px" }}>
                <div style={{ whiteSpace: "pre-wrap", textAlign: "center" }}>
                  {getShareText().split("\n").slice(1).join("\n")}
                </div>
              </div>
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              style={{
                width: "100%",
                maxWidth: "420px",
                background: "rgba(24,24,27,0.96)",
                border: "1px solid #27272a",
                borderRadius: "28px",
                boxShadow: "0 30px 70px rgba(0,0,0,0.4)",
                padding: "22px"
              }}
            >
              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "30px",
                    lineHeight: 1.1
                  }}
                >
                  BINGO!
                </h2>

                <p
                  style={{
                    marginTop: "10px",
                    marginBottom: 0,
                    color: "#a1a1aa",
                    fontSize: "15px",
                    lineHeight: 1.45
                  }}
                >
                  You completed today’s board.
                </p>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  background: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: "20px",
                  padding: "16px"
                }}
              >
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    textAlign: "center",
                    fontSize: "24px",
                    lineHeight: 1.45,
                    letterSpacing: "0.08em"
                  }}
                >
                  {getShareText()
                    .split("\n")
                    .slice(1)
                    .join("\n")}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "18px"
                }}
              >
                <button
                  onClick={copyResult}
                  style={{
                    flex: 1,
                    borderRadius: "18px",
                    padding: "14px",
                    border: "none",
                    background: "#fafafa",
                    color: "#09090b",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {copied ? "Copied!" : "Copy Result"}
                </button>

                <button
                  onClick={() => setShowResultModal(false)}
                  style={{
                    flex: 1,
                    borderRadius: "18px",
                    padding: "14px",
                    border: "1px solid #3f3f46",
                    background: "transparent",
                    color: "#fafafa",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Close
                </button>
              </div>

              <p
                style={{
                  marginTop: "14px",
                  marginBottom: 0,
                  textAlign: "center",
                  fontSize: "13px",
                  color: "#71717a",
                  lineHeight: 1.4
                }}
              >
                Share it your Results! — paste your result anywhere.
              </p>
          
            </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFETTI */}
      <AnimatePresence>
        {confettiPieces.length > 0 && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              pointerEvents: "none",
              zIndex: 70   // 👈 IMPORTANT (above modal)
            }}
          >
            {confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{ y: -40, opacity: 1 }}
                animate={{ y: piece.drop, x: piece.drift, opacity: 0 }}
                transition={{ duration: piece.duration }}
                style={{
                  position: "absolute",
                  left: `${piece.left}%`,
                  width: `${piece.size}px`,
                  height: `${piece.height}px`,
                  background: piece.color
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="footer">
        <p>WordBingo © 2026</p>
        <p>New Bingos every day</p>
        <p>Share with friends</p>
        <p>
          <a href="mailto:wordbingo.site@gmail.com">
            wordbingo.site@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
