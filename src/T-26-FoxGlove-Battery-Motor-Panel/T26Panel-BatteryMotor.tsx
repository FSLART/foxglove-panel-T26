/* eslint-disable*/

import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { ReactElement, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createRoot } from "react-dom/client";
import { carImage } from "../Images/Base64/carImage";

const CAR_IMAGE_WIDTH = 1096;
const CAR_IMAGE_HEIGHT = 681;
const STAGE_PADDING_X = 56;
const STAGE_PADDING_Y = 24;
const STAGE_WIDTH = CAR_IMAGE_WIDTH + STAGE_PADDING_X * 2;
const STAGE_HEIGHT = CAR_IMAGE_HEIGHT + STAGE_PADDING_Y * 2;

// type BatteryIndicatorKey = "BATTERY_TEMPERATURE" | "BATTERY_POWER" | "BATTERY_PERCENTAGE";

// type MotorIndicatorKey = "RIGHT_MOTOR_TEMPERATURE" | "RIGHT_MOTOR_REAL_CURRENT" | "RIGHT_MOTOR_ASKED_CURRENT" | "LEFT_MOTOR_TEMPERATURE" | "LEFT_MOTOR_REAL_CURRENT" | "LEFT_MOTOR_ASKED_CURRENT" | "BATTERY_TENSION";

type MotorFieldPaths = {
  temperature: string | undefined;
  realCurrent: string | undefined;
  askedCurrent: string | undefined;
 
};

type BatteryFieldPaths = {
  temperature: string | undefined;
  power: string | undefined;
  percentage: string | undefined;
   batteryTension: string | undefined;
};

type PanelState = {
  leftMotorPaths: MotorFieldPaths;
  rightMotorPaths: MotorFieldPaths;
  batteryPaths: BatteryFieldPaths;
};

type BaseIndicatorConfig<TKey extends string> = {
  id: TKey;
  left: number;
  top: number;
};

type MotorType = "LEFT_MOTOR" | "RIGHT_MOTOR";
type BatteryType = "BATTERY";

type MotorIndicatorConfig = BaseIndicatorConfig<MotorType> & {
  label: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
};

type BatteryIndicatorConfig = BaseIndicatorConfig<BatteryType>;

// In case of removing or adding, update this list and the IndicatorKey corresponded to it type above accordingly.
const BATTERY_INDICATORS: BatteryIndicatorConfig[] = [
  {
    id: "BATTERY",
    left: 60.0,
    top: 0.0,
  },

];

// In case of removing or adding, update this list and the IndicatorKey corresponded to it type above accordingly.
const MOTOR_INDICATORS: MotorIndicatorConfig[] = [
  {
    id: "LEFT_MOTOR",
    label: "Left Motor",
    left: 80.0,
    top: 62.5,
    labelOffsetX: -40.0,
    labelOffsetY: 150.0,
  },

  {
    id: "RIGHT_MOTOR",
    label: "Right Motor",
    left: 80.0,
    top: 35.0,
    labelOffsetX: -40.0,
    labelOffsetY: -30.0,
  },
];

// const BATTERY_INDICATOR_IDS = new Set<BatteryType>(
//   BATTERY_INDICATORS.map((indicator) => indicator.id),
// );
// const MOTOR_INDICATOR_IDS = new Set<MotorType>(
//   MOTOR_INDICATORS.map((indicator) => indicator.id),
// );

function normalizePathValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizeMotorFieldPaths(saved?: Partial<MotorFieldPaths>): MotorFieldPaths {
  return {
    temperature: normalizePathValue(saved?.temperature),
    realCurrent: normalizePathValue(saved?.realCurrent),
    askedCurrent: normalizePathValue(saved?.askedCurrent),
    
  };
}

function normalizeBatteryFieldPaths(saved?: Partial<BatteryFieldPaths>): BatteryFieldPaths {
  return {
    temperature: normalizePathValue(saved?.temperature),
    power: normalizePathValue(saved?.power),
    percentage: normalizePathValue(saved?.percentage),
    batteryTension: normalizePathValue(saved?.batteryTension),
  };
}

function parseMessagePath(messagePath?: string): { topic: string; dataPath?: string } | undefined {
  const trimmedPath = messagePath?.trim();
  if (!trimmedPath) {
    return undefined;
  }

  // Message path format: "/topic.optional.nested.field"
  const [topic, ...dataPathParts] = trimmedPath.split(".");
  if (!topic) {
    return undefined;
  }

  const dataPath = dataPathParts.join(".");
  return dataPath ? { topic, dataPath } : { topic };
}

// Walks dataPath segments into the message and returns the final numeric value.
// e.g. message = { LEFT_MOTOR: { temperature: 30 } }, dataPath = "LEFT_MOTOR.temperature" → 30
function readNumericValue(
  latestMessages: Record<string, unknown>,
  path: string | undefined,
): number | undefined {
  const parsed = parseMessagePath(path);
  if (!parsed) return undefined;

  let value: unknown = latestMessages[parsed.topic];
  if (parsed.dataPath) {
    for (const segment of parsed.dataPath.split(".")) {
      if (value == null || typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[segment];
    }
  }

  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
}

type BatteryValue = { temperature: number; power: number; percentage: number; batteryTension: number ;};
type MotorValue = { temperature: number; askedCurrent: number; realCurrent: number;};

function readBatteryValue(
  latestMessages: Record<string, unknown>,
  paths: BatteryFieldPaths,
): BatteryValue | undefined {
  const temperature = readNumericValue(latestMessages, paths.temperature);
  const power = readNumericValue(latestMessages, paths.power);
  const percentage = readNumericValue(latestMessages, paths.percentage);
  const batteryTension = readNumericValue(latestMessages, paths.batteryTension);
  if (temperature === undefined || power === undefined || percentage === undefined || batteryTension === undefined) return undefined;
  return { temperature, power, percentage, batteryTension };
}

function readMotorValue(
  latestMessages: Record<string, unknown>,
  paths: MotorFieldPaths,
): MotorValue | undefined {
  const temperature = readNumericValue(latestMessages, paths.temperature);
  const realCurrent = readNumericValue(latestMessages, paths.realCurrent);
  const askedCurrent = readNumericValue(latestMessages, paths.askedCurrent);
  
  if (
    temperature === undefined ||
    realCurrent === undefined ||
    askedCurrent === undefined 
  ) return undefined;
  return { temperature, askedCurrent, realCurrent};
}
/* ── Tooltip helper ─────────────────────────────────────────────────────
   Wraps any element and shows a dark floating label on hover.
   Uses pure inline styles — no CSS modules or extra deps needed.
──────────────────────────────────────────────────────────────────────── */
/* ── Tooltip helper ─────────────────────────────────────────────────────
   Generic hover tooltip. Accepts an optional `style` prop so the wrapper
   div can be sized correctly by the caller (e.g. width: "100%" for bars).
──────────────────────────────────────────────────────────────────────── */
function Tooltip({
  text,
  children,
  style,
}: {
  text: string;
  children: ReactElement;
  style?: React.CSSProperties;
}): ReactElement {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(20,20,20,0.95)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#ddd",
          fontSize: 11,
          fontWeight: 400,
          borderRadius: 6,
          padding: "5px 9px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 99,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {text}
          <div style={{
            position: "absolute",
            top: "100%", left: "50%",
            transform: "translateX(-50%)",
            borderWidth: "4px 4px 0",
            borderStyle: "solid",
            borderColor: "rgba(20,20,20,0.95) transparent transparent",
          }} />
        </div>
      )}
    </div>
  );
}

// Need for of the object received


function MotorIndicator({
  indicator, value, batteryTension
}: {
  indicator: MotorIndicatorConfig; value: MotorValue | undefined;batteryTension: number | undefined;
}): ReactElement {
  const hasData = value !== undefined;
  const tmp = value?.temperature ?? 0;
  const askedCurrent = value?.askedCurrent ?? 0;
  const realCurrent = value?.realCurrent ?? 0;
  const resolvedTension = batteryTension ?? 0;
  const realPow = realCurrent * resolvedTension ;
  const askedPow = askedCurrent * resolvedTension;
  const MAX_POW = 50000;
  const realFrac = Math.min(Math.max(realPow / MAX_POW, 0), 1);
  const askedFrac = Math.min(Math.max(askedPow / MAX_POW, 0), 1);
  const maxAmps = MAX_POW / (resolvedTension || 1);

  const getTmpColor = (t: number) => t > 55 ? "#D85A30" : t > 50 ? "#EF9F27" : "#4CAF50";
  const tmpColor = getTmpColor(tmp);
  const powRatio = realPow / MAX_POW;

  const powColor =
    powRatio > 0.9 ? "#D85A30" :   // danger (90%+)
      powRatio > 0.7 ? "#EF9F27" :   // warning (70%+)
        "#4CAF50";                     // safe
  const tmpStatus = tmp > 55 ? "Overheating" : tmp > 50 ? "Hot" : tmp < 15 ? "Cold" : "Normal";
  const thermH = Math.round(26 * Math.min(Math.max((tmp - 10) / 70, 0), 1));

  return (
    <div style={{ position: "absolute", left: `${indicator.left}%`, top: `${indicator.top}%`, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 2, pointerEvents: "auto" }}>
      <div style={{ position: "absolute", left: `calc(45% + ${indicator.labelOffsetX ?? 0}px)`, top: `${indicator.labelOffsetY ?? 0}px`, fontSize: 12, fontWeight: 800, color: "white", backgroundColor: "rgba(18,18,18,0.76)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
        {indicator.label}
      </div>
      <div style={{ backgroundColor: "rgba(18,18,18,0.76)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
        {/* Temperature */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="42" viewBox="0 0 18 42">
            <rect x="6" y="2" width="6" height="22" rx="3" fill="#444" />
            <rect x="7.5" y={24 - thermH} width="3" height={thermH} rx="1.5" fill={hasData ? tmpColor : "#8a8f98"} />
            <circle cx="9" cy="34" r="6" fill="#444" />
            <circle cx="9" cy="34" r="4" fill={hasData ? tmpColor : "#8a8f98"} />
          </svg>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: hasData ? tmpColor : "#8a8f98", lineHeight: 1 }}>{hasData ? `${tmp.toFixed(1)}°C` : "—°C"}</div>
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{hasData ? tmpStatus : "No data"}</div>
          </div>
        </div>
        {/* Power */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="28" viewBox="0 0 18 28"><polygon points="14,0 4,14 9,14 4,28 16,12 10,12" fill={hasData ? powColor : "#8a8f98"} /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <Tooltip text="Real power — currently delivered by the motor"><span style={{ fontSize: 15, fontWeight: 700, color: hasData ? powColor : "#8a8f98", lineHeight: 1 }}>{hasData ? `${(realPow * 0.001).toFixed(1)} kW` : "— kW"}</span></Tooltip>
              <Tooltip text="Asked power — requested by the controller"><span style={{ fontSize: 10, color: "#aaa", alignSelf: "flex-end" }}>{hasData ? `↑${(askedPow * 0.001).toFixed(1)} kW` : ""}</span></Tooltip>
            </div>
            <Tooltip text="Bar = real power · White tick = asked power · Gap means underdelivering" style={{ width: "100%" }}>
              <div style={{ position: "relative", height: 6, borderRadius: 3, background: "#333", width: "100%" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${realFrac * 100}%`, borderRadius: 3, background: hasData ? powColor : "#555", transition: "width 0.15s ease" }} />
                {hasData && <div style={{ position: "absolute", left: `${askedFrac * 100}%`, top: -2, bottom: -2, width: 2, borderRadius: 1, background: "white", transform: "translateX(-50%)", boxShadow: "0 0 3px rgba(255,255,255,0.6)" }} />}
              </div>
            </Tooltip>
          </div>
        </div>
        {/* Current */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="28" viewBox="0 0 18 28"><path d="M1 14 Q4 6 7 14 Q10 22 13 14 Q16 6 18 14" fill="none" stroke={hasData ? (realCurrent > 18 ? "#D85A30" : "#4CAF50") : "#8a8f98"} strokeWidth="2" strokeLinecap="round" /></svg>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <Tooltip text="Real current — actually drawn by the motor"><span style={{ fontSize: 15, fontWeight: 700, color: hasData ? (realCurrent > 18 ? "#D85A30" : "#4CAF50") : "#8a8f98", lineHeight: 1 }}>{hasData ? `${realCurrent.toFixed(1)} A` : "— A"}</span></Tooltip>
              <Tooltip text="Asked current — requested by the controller"><span style={{ fontSize: 10, color: "#aaa", alignSelf: "flex-end" }}>{hasData ? `↑${askedCurrent.toFixed(1)} A` : ""}</span></Tooltip>
            </div>
            <Tooltip text="Bar = real current · White tick = asked current · Gap means underdelivering" style={{ width: "100%" }}>
              <div style={{ position: "relative", height: 6, borderRadius: 3, background: "#333", width: "100%" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(Math.max(realCurrent / maxAmps, 0), 1) * 100}%`, borderRadius: 3, background: hasData ? (realCurrent > 18 ? "#D85A30" : "#4CAF50") : "#555", transition: "width 0.15s ease" }} />
                {hasData && <div style={{ position: "absolute", left: `${Math.min(Math.max(askedCurrent / maxAmps, 0), 1) * 100}%`, top: -2, bottom: -2, width: 2, borderRadius: 1, background: "white", transform: "translateX(-50%)", boxShadow: "0 0 3px rgba(255,255,255,0.6)" }} />}
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}


function BatteryIndicator({
  indicator, value,
}: {
  indicator: BatteryIndicatorConfig; value: BatteryValue | undefined;
}): ReactElement {
  const hasData = value !== undefined;
  const pct = value?.percentage ?? 0;
  const tmp = value?.temperature ?? 0;
  let pow = value?.power ?? 0 ;
  pow = pow * 0.001;
  const batColor = tmp > 55 ? "#D85A30" : pct <= 20 ? "#E24B4A" : pct <= 50 ? "#EF9F27" : "#4CAF50";
  const tmpColor = tmp > 55 ? "#D85A30" : tmp > 45 ? "#EF9F27" : "#4CAF50";
  const tmpStatus = tmp > 55 ? "Overheating" : tmp > 50 ? "Hot" : tmp < 15 ? "Cold" : "Normal";
  const thermH = Math.round(16 * Math.min(Math.max((tmp - 10) / 70, 0), 1));
  const clampedPct = Math.min(Math.max(pct, 0), 100);
  const pctStatus = clampedPct <= 10 ? "Critical" : clampedPct <= 20 ? "Low" : clampedPct <= 50 ? "Moderate" : "Normal";
  const fillW = Math.round((125 * clampedPct) / 100);
  const noData = "#8a8f98";
  const clipId = `pct-clip-${indicator.id}`;

  return (
    <div style={{ background: "rgba(18,18,18,0.76)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "5px 8px", position: "absolute", left: `${indicator.left}%`, top: `calc(50% + ${indicator.top}px)`, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, zIndex: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <svg width="24" height="48" viewBox="0 0 14 32">
          <rect x="4" y="1" width="6" height="18" rx="3" fill="#444" />
          <rect x="5.5" y={19 - thermH} width="3" height={thermH} rx="1.5" fill={hasData ? tmpColor : noData} />
          <circle cx="7" cy="26" r="5" fill="#444" />
          <circle cx="7" cy="26" r="3" fill={hasData ? tmpColor : noData} />
        </svg>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: hasData ? tmpColor : noData, lineHeight: 1 }}>{hasData ? `${tmp.toFixed(1)}°C` : "—°C"}</div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{hasData ? tmpStatus : "No data"}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
        <svg width="11" height="18" viewBox="0 0 18 28"><polygon points="14,0 4,14 9,14 4,28 16,12 10,12" fill={hasData ? batColor : noData} /></svg>
        <div style={{ fontSize: 12, fontWeight: 700, color: hasData ? batColor : noData, lineHeight: 1 }}>{hasData ? `${pow.toFixed(1)} kW` : "— kW"}</div>
      </div>
      <svg width="100" height="35" viewBox="0 0 135 50">
        <rect x="2" y="5" width="125" height="40" rx="6" fill="none" stroke={hasData ? batColor : noData} strokeWidth="2.5" />
        <defs><clipPath id={clipId}><rect x="2" y="5" width="125" height="40" rx="6" /></clipPath></defs>
        <rect x="2" y="5" width={fillW} height="40" fill={hasData ? batColor : noData} clipPath={`url(#${clipId})`} />
        <text x="64" y="26" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="700" fill="white" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.5)", strokeWidth: 2, strokeLinejoin: "round" as const }}>{hasData ? `${clampedPct.toFixed(0)}%` : "—%"}</text>
        <text x="64" y="38" textAnchor="middle" fontSize="8" fill="white" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.4)", strokeWidth: 1.5 }}>{hasData ? pctStatus : "No data"}</text>
      </svg>
    </div>
  );
}

function motorSettingsFields(paths: MotorFieldPaths): Record<string, { label: string; input: "messagepath"; value: string | undefined }> {
  return {
    temperature: { label: "Temperature", input: "messagepath", value: paths.temperature },
    realCurrent: { label: "Real Current", input: "messagepath", value: paths.realCurrent },
    askedCurrent: { label: "Asked Current", input: "messagepath", value: paths.askedCurrent },
  };
}

function T26BatteryMotorPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [latestMessages, setLatestMessages] = useState<Record<string, unknown>>({});
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const frameHostRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);

  const [state, setState] = useState<PanelState>(() => {
    const saved = context.initialState as Partial<PanelState> | undefined;
    return {
      leftMotorPaths: normalizeMotorFieldPaths(saved?.leftMotorPaths),
      rightMotorPaths: normalizeMotorFieldPaths(saved?.rightMotorPaths),
      batteryPaths: normalizeBatteryFieldPaths(saved?.batteryPaths),
    };
  });

  // Map each motor indicator to its paths object
  const motorPathsFor = (id: MotorType): MotorFieldPaths =>
    id === "LEFT_MOTOR" ? state.leftMotorPaths : state.rightMotorPaths;

  // ── Settings ────────────────────────────────────────────────────────────────
  useEffect(() => {
    context.updatePanelSettingsEditor({
      // ── Settings action handler ───────────────────────────────────────────────
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action !== "update") return;
        const [section, field] = action.payload.path;
        const value = normalizePathValue(action.payload.value);

        if (section === "leftMotorPaths") {
          const key = field as keyof MotorFieldPaths;
          if (!(key in state.leftMotorPaths)) return;
          setState((prev) => ({ ...prev, leftMotorPaths: { ...prev.leftMotorPaths, [key]: value } }));
        } else if (section === "rightMotorPaths") {
          const key = field as keyof MotorFieldPaths;
          if (!(key in state.rightMotorPaths)) return;
          setState((prev) => ({ ...prev, rightMotorPaths: { ...prev.rightMotorPaths, [key]: value } }));
        } else if (section === "batteryPaths") {
          const key = field as keyof BatteryFieldPaths;
          if (!(key in state.batteryPaths)) return;
          setState((prev) => ({ ...prev, batteryPaths: { ...prev.batteryPaths, [key]: value } }));
        }
      },
      nodes: {
        batteryPaths: {
          label: "Battery",
          fields: {
            temperature: { label: "Temperature", input: "messagepath", value: state.batteryPaths.temperature },
            power: { label: "Power", input: "messagepath", value: state.batteryPaths.power },
            percentage: { label: "Percentage", input: "messagepath", value: state.batteryPaths.percentage },
            batteryTension: { label: "Battery Tension", input: "messagepath", value: state.batteryPaths.batteryTension },
          },
        },
        leftMotorPaths: {
          label: "Left Motor",
          fields: motorSettingsFields(state.leftMotorPaths),
        },
        rightMotorPaths: {
          label: "Right Motor",
          fields: motorSettingsFields(state.rightMotorPaths),
        },
      },
    });
  }, [context, state.leftMotorPaths, state.rightMotorPaths, state.batteryPaths]);

  useEffect(() => { context.saveState(state); }, [context, state]);

  // ── Render callback ──────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      const currentFrame = renderState.currentFrame;
      if (!currentFrame || currentFrame.length === 0) return;
      setLatestMessages((prev) => {
        const next = { ...prev };
        for (const message of currentFrame) next[message.topic] = message.message;
        return next;
      });
    };
    context.watch("currentFrame");
  }, [context]);

  // ── Topic subscriptions ──────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const topics = new Set<string>();
    const addPath = (path: string | undefined) => {
      const topic = parseMessagePath(path)?.topic;
      if (topic) topics.add(topic);
    };

    // ── Topic subscriptions ──────────────────────────────────────────────────
    const allPaths: (string | undefined)[] = [
      ...Object.values(state.batteryPaths),
      ...Object.values(state.leftMotorPaths),
      ...Object.values(state.rightMotorPaths),
    ];
    for (const path of allPaths) addPath(path);

    context.subscribe(Array.from(topics, (topic) => ({ topic })));
  }, [context, state.leftMotorPaths, state.rightMotorPaths, state.batteryPaths]);

  // ── Stage scaling ────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const frameHost = frameHostRef.current;
    if (!frameHost) return;
    const update = () => {
      const { width, height } = frameHost.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const next = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
      setStageScale((prev) => Math.abs(prev - next) < 0.001 ? prev : next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(frameHost);
    return () => { ro.disconnect(); };
  }, []);

  useEffect(() => { renderDone?.(); }, [renderDone]);

  const scaledW = STAGE_WIDTH * stageScale;
  const scaledH = STAGE_HEIGHT * stageScale;

  const batteryValue = readBatteryValue(latestMessages, state.batteryPaths);
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", minWidth: 0, minHeight: 0, overflow: "hidden", padding: "clamp(0.25rem, 1vw, 0.75rem)", boxSizing: "border-box", backgroundColor: "var(--panel-background, transparent)" }}>
      <div ref={frameHostRef} style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0, overflow: "hidden", display: "grid", placeItems: "center" }}>
        <div style={{ width: `${scaledW}px`, height: `${scaledH}px`, overflow: "hidden" }}>
          <div style={{ position: "relative", width: `${STAGE_WIDTH}px`, height: `${STAGE_HEIGHT}px`, transform: `scale(${stageScale})`, transformOrigin: "top left" }}>
            <div style={{ position: "absolute", left: `${STAGE_PADDING_X}px`, top: `${STAGE_PADDING_Y}px`, width: `${CAR_IMAGE_WIDTH}px`, height: `${CAR_IMAGE_HEIGHT}px`, overflow: "visible" }}>
              <img src={carImage} alt="T26" style={{ width: "100%", height: "100%", display: "block", transform: "scale(-1, -1)" }} />


                
              {BATTERY_INDICATORS.map((indicator) => (
                <BatteryIndicator
                  key={indicator.id}
                  indicator={indicator}
                  value={batteryValue}
                />
              ))}

              {MOTOR_INDICATORS.map((indicator) => (
                <MotorIndicator
                  key={indicator.id}
                  indicator={indicator}
                  value={readMotorValue(latestMessages, motorPathsFor(indicator.id))}
                  batteryTension={batteryValue?.batteryTension}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function initT26BatteryMotorPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<T26BatteryMotorPanel context={context} />);

  return () => {
    root.unmount();
  };
}
