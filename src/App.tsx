import { useEffect, useState } from "react";
import { createBoardConfig, gameConfig } from "./gameConfig";
import tasksMarkdown from "./tasks.md?raw";

interface PlayerState {
  id: "pink" | "mint";
  name: string;
  shortName: string;
  color: string;
  position: number;
}

interface GameSettings {
  names: [string, string];
  adultMode: boolean;
  sound: boolean;
}

interface ActiveTask {
  playerIndex: number;
  cellNumber: number;
  finishesGame: boolean;
  task: string;
}

const defaultSettings: GameSettings = {
  names: ["恋人 A", "恋人 B"],
  adultMode: false,
  sound: true,
};

function parseTaskMarkdown(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

const configuredTasks = parseTaskMarkdown(tasksMarkdown);
const boardConfig = createBoardConfig(configuredTasks.length);

function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? ({ ...initialValue, ...JSON.parse(stored) } as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function createPlayers(settings: GameSettings): PlayerState[] {
  return gameConfig.players.map((player, index) => ({
    ...player,
    name: settings.names[index] || player.name,
    position: 0,
  }));
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function dealTasksToCells(tasks: string[], cellCount: number) {
  const fallbackTasks = tasks.length ? tasks : ["抱住对方 30 秒，并说一句今天最喜欢对方的话。"];
  const deck = shuffle(fallbackTasks);

  return Array.from({ length: cellCount }, (_, index) => deck[index % deck.length]);
}

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let audioContext: AudioContext | null = null;

function playTone(enabled: boolean, frequency: number, durationMs: number, delayMs = 0, type: OscillatorType = "sine") {
  if (!enabled) {
    return;
  }

  window.setTimeout(() => {
    const AudioCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioCtor) {
      return;
    }

    audioContext ??= new AudioCtor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationMs / 1000 + 0.02);
  }, delayMs);
}

function playRollSound(enabled: boolean) {
  [260, 340, 420, 540].forEach((frequency, index) => {
    playTone(enabled, frequency, 70, index * 55, "triangle");
  });
}

function playTaskSound(enabled: boolean) {
  [520, 660, 780].forEach((frequency, index) => {
    playTone(enabled, frequency, 95, index * 80, "sine");
  });
}

function App() {
  const [settings, setSettings] = useLocalStorageState<GameSettings>("ludo4couples-settings", defaultSettings);
  const [players, setPlayers] = useState<PlayerState[]>(() => createPlayers(settings));
  const [cellTasks, setCellTasks] = useState<string[]>(() => dealTasksToCells(configuredTasks, boardConfig.boardCells.length));
  const [turnIndex, setTurnIndex] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("准备好后，先在设置里确认双方成年并同意随机任务。");
  const [winner, setWinner] = useState<PlayerState | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => ({
        ...player,
        name: settings.names[index] || gameConfig.players[index].name,
      })),
    );
  }, [settings.names]);

  const currentPlayer = players[turnIndex];
  const canRoll = !isMoving && !activeTask && !winner && settings.adultMode;

  function finishTurn(nextNotice?: string) {
    const nextIndex = (turnIndex + 1) % players.length;
    setTurnIndex(nextIndex);
    setNotice(nextNotice ?? `轮到 ${players[nextIndex].name} 掷骰。`);
  }

  function handleLanding(position: number) {
    const task = cellTasks[position] || configuredTasks[0] || "抱住对方 30 秒，并说一句今天最喜欢对方的话。";
    const finishesGame = position >= boardConfig.finishIndex;
    setActiveTask({ playerIndex: turnIndex, cellNumber: position, finishesGame, task });
    setNotice(`${currentPlayer.name} 到达第 ${position + 1} 格，抽到任务。`);
    playTaskSound(settings.sound);
  }

  function rollDice() {
    if (!canRoll) {
      if (!settings.adultMode) {
        setNotice("请先在设置里确认双方均已成年，并同意随机抽取任务。");
      }
      return;
    }

    const roll = Math.ceil(Math.random() * 6);
    const start = currentPlayer.position;
    const target = Math.min(boardConfig.finishIndex, start + roll);
    let nextPosition = start;

    setDice(roll);
    setIsMoving(true);
    setNotice(`${currentPlayer.name} 掷出了 ${roll} 点。`);
    playRollSound(settings.sound);

    const timer = window.setInterval(() => {
      nextPosition += 1;
      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) => (index === turnIndex ? { ...player, position: nextPosition } : player)),
      );
      playTone(settings.sound, 520 + nextPosition * 6, 45, 0, "triangle");

      if (nextPosition >= target) {
        window.clearInterval(timer);
        setIsMoving(false);
        window.setTimeout(() => handleLanding(target), 180);
      }
    }, 150);
  }

  function resolveTask() {
    if (!activeTask) {
      return;
    }

    const player = players[activeTask.playerIndex];
    setHistory((items) => [`完成｜${player.name}：第 ${activeTask.cellNumber + 1} 格`, ...items].slice(0, 6));
    setActiveTask(null);

    if (activeTask.finishesGame) {
      setWinner(player);
      setNotice(`${player.name} 完成终点任务，赢得本局。`);
      playTaskSound(settings.sound);
      return;
    }

    playTaskSound(settings.sound);
    finishTurn(`${player.name} 完成任务，轮到下一位。`);
  }

  function resetGame() {
    setPlayers(createPlayers(settings));
    setCellTasks(dealTasksToCells(configuredTasks, boardConfig.boardCells.length));
    setTurnIndex(0);
    setDice(null);
    setActiveTask(null);
    setWinner(null);
    setHistory([]);
    setNotice(`新一局任务已重新洗牌，由 ${settings.names[0] || "恋人 A"} 掷骰。`);
  }

  function updateName(index: 0 | 1, name: string) {
    setSettings((current) => {
      const names: [string, string] = [...current.names];
      names[index] = name;
      return { ...current, names };
    });
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">2 人同屏 · 任务开局随机洗牌</p>
          <h1>{gameConfig.title}</h1>
          <p className="hero-copy">掷骰前进，数字格抽任务。任务统一来自 Markdown 配置，开局随机洗牌铺入棋盘。</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => setSettingsOpen(true)}>
          设置
        </button>
      </header>

      <main className="game-layout">
        <section className="board-panel" aria-label="情侣飞行棋棋盘">
          <div className="board-topline">
            <div>
              <span className="pill">当前回合</span>
              <strong style={{ color: currentPlayer.color }}>{currentPlayer.name}</strong>
            </div>
            <div className="notice">{notice}</div>
          </div>

          <div
            className="board-grid"
            style={{
              gridTemplateColumns: `repeat(${boardConfig.boardSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${boardConfig.boardSize}, minmax(0, 1fr))`,
            }}
          >
            {boardConfig.boardCells.map((cell, index) => {
              const position = boardConfig.boardPositions[index];
              const tokens = players.filter((player) => player.position === index);
              return (
                <div
                  className={`board-cell ${index === 0 ? "is-start" : ""} ${
                    index === boardConfig.finishIndex ? "is-finish" : ""
                  }`}
                  key={cell.id}
                  style={{ gridColumn: position.col, gridRow: position.row }}
                >
                  <strong>{cell.label}</strong>
                  <div className="tokens">
                    {tokens.map((player) => (
                      <span className={`token token-${player.id}`} key={player.id} style={{ backgroundColor: player.color }}>
                        {player.shortName}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="control-panel">
          <div className="player-stack">
            {players.map((player, index) => (
              <article className={`player-card ${index === turnIndex ? "is-active" : ""}`} key={player.id}>
                <span className="player-dot" style={{ backgroundColor: player.color }} />
                <div>
                  <strong>{player.name}</strong>
                  <small>第 {player.position + 1} 格</small>
                </div>
              </article>
            ))}
          </div>

          <div className="dice-stage">
            <div className="dice" aria-live="polite">
              {dice ?? "?"}
            </div>
            <button className="roll-button" type="button" onClick={rollDice} disabled={!canRoll}>
              {winner ? "已结束" : !settings.adultMode ? "先确认同意" : isMoving ? "移动中" : "掷骰"}
            </button>
            <button className="text-button" type="button" onClick={resetGame}>
              重新洗牌开局
            </button>
          </div>

          <div className="rules-card">
            <h2>本局设置</h2>
            <p>成人同意：{settings.adultMode ? "已确认" : "未确认"}</p>
            <p>任务数量：{configuredTasks.length} 条</p>
            <p>棋盘格数：{boardConfig.boardCells.length} 格</p>
            <p>音效：{settings.sound ? "开启" : "关闭"}</p>
          </div>

          <div className="history-card">
            <h2>最近记录</h2>
            {history.length ? (
              <ul>
                {history.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>还没有任务记录。</p>
            )}
          </div>
        </aside>
      </main>

      {activeTask && (
        <div className="modal-backdrop" role="presentation">
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-title">
            <span className="task-badge">第 {activeTask.cellNumber + 1} 格</span>
            <h2 id="task-title">任务</h2>
            <p>{activeTask.task}</p>
            <div className="modal-actions">
              <button className="roll-button" type="button" onClick={resolveTask}>
                完成任务
              </button>
            </div>
          </section>
        </div>
      )}

      {winner && (
        <div className="modal-backdrop" role="presentation">
          <section className="task-modal winner-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title">
            <span className="task-badge">第 {boardConfig.finishIndex + 1} 格</span>
            <h2 id="winner-title">{winner.name} 抵达终点</h2>
            <p>胜利奖励：由赢家选择一个今晚奖励。</p>
            <div className="modal-actions">
              <button className="roll-button" type="button" onClick={resetGame}>
                再来一局
              </button>
              <button className="ghost-button" type="button" onClick={() => setWinner(null)}>
                关闭弹窗
              </button>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-heading">
              <div>
                <span className="task-badge">配置</span>
                <h2 id="settings-title">本地设置</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setSettingsOpen(false)} aria-label="关闭设置">
                ×
              </button>
            </div>

            <label>
              恋人 A 名字
              <input value={settings.names[0]} onChange={(event) => updateName(0, event.target.value)} />
            </label>
            <label>
              恋人 B 名字
              <input value={settings.names[1]} onChange={(event) => updateName(1, event.target.value)} />
            </label>

            <label className="toggle-line">
              <input
                type="checkbox"
                checked={settings.adultMode}
                onChange={(event) => setSettings((current) => ({ ...current, adultMode: event.target.checked }))}
              />
              双方均已成年，并同意从任务列表中随机抽取任务
            </label>

            <label className="toggle-line">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(event) => setSettings((current) => ({ ...current, sound: event.target.checked }))}
              />
              开启轻音效
            </label>

            <p className="settings-note">任务请直接编辑 src/tasks.md，每一条任务是一行 bullet point。任务条数会决定棋格数量，重新开局会重新洗牌。</p>

            <div className="modal-actions">
              <button className="roll-button" type="button" onClick={() => setSettingsOpen(false)}>
                保存
              </button>
              <button className="ghost-button" type="button" onClick={resetGame}>
                用当前设置重开
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
