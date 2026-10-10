import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import {
  BAND_MAX,
  BAND_MIN,
  BOOK,
  BUSINESS_WASH,
  CAMERAS,
  CAMERA_WASH,
  GHOSTS,
  INITIAL_BOX,
  LOCK_KHZ,
  MOVES,
  RADIOS,
  WIRE,
  type BoxState,
  type CamId,
  clampFreq,
  nearestRadio,
  scriptFor,
} from "./content";
import { GrooveEngine } from "./engine";

const STORE = "merged-box-v1";

function percent(freq: number): number {
  return ((freq - BAND_MIN) / (BAND_MAX - BAND_MIN)) * 100;
}

export function Studio() {
  const [box, setBox] = useState<BoxState>(INITIAL_BOX);
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [move, setMove] = useState(0);
  const [log, setLog] = useState<string[]>(() => BOOK.slice(0, 4));
  const [camHot, setCamHot] = useState<CamId>("CAM 2");
  const boxRef = useRef(box);
  const engineRef = useRef<GrooveEngine | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const barRefs = useRef<(HTMLElement | null)[]>([]);
  boxRef.current = box;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<BoxState>;
        setBox((prev) => ({
          ...prev,
          freq: typeof saved.freq === "number" ? clampFreq(saved.freq) : prev.freq,
          volume:
            typeof saved.volume === "number" ? Math.min(1, Math.max(0, saved.volume)) : prev.volume,
          merged: Boolean(saved.merged),
          powered: false,
        }));
      }
    } catch {
      /* keep the house defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(
      STORE,
      JSON.stringify({ freq: box.freq, volume: box.volume, merged: box.merged }),
    );
  }, [box.freq, box.volume, box.merged, ready]);

  useEffect(() => {
    const engine = new GrooveEngine();
    engineRef.current = engine;
    return () => engine.dispose();
  }, []);

  useEffect(() => {
    const paint = () => {
      const now = new Date();
      setClock(
        [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map((n) => String(n).padStart(2, "0"))
          .join(":"),
      );
    };
    paint();
    const id = window.setInterval(paint, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const delay = mq.matches ? 7000 : 4200;
    const id = window.setInterval(() => {
      setMove((n) => {
        const next = (n + 1) % MOVES.length;
        setCamHot(MOVES[next]?.cam ?? "CAM 1");
        return next;
      });
    }, delay);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let i = 4;
    const id = window.setInterval(() => {
      const line = BOOK[i % BOOK.length] ?? BOOK[0];
      i += 1;
      setLog((prev) => [...prev.slice(-4), line]);
    }, 3600);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!box.powered) return;
    const id = window.setInterval(() => {
      setBox((prev) => ({ ...prev, cue: prev.cue + 1 }));
    }, 14000);
    return () => window.clearInterval(id);
  }, [box.powered]);

  useEffect(() => {
    if (!box.powered) {
      stageRef.current?.style.setProperty("--vu", "0");
      barRefs.current.forEach((el) => el?.style.setProperty("--h", "0"));
      return;
    }
    let frame = 0;
    const loop = () => {
      const next = engineRef.current?.levels() ?? [];
      let sum = 0;
      next.forEach((level, index) => {
        sum += level;
        barRefs.current[index]?.style.setProperty("--h", level.toFixed(3));
      });
      const vu = next.length ? sum / next.length : 0;
      stageRef.current?.style.setProperty("--vu", vu.toFixed(3));
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [box.powered]);

  function commit(partial: Partial<BoxState>, audio: boolean) {
    const next = { ...boxRef.current, ...partial };
    boxRef.current = next;
    setBox(next);
    if (audio) engineRef.current?.sync(next);
  }

  function togglePower() {
    commit({ powered: !boxRef.current.powered }, true);
  }

  function tune(freq: number) {
    if (boxRef.current.merged) return;
    commit({ freq: clampFreq(freq) }, boxRef.current.powered);
  }

  function pick(freq: number) {
    commit({ freq, merged: false, cue: 0 }, boxRef.current.powered);
    setLog((prev) => [...prev.slice(-4), "P-13  Single cabinet — dial released"]);
  }

  function merge() {
    const next = !boxRef.current.merged;
    commit({ merged: next, cue: 0 }, boxRef.current.powered);
    setLog((prev) => [
      ...prev.slice(-4),
      next ? "P-17  Four cabinets, one groove" : "P-02  Boxes split — stand by",
    ]);
    setCamHot("CAM 2");
  }

  function cue() {
    commit({ cue: boxRef.current.cue + 1 }, false);
    setLog((prev) => [...prev.slice(-4), "P-03  Cue talent — ribbon mic"]);
  }

  function callCam(id: CamId) {
    setCamHot(id);
    const cam = CAMERAS.find((item) => item.id === id);
    if (!cam) return;
    setLog((prev) => [...prev.slice(-4), cam.call]);
    const idx = MOVES.findIndex((item) => item.cam === id);
    if (idx >= 0) setMove(idx);
  }

  const near = nearestRadio(box.freq);
  const locked = box.merged || near.dist <= LOCK_KHZ;
  const hot = box.merged ? "all" : locked ? near.radio.id : null;
  const script = scriptFor(box);
  const moveLine = MOVES[move]?.line ?? MOVES[0].line;
  const ghost = box.merged ? "MERGE" : (GHOSTS[move % GHOSTS.length] ?? "STAND BY");
  const freqLabel = `${Math.round(box.freq)} KC`;
  const tuneText = box.merged
    ? "Dial locked. The four cabinets are one groove."
    : locked
      ? `${freqLabel}, ${near.radio.call} ${near.radio.title}`
      : `${freqLabel}, between stations`;

  return (
    <main ref={stageRef} className={box.powered ? "stage is-live" : "stage"}>
      <header className="topbar">
        <div className="tally">
          <span className="lamp" aria-hidden="true" />
          <span>{box.powered ? "On air" : "Rehearsal"}</span>
        </div>
        <div className="brand">
          <h1>The Merged Box</h1>
          <p>1931 — 1956 · one floor</p>
        </div>
        <time className="clock" dateTime={clock}>
          {clock}
        </time>
      </header>

      <section className="sky" aria-label="Newsroom and business floor">
        <div className="sky-photo" />
        <div className="wash left" aria-hidden="true">
          {[...CAMERA_WASH, ...CAMERA_WASH].map((line, i) => (
            <span key={`c-${i}`}>{line}</span>
          ))}
        </div>
        <div className="wash right" aria-hidden="true">
          {[...BUSINESS_WASH, ...BUSINESS_WASH].map((line, i) => (
            <span key={`b-${i}`}>{line}</span>
          ))}
        </div>
        <p className="ghost" aria-hidden="true">
          {ghost}
        </p>

        <div className="floor">
          <div className="panel">
            <p className="kicker">Camera floor</p>
            <div className="finders">
              {CAMERAS.map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  className={camHot === cam.id ? "finder hot" : "finder"}
                  data-shot={cam.shot}
                  onClick={() => callCam(cam.id)}
                  aria-pressed={camHot === cam.id}
                >
                  <span className="glass" aria-hidden="true" />
                  <span className="finder-meta">
                    <span>{cam.id}</span>
                    <span>{cam.op}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="move">{moveLine}</p>
            <p className="move proto-now">{log[log.length - 1]}</p>
          </div>

          <article className="paper script">
            <p className="kicker">
              {script.desk} · {script.call}
            </p>
            <h2>{script.title}</h2>
            <p>{script.line}</p>
          </article>

          <div className="paper book">
            <p className="kicker">Floor book</p>
            <ol aria-live="polite">
              {log.map((line, i) => (
                <li key={`${line}-${i}`}>{line}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="dock" aria-label="Merged radio cabinet">
        <div className="cabinet">
          <div className="cab-top">
            <p className="kicker">Four old boxes · ganged</p>
            <div className="tubes" aria-hidden="true">
              <span className="tube" />
              <span className="tube" />
              <span className="tube" />
            </div>
          </div>

          <div className="face-speaker">
            <div className={box.merged ? "faces merged" : "faces"}>
              {RADIOS.map((radio) => (
                <button
                  key={radio.id}
                  type="button"
                  className={hot === "all" || hot === radio.id ? "face hot" : "face"}
                  data-shape={radio.id}
                  onClick={() => pick(radio.freq)}
                  aria-pressed={hot === radio.id || (box.merged && hot === "all")}
                >
                  <span className="arch" aria-hidden="true" />
                  <b>{radio.year}</b>
                  <span>{radio.shape}</span>
                  <span>{radio.call}</span>
                </button>
              ))}
            </div>
            <div className="cloth" aria-hidden="true">
              <div className="bars">
                {Array.from({ length: 9 }, (_, i) => (
                  <i
                    key={i}
                    ref={(node) => {
                      barRefs.current[i] = node;
                    }}
                    style={{ "--h": "0" } as CSSProperties}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="dial-row">
            <div className="dial">
              <div className="scale" style={{ "--p": `${percent(box.freq)}%` } as CSSProperties}>
                <span className="needle" />
                {RADIOS.map((radio) => (
                  <span key={radio.id} className="tick" style={{ left: `${percent(radio.freq)}%` }}>
                    <em>{radio.call}</em>
                  </span>
                ))}
              </div>
              <div className="ends">
                <span>540</span>
                <span>1600 KC</span>
              </div>
            </div>
            <div className="vol">
              <Knob
                label="Tuning"
                value={box.freq}
                min={BAND_MIN}
                max={BAND_MAX}
                travel={280}
                disabled={box.merged}
                valueText={tuneText}
                onChange={tune}
              />
              <span className="vol-label">Tune</span>
            </div>
          </div>

          <div className="controls">
            <button type="button" className={box.powered ? "key primary" : "key"} onClick={togglePower} aria-pressed={box.powered}>
              {box.powered ? "Shut the box" : "Power up"}
            </button>
            <button type="button" className="key" onClick={merge} aria-pressed={box.merged}>
              {box.merged ? "Merged" : "Merge the boxes"}
            </button>
            <button type="button" className="key" onClick={cue}>
              Cue the floor
            </button>
            <div className="vol">
              <Knob
                label="Volume"
                value={box.volume}
                min={0}
                max={1}
                travel={150}
                valueText={`Volume ${Math.round(box.volume * 100)} percent`}
                onChange={(volume) => commit({ volume }, boxRef.current.powered)}
              />
              <span className="vol-label">Vol</span>
            </div>
            <p className="readout" aria-live="polite">
              <strong>{box.merged ? "LOCK" : freqLabel}</strong>
              <span>{box.merged ? "WGRV groove" : locked ? near.radio.title : "Seeking"}</span>
            </p>
          </div>
          <p className="hint">
            {box.merged
              ? "All four are grooving as one. The news desk and the business floor share the wire."
              : box.powered
                ? "Tune a single old cabinet, or merge them until the floor locks."
                : "Open the cabinet. Then merge the oldest boxes into one groove."}
          </p>
        </div>
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[...WIRE, ...WIRE].map((item, i) => (
              <span key={`${item}-${i}`}>{item}</span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  travel,
  onChange,
  disabled,
  valueText,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  travel: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  valueText: string;
}) {
  const drag = useRef<{ y: number; x: number; v: number } | null>(null);
  const t = (value - min) / (max - min);
  const ang = -140 + t * 280;

  function change(next: number) {
    const clamped = Math.min(max, Math.max(min, next));
    onChange(clamped);
  }

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, x: event.clientX, v: value };
  }

  function movePointer(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || disabled) return;
    const dy = drag.current.y - event.clientY;
    const dx = event.clientX - drag.current.x;
    const delta = dy + dx * 0.35;
    change(drag.current.v + (delta / travel) * (max - min));
  }

  function up() {
    drag.current = null;
  }

  function key(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const step = (max - min) / (event.shiftKey ? 12 : 30);
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      change(value + step);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      change(value - step);
    }
  }

  return (
    <button
      type="button"
      className="knob"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      style={{ "--ang": `${ang}deg` } as CSSProperties}
      onPointerDown={down}
      onPointerMove={movePointer}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <span className="spin" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
