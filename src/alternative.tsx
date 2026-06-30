import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Thermometer,
  Play,
  RefreshCw,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Timer,
  Droplets,
  Trophy,
} from "lucide-react";

// --- Game Constants ---
const P1_TARGET = 2;
const P2_TARGET = 10;

// --- TypeScript Interfaces ---
interface DNASequence {
  top: string[];
  bot: string[];
  p1: string[];
  p2: string[];
}

interface Molecule {
  id: string;
  top: (string | null)[];
  bot: (string | null)[];
  breakOrder: number[];
}

interface ActiveStrand {
  id: string;
  type: "top" | "bot";
  seq: (string | null)[];
}

interface Score {
  name: string;
  time: number;
}

// Utility functions
const generateBreakOrder = (): number[] =>
  Array.from({ length: 16 }, () => 35 + Math.random() * 55);
const generateId = (): string => Math.random().toString(36).substr(2, 9);

const generateDNA = (): DNASequence => {
  const BASES = ["A", "T", "G", "C"];
  const compMap: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
  const getComp = (b: string) => compMap[b] || "A";

  const top = Array.from(
    { length: 16 },
    () => BASES[Math.floor(Math.random() * 4)]
  );
  const bot = top.map(getComp);

  const p1 = top.slice(P1_TARGET, P1_TARGET + 4);
  const p2 = bot.slice(P2_TARGET, P2_TARGET + 4);

  return { top, bot, p1, p2 };
};

interface BaseProps {
  char: string | null;
  sizeClass?: string;
  animate?: boolean;
}

const Base: React.FC<BaseProps> = ({
  char,
  sizeClass = "w-6 h-8 text-sm",
  animate = false,
}) => {
  const colors: Record<string, string> = {
    A: "bg-red-500 text-white",
    T: "bg-blue-500 text-white",
    G: "bg-green-600 text-white",
    C: "bg-yellow-400 text-slate-900",
  };

  const bgColor = char ? colors[char] || "bg-slate-300" : "bg-slate-300";

  return (
    <div
      className={`flex items-center justify-center font-bold rounded-sm shadow-sm transition-all duration-300 ${bgColor} ${
        animate ? "animate-pop-in ring-2 ring-white z-30" : ""
      } ${sizeClass} relative z-10`}
    >
      {char}
    </div>
  );
};

interface HBondsProps {
  b1: string | null;
  b2: string | null;
  visible: boolean;
  extraClass?: string;
}

const HBonds: React.FC<HBondsProps> = ({
  b1,
  b2,
  visible,
  extraClass = "",
}) => {
  const isGC = (b1 === "G" && b2 === "C") || (b1 === "C" && b2 === "G");
  const isAT = (b1 === "A" && b2 === "T") || (b1 === "T" && b2 === "A");

  if (!b1 || !b2 || (!isGC && !isAT)) {
    return <div className={`w-full h-full ${extraClass}`}></div>;
  }

  const lines = isGC ? 3 : 2;

  return (
    <div
      className={`flex justify-center gap-[3px] sm:gap-[4px] h-full py-[1px] transition-all duration-[400ms] ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-y-0"
      } ${extraClass}`}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="w-[1.5px] sm:w-[2px] h-full bg-cyan-300/90 rounded-full shadow-[0_0_4px_rgba(103,232,249,0.7)]"
        ></div>
      ))}
    </div>
  );
};

const TaqPolymerase: React.FC = () => (
  <div className="absolute inset-[-4px] bg-amber-400/40 border-2 border-amber-300 rounded-full animate-pulse-fast z-0 shadow-[0_0_12px_rgba(251,191,36,0.6)] flex items-center justify-center">
    <div className="w-1.5 h-1.5 bg-amber-200 rounded-full"></div>
  </div>
);

export default function App() {
  const [dna, setDna] = useState<DNASequence>(() => generateDNA());

  const [cycle, setCycle] = useState<number>(1);
  const [step, setStep] = useState<number>(0);
  const [time, setTime] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  const [scores, setScores] = useState<Score[]>([]);
  const [playerName, setPlayerName] = useState<string>("");
  const [scoreSubmitted, setScoreSubmitted] = useState<boolean>(false);

  const [molecules, setMolecules] = useState<Molecule[]>([]);
  const [activeStrands, setActiveStrands] = useState<ActiveStrand[]>([]);
  const [extensions, setExtensions] = useState<Record<string, string[]>>({});

  const [temperature, setTemperature] = useState<number>(25);
  const [p1Pos, setP1Pos] = useState<number>(0);
  const [p2Pos, setP2Pos] = useState<number>(12);
  const [errorFlash, setErrorFlash] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedScores = localStorage.getItem("pcr_leaderboard");
      if (savedScores) {
        setScores(JSON.parse(savedScores) as Score[]);
      }
    } catch (e) {
      console.error("Could not load scores", e);
    }
  }, []);

  const p1Locked = p1Pos === P1_TARGET;
  const p2Locked = p2Pos === P2_TARGET;
  const isAnnealed = p1Locked && p2Locked;

  const checkIsExtended = (): boolean => {
    if (activeStrands.length === 0) return false;
    return activeStrands.every((strand) => {
      const ext = extensions[strand.id] || [];
      if (strand.type === "bot") {
        const nextIdx = P1_TARGET + 4 + ext.length;
        return nextIdx >= 16 || strand.seq[nextIdx] === null;
      } else {
        const nextIdx = P2_TARGET - 1 - ext.length;
        return nextIdx < 0 || strand.seq[nextIdx] === null;
      }
    });
  };
  const isExtended = checkIsExtended();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (step === 2 && isAnnealed) {
      timer = setTimeout(() => setStep(3), 600);
    } else if (step === 3 && isExtended) {
      timer = setTimeout(() => setStep(4), 800);
    }
    return () => clearTimeout(timer);
  }, [step, isAnnealed, isExtended]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (step === 4) {
      timer = setTimeout(() => {
        if (cycle < 3) {
          advanceCycle();
        } else {
          setStep(5);
          setIsActive(false);
        }
      }, 1500);
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isActive && step > 0 && step < 5) {
      interval = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, step]);

  useEffect(() => {
    if (step === 2) setTemperature(55);
    if (step === 3) setTemperature(72);
    if (step === 5) setScoreSubmitted(false);
  }, [step]);

  const handleHeatTap = () => {
    if (step === 1 && temperature < 95) {
      const nextTemp = Math.min(temperature + 8, 95);
      setTemperature(nextTemp);

      if (nextTemp >= 95) {
        setTimeout(() => {
          const strands: ActiveStrand[] = [];
          molecules.forEach((m) => {
            strands.push({ id: m.id + "_top", type: "top", seq: m.top });
            strands.push({ id: m.id + "_bot", type: "bot", seq: m.bot });
          });
          setActiveStrands(strands);
          setExtensions({});
          setStep(2);
        }, 1200);
      }
    }
  };

  const handleBaseType = (base: string) => {
    if (step !== 3 || isExtended) return;

    let added = false;
    const newExts: Record<string, string[]> = { ...extensions };

    activeStrands.forEach((strand) => {
      const ext = newExts[strand.id] || [];

      if (strand.type === "bot") {
        const nextIdx = P1_TARGET + 4 + ext.length;
        if (nextIdx < 16 && strand.seq[nextIdx] !== null) {
          if (dna.top[nextIdx] === base) {
            newExts[strand.id] = [...ext, base];
            added = true;
          }
        }
      } else {
        const nextIdx = P2_TARGET - 1 - ext.length;
        if (nextIdx >= 0 && strand.seq[nextIdx] !== null) {
          if (dna.bot[nextIdx] === base) {
            newExts[strand.id] = [...ext, base];
            added = true;
          }
        }
      }
    });

    if (added) {
      setExtensions(newExts);
    } else {
      setErrorFlash(true);
      setTimeout(() => setErrorFlash(false), 300);
    }
  };

  const advanceCycle = () => {
    const newMolecules: Molecule[] = [];

    activeStrands.forEach((strand) => {
      const ext = extensions[strand.id] || [];
      if (strand.type === "bot") {
        const newTop = Array<string | null>(16).fill(null);
        for (let i = 0; i < 4; i++) newTop[P1_TARGET + i] = dna.p1[i];
        ext.forEach((b, i) => (newTop[P1_TARGET + 4 + i] = b));
        newMolecules.push({
          id: generateId(),
          top: newTop,
          bot: strand.seq,
          breakOrder: generateBreakOrder(),
        });
      } else {
        const newBot = Array<string | null>(16).fill(null);
        for (let i = 0; i < 4; i++) newBot[P2_TARGET + i] = dna.p2[i];
        ext.forEach((b, i) => (newBot[P2_TARGET - 1 - i] = b));
        newMolecules.push({
          id: generateId(),
          top: strand.seq,
          bot: newBot,
          breakOrder: generateBreakOrder(),
        });
      }
    });

    setMolecules(newMolecules);
    setCycle(cycle + 1);
    setStep(1);
    setTemperature(25);
    setP1Pos(0);
    setP2Pos(12);
  };

  const startGame = () => {
    const newDna = generateDNA();
    setDna(newDna);
    setMolecules([
      {
        id: generateId(),
        top: newDna.top,
        bot: newDna.bot,
        breakOrder: generateBreakOrder(),
      },
    ]);
    setCycle(1);
    setStep(1);
    setTime(0);
    setIsActive(true);
    setTemperature(25);
    setP1Pos(0);
    setP2Pos(12);
    setExtensions({});
    setPlayerName("");
    setScoreSubmitted(false);
  };

  const handleScoreSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const newScores = [...scores, { name: playerName.toUpperCase(), time }];
    newScores.sort((a, b) => a.time - b.time);
    const top5 = newScores.slice(0, 5);

    setScores(top5);
    try {
      localStorage.setItem("pcr_leaderboard", JSON.stringify(top5));
    } catch (e) {
      console.error("Could not save score", e);
    }
    setScoreSubmitted(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const qualifiesForLeaderboard =
    scores.length < 5 || time < (scores[scores.length - 1]?.time || Infinity);

  const baseSize =
    cycle === 3
      ? "w-[14px] h-[18px] text-[8px] sm:w-[18px] sm:h-[22px] sm:text-[10px]"
      : cycle === 2
      ? "w-4 h-5 text-[10px] sm:w-5 sm:h-6 sm:text-xs"
      : "w-5 h-6 text-xs sm:w-6 sm:h-8 sm:text-sm";
  const gapSize = cycle === 3 ? "gap-[1px]" : "gap-[2px] sm:gap-1";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500/30 flex flex-col">
      <header className="bg-slate-800 border-b border-slate-700 p-3 sm:p-4 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex-1 hidden sm:block">
          {step > 0 && (
            <span className="text-slate-400 font-bold text-sm tracking-widest uppercase">
              Cycle {Math.min(cycle, 3)}/3
            </span>
          )}
        </div>
        <div className="text-center flex-1 min-w-[150px]">
          <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            PCR Simulator
          </h1>
          {step > 0 && (
            <p className="text-[10px] text-slate-400 sm:hidden block mt-0.5">
              Cycle {Math.min(cycle, 3)}/3
            </p>
          )}
        </div>
        <div className="flex-1 flex justify-end">
          <div
            className={`flex items-center gap-1 sm:gap-2 font-mono text-sm sm:text-lg font-bold ${
              isActive ? "text-emerald-400" : "text-slate-500"
            }`}
          >
            <Timer size={18} />
            {formatTime(time)}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-2 sm:p-4 flex flex-col">
        {step === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-500">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-2">
              <Play className="text-blue-400 w-10 h-10 sm:w-12 sm:h-12 ml-2" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white px-4">
              Amplify the Target DNA
            </h2>
            <p className="text-slate-400 max-w-md px-6 text-sm sm:text-base">
              Run 3 cycles of PCR to isolate a specific DNA sequence. The
              sequence is random every time!
            </p>
            <button
              onClick={startGame}
              className="mt-6 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all transform hover:scale-105 active:scale-95"
            >
              Start Experiment
            </button>

            <div className="mt-12 w-full max-w-xs bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center justify-center gap-2 mb-3 text-slate-400">
                <Trophy size={16} className="text-yellow-400" />{" "}
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">
                  Local Top Times
                </span>
              </div>

              {scores.length === 0 ? (
                <div className="text-sm text-slate-500 italic py-4">
                  No scores saved yet.
                </div>
              ) : (
                scores.map((score, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-1 border-b border-slate-700/50 last:border-0 text-sm"
                  >
                    <span className="text-slate-300 font-mono">
                      {idx + 1}. {score.name}
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {formatTime(score.time)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step > 0 && step < 5 && (
          <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
            <div className="flex items-center gap-3 bg-slate-800 p-2 sm:p-3 rounded-lg shadow-inner w-full max-w-md mx-auto border border-slate-700">
              <Thermometer
                className={`${
                  temperature >= 95
                    ? "text-red-500 animate-pulse"
                    : temperature >= 70
                    ? "text-orange-500"
                    : "text-blue-400"
                }`}
                size={24}
              />
              <div className="flex-1 h-3 sm:h-4 bg-slate-900 rounded-full overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-[400ms] ${
                    temperature >= 95
                      ? "bg-red-500"
                      : temperature >= 70
                      ? "bg-orange-500"
                      : "bg-blue-400"
                  }`}
                  style={{ width: `${(temperature / 95) * 100}%` }}
                />
              </div>
              <span className="font-mono font-bold text-sm sm:text-lg w-12 sm:w-16 text-right text-slate-100">
                {temperature}°C
              </span>
            </div>

            <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm mx-1">
              <div className="flex items-start gap-3">
                <Info className="text-blue-400 shrink-0 mt-0.5 w-5 h-5 sm:w-6 sm:h-6" />
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base">
                    Step {step}:{" "}
                    {step === 1
                      ? "Denaturation"
                      : step === 2
                      ? "Annealing"
                      : step === 3
                      ? "Extension"
                      : "Cycle Complete"}
                  </h3>
                  <p className="text-slate-300 text-[11px] sm:text-sm mt-0.5 leading-snug">
                    {step === 1 &&
                      "Tap anywhere on the DNA to heat the sample to 95°C. Watch the hydrogen bonds break one by one!"}
                    {step === 2 &&
                      "Temperature dropped to 55°C. Slide the primers to bind to ALL active single strands."}
                    {step === 3 &&
                      "Temperature is 72°C. Act as Taq Polymerase! Feed the glowing enzymes the correct dNTP bases."}
                    {step === 4 &&
                      "Cycle finished! The tube now has twice as many DNA molecules."}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`flex-1 min-h-[300px] relative bg-slate-950 p-2 sm:p-4 rounded-2xl border-2 overflow-y-auto overflow-x-hidden ${
                step === 1
                  ? "cursor-pointer border-blue-500/30 hover:border-blue-500/60 active:bg-slate-900"
                  : "border-slate-800"
              } mx-1 custom-scrollbar`}
              onClick={step === 1 ? handleHeatTap : undefined}
            >
              {step === 1 && temperature < 95 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none z-0">
                  <p className="text-4xl sm:text-6xl font-black text-center px-4">
                    TAP TO HEAT
                  </p>
                </div>
              )}

              <div className="flex flex-col items-center w-full pb-4 pt-2">
                {step === 1 &&
                  molecules.map((mol) => (
                    <div
                      key={mol.id}
                      className="flex flex-col items-center mb-6 last:mb-0 w-full"
                    >
                      <div
                        className={`flex ${gapSize} justify-center w-full relative`}
                      >
                        {Array.from({ length: 16 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center relative"
                          >
                            <div
                              className="transition-transform duration-[800ms] z-10"
                              style={{
                                transform:
                                  temperature >= 95
                                    ? `translateY(-15px)`
                                    : "none",
                              }}
                            >
                              {mol.top[i] ? (
                                <Base
                                  char={mol.top[i] || null}
                                  sizeClass={baseSize}
                                />
                              ) : (
                                <div className={baseSize} />
                              )}
                            </div>

                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[12px] sm:h-[16px] flex items-center justify-center pointer-events-none z-0">
                              <HBonds
                                b1={mol.top[i] || null}
                                b2={mol.bot[i] || null}
                                visible={temperature < mol.breakOrder[i]}
                              />
                            </div>

                            <div
                              className="transition-transform duration-[800ms] z-10"
                              style={{
                                transform:
                                  temperature >= 95
                                    ? `translateY(15px)`
                                    : "none",
                              }}
                            >
                              {mol.bot[i] ? (
                                <Base
                                  char={mol.bot[i] || null}
                                  sizeClass={baseSize}
                                />
                              ) : (
                                <div className={baseSize} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                {step >= 2 &&
                  step <= 4 &&
                  activeStrands.map((strand) => {
                    const ext = extensions[strand.id] || [];
                    const isTopTemp = strand.type === "top";

                    return (
                      <div
                        key={strand.id}
                        className={`flex ${gapSize} justify-center w-full mb-3 sm:mb-5 relative p-1 sm:p-2 bg-slate-900/50 rounded-lg border border-slate-800/50`}
                      >
                        {Array.from({ length: 16 }).map((_, i) => {
                          const tBase = strand.seq[i];
                          let pBase: string | null = null;
                          let isExtBase = false;
                          let isTaqTarget = false;

                          if (isTopTemp) {
                            if (i >= p2Pos && i < p2Pos + 4)
                              pBase = dna.p2[i - p2Pos] || null;
                            if (
                              p2Locked &&
                              i < P2_TARGET &&
                              i >= P2_TARGET - ext.length
                            ) {
                              pBase = ext[P2_TARGET - 1 - i] || null;
                              isExtBase = i === P2_TARGET - 1 - ext.length;
                            }
                            if (
                              step === 3 &&
                              p2Locked &&
                              i === P2_TARGET - 1 - ext.length &&
                              tBase !== null
                            )
                              isTaqTarget = true;
                          } else {
                            if (i >= p1Pos && i < p1Pos + 4)
                              pBase = dna.p1[i - p1Pos] || null;
                            if (
                              p1Locked &&
                              i > P1_TARGET + 3 &&
                              i < P1_TARGET + 4 + ext.length
                            ) {
                              pBase = ext[i - P1_TARGET - 4] || null;
                              isExtBase = i === P1_TARGET + 3 + ext.length;
                            }
                            if (
                              step === 3 &&
                              p1Locked &&
                              i === P1_TARGET + 4 + ext.length &&
                              tBase !== null
                            )
                              isTaqTarget = true;
                          }

                          return (
                            <div
                              key={i}
                              className="flex flex-col items-center relative"
                            >
                              {isTopTemp ? (
                                <>
                                  {tBase ? (
                                    <Base
                                      char={tBase || null}
                                      sizeClass={baseSize}
                                    />
                                  ) : (
                                    <div className={baseSize} />
                                  )}
                                  <div className="h-[10px] sm:h-[14px] flex items-center justify-center w-full">
                                    <HBonds
                                      b1={tBase || null}
                                      b2={pBase || null}
                                      visible={true}
                                    />
                                  </div>
                                  <div className="relative">
                                    {isTaqTarget && !isExtended && (
                                      <TaqPolymerase />
                                    )}
                                    {pBase ? (
                                      <Base
                                        char={pBase || null}
                                        sizeClass={baseSize}
                                        animate={isExtBase}
                                      />
                                    ) : (
                                      <div className={baseSize} />
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="relative">
                                    {isTaqTarget && !isExtended && (
                                      <TaqPolymerase />
                                    )}
                                    {pBase ? (
                                      <Base
                                        char={pBase || null}
                                        sizeClass={baseSize}
                                        animate={isExtBase}
                                      />
                                    ) : (
                                      <div className={baseSize} />
                                    )}
                                  </div>
                                  <div className="h-[10px] sm:h-[14px] flex items-center justify-center w-full">
                                    <HBonds
                                      b1={pBase || null}
                                      b2={tBase || null}
                                      visible={true}
                                    />
                                  </div>
                                  {tBase ? (
                                    <Base
                                      char={tBase || null}
                                      sizeClass={baseSize}
                                    />
                                  ) : (
                                    <div className={baseSize} />
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex flex-col items-center px-1">
              {step === 2 && (
                <div className="flex flex-col sm:flex-row w-full gap-2 sm:gap-4 justify-between items-center max-w-2xl mx-auto h-[70px]">
                  <div className="flex flex-col items-center gap-1 sm:gap-2 bg-slate-800 p-2 sm:p-3 rounded-lg border border-slate-700 w-full sm:w-auto flex-1">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Primer 1 (Forward)
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setP1Pos((p) => Math.max(0, p - 1))}
                        disabled={p1Locked}
                        className="p-2 sm:p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-full text-white active:scale-95 transition-all"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="w-6 flex justify-center">
                        {p1Locked && (
                          <CheckCircle className="text-emerald-500" size={18} />
                        )}
                      </div>
                      <button
                        onClick={() => setP1Pos((p) => Math.min(12, p + 1))}
                        disabled={p1Locked}
                        className="p-2 sm:p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-full text-white active:scale-95 transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1 sm:gap-2 bg-slate-800 p-2 sm:p-3 rounded-lg border border-slate-700 w-full sm:w-auto flex-1">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Primer 2 (Reverse)
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setP2Pos((p) => Math.max(0, p - 1))}
                        disabled={p2Locked}
                        className="p-2 sm:p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-full text-white active:scale-95 transition-all"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="w-6 flex justify-center">
                        {p2Locked && (
                          <CheckCircle className="text-emerald-500" size={18} />
                        )}
                      </div>
                      <button
                        onClick={() => setP2Pos((p) => Math.min(12, p + 1))}
                        disabled={p2Locked}
                        className="p-2 sm:p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-full text-white active:scale-95 transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="w-full max-w-sm bg-slate-800/80 p-3 sm:p-4 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden h-[120px] flex flex-col justify-center">
                  <div className="absolute inset-0 bg-blue-500/5 pointer-events-none"></div>

                  {isExtended ? (
                    <div className="flex flex-col items-center justify-center h-full animate-in zoom-in">
                      <CheckCircle className="text-emerald-500 mb-2 w-10 h-10" />
                      <span className="font-bold text-emerald-400">
                        Strands Complete!
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-3 text-slate-400">
                        <Droplets size={16} />{" "}
                        <span className="text-xs font-bold uppercase tracking-wider">
                          Free dNTP Pool
                        </span>
                      </div>
                      <div
                        className={`grid grid-cols-4 gap-2 sm:gap-4 transition-transform ${
                          errorFlash ? "animate-shake" : ""
                        }`}
                      >
                        {["A", "T", "C", "G"].map((base) => (
                          <button
                            key={base}
                            onClick={() => handleBaseType(base)}
                            className="h-12 sm:h-16 text-xl sm:text-2xl font-black rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.3)] transform transition-all active:translate-y-1 active:shadow-none hover:brightness-110 flex items-center justify-center bg-slate-700 border border-slate-600 relative overflow-hidden group"
                          >
                            <Base
                              char={base}
                              sizeClass="w-full h-full rounded-lg shadow-none"
                            />
                            <div className="absolute inset-0 bg-white/0 group-active:bg-white/20 transition-colors"></div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="flex flex-col items-center text-center animate-in zoom-in duration-500 h-[100px] justify-center">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                    Cycle {cycle} complete!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 px-4">
                    The tube now contains {activeStrands.length} distinct
                    single-stranded templates.
                  </p>

                  {cycle < 3 ? (
                    <div className="flex items-center gap-2 text-blue-400 mt-4 animate-pulse">
                      <RefreshCw className="animate-spin" size={20} /> Starting
                      Cycle {cycle + 1}...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-purple-400 mt-4 animate-pulse">
                      <CheckCircle size={20} /> Preparing Target Amplicon...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center animate-in zoom-in duration-700 py-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <CheckCircle className="text-emerald-400" /> Target Isolated!
            </h2>
            <p className="text-slate-400 max-w-md px-4 text-sm sm:text-base">
              Time:{" "}
              <strong className="text-emerald-400 font-mono text-xl">
                {formatTime(time)}
              </strong>
            </p>

            <div className="w-full max-w-lg bg-slate-800 p-4 sm:p-6 rounded-2xl border border-slate-700 shadow-xl overflow-x-auto">
              <h3 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider text-center">
                Pure Amplicon
              </h3>
              <div className="flex justify-center gap-1 sm:gap-2 min-w-max mx-auto py-2">
                {Array.from({ length: P2_TARGET + 4 - P1_TARGET }).map(
                  (_, i) => {
                    const topBase = dna.top[i + P1_TARGET];
                    const botBase = dna.bot[i + P1_TARGET];
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <Base
                          char={topBase}
                          sizeClass="w-5 h-7 sm:w-8 sm:h-10 text-xs sm:text-base"
                        />
                        <div className="h-[10px] sm:h-[14px] flex items-center w-full">
                          <HBonds b1={topBase} b2={botBase} visible={true} />
                        </div>
                        <Base
                          char={botBase}
                          sizeClass="w-5 h-7 sm:w-8 sm:h-10 text-xs sm:text-base"
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            <div className="w-full max-w-md bg-slate-800/80 p-5 rounded-2xl border border-slate-700 mt-4">
              <div className="flex items-center justify-center gap-2 mb-4 text-slate-300">
                <Trophy className="text-yellow-400" size={20} />
                <h3 className="font-bold text-lg text-yellow-300">
                  Local Leaderboard
                </h3>
              </div>

              {qualifiesForLeaderboard && !scoreSubmitted ? (
                <form onSubmit={handleScoreSubmit} className="flex gap-2 mb-6">
                  <input
                    type="text"
                    maxLength={3}
                    value={playerName}
                    onChange={(e) =>
                      setPlayerName(e.target.value.toUpperCase())
                    }
                    placeholder="Initials"
                    className="bg-slate-900 border border-slate-600 text-white px-4 py-2 rounded-lg w-24 text-center font-bold uppercase focus:outline-none focus:border-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors"
                  >
                    Save Score
                  </button>
                </form>
              ) : null}

              <div className="space-y-2">
                {scores.length === 0 && (
                  <div className="text-slate-500 italic">
                    No scores saved yet.
                  </div>
                )}
                {scores.map((score, idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between items-center p-2 rounded ${
                      score.time === time && scoreSubmitted
                        ? "bg-blue-600/20 border border-blue-500/50"
                        : "bg-slate-900/50"
                    }`}
                  >
                    <span className="text-slate-300 font-mono font-bold">
                      {idx + 1}. {score.name}
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {formatTime(score.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              className="mt-4 flex items-center gap-2 px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-bold text-sm sm:text-lg shadow-lg transition-all active:scale-95"
            >
              <RefreshCw size={20} /> Play Again
            </button>
          </div>
        )}
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @keyframes pop-in {
          0% { transform: scale(0.3) translateY(20px); opacity: 0; }
          70% { transform: scale(1.1) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes pulse-fast {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 0.4; }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .animate-pop-in { animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-pulse-fast { animation: pulse-fast 1s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `,
        }}
      />
    </div>
  );
}

// --- Self-Mounting Logic to fix the white screen in main.tsx ---
if (typeof document !== "undefined") {
  const rootElement = document.getElementById("root");

  const mountApp = () => {
    if (rootElement && !rootElement.hasAttribute("data-pcr-mounted")) {
      rootElement.setAttribute("data-pcr-mounted", "true");
      const root = createRoot(rootElement);
      root.render(<App />);
    }
  };

  // Auto-inject Tailwind CSS and wait for it to load before rendering
  if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) {
    if (rootElement) {
      rootElement.style.backgroundColor = "#0f172a"; // Prevent white flash by matching slate-900 background
      rootElement.style.height = "100vh";
    }
    const script = document.createElement("script");
    script.src = "https://cdn.tailwindcss.com";
    script.onload = mountApp;
    document.head.appendChild(script);
  } else {
    mountApp();
  }
}
