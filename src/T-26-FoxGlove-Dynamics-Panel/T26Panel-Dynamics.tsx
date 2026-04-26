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

type SpringIndicatorKey =
  | "FRONT_LEFT"
  | "FRONT_RIGHT"
  | "REAR_LEFT"
  | "REAR_RIGHT"

type WheelSpeedIndicatorKey =
  | "FRONT_LEFT"
  | "FRONT_RIGHT"
  | "REAR_LEFT"
  | "REAR_RIGHT"

type SpringPaths = Record<SpringIndicatorKey, string | undefined>;
type WheelSpeedPaths = Record<WheelSpeedIndicatorKey, string | undefined>;

type PanelState = {
  springPaths: SpringPaths;
  wheelSpeedPaths: WheelSpeedPaths;
};


type BaseIndicatorConfig<TKey extends string> = {
  id: TKey;
  left: number;
  top: number;
};

type SpringIndicatorConfig = BaseIndicatorConfig<SpringIndicatorKey> & {
  label: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
};

type WheelSpeedIndicatorConfig = BaseIndicatorConfig<WheelSpeedIndicatorKey>;

// In case of removing or adding, update this list and the IndicatorKey corresponded to it type above accordingly.
const SPRING_INDICATORS: SpringIndicatorConfig[] = [
  {
    id: "FRONT_LEFT",
    label: "1 - FRONT LEFT",
    left: 25.5,
    top: 80.0,
    labelOffsetX: 0.0,
    labelOffsetY: 10.0,
  },
  {
    id: "FRONT_RIGHT",
    label: "2 - FRONT RIGHT",
    left: 25.5,
    top: 16.0,
    labelOffsetX: 0.0,
    labelOffsetY: -10.0,
  },
  {
    id: "REAR_LEFT",
    label: "4 - REAR LEFT",
    left: 90.0,
    top: 80.0,
    labelOffsetX: 0,
    labelOffsetY: 10.0,
  },
  {
    id: "REAR_RIGHT",
    label: "3 - REAR RIGHT",
    left: 90.0,
    top: 16.0,
    labelOffsetX: 0.0,
    labelOffsetY: -10.0,
  },


];

// In case of removing or adding, update this list and the IndicatorKey corresponded to it type above accordingly.
const WHEEL_SPEED_INDICATORS: WheelSpeedIndicatorConfig[] = [
  {
    id: "FRONT_LEFT",
    left: 34.0,
    top: 85.0,
  },
  {
    id: "FRONT_RIGHT",
    left: 34.0,
    top: 13.0,
  },
  {
    id: "REAR_LEFT",
    left: 80.0,
    top: 85.0,
  },
  {
    id: "REAR_RIGHT",
    left: 80.0,
    top: 13.0,
  },


];

const SPRING_INDICATOR_IDS = new Set<SpringIndicatorKey>(
  SPRING_INDICATORS.map((indicator) => indicator.id),
);
const WHEEL_SPEED_INDICATOR_IDS = new Set<WheelSpeedIndicatorKey>(
  WHEEL_SPEED_INDICATORS.map((indicator) => indicator.id),
);

function normalizePathValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizePaths<TKey extends string>(
  indicators: BaseIndicatorConfig<TKey>[],
  savedPaths?: Partial<Record<TKey, string | undefined>>,
): Record<TKey, string | undefined> {
  const normalized = {} as Record<TKey, string | undefined>;
  for (const indicator of indicators) {
    normalized[indicator.id] = normalizePathValue(savedPaths?.[indicator.id]);
  }
  return normalized;
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

function readNumericValue(message: unknown, dataPath?: string): number | undefined {
  let value = message;

  if (dataPath) {
    // Walk nested message fields from the settings path after the topic.
    for (const segment of dataPath.split(".")) {
      if (value == undefined || typeof value !== "object") {
        return undefined;
      }
      value = (value as Record<string, unknown>)[segment];
    }
  }

  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (value === "0" || value === "1") {
    return Number(value);
  }

  return undefined;
}

// requestAnimationFrame (rAF) = browser's built-in way of saying "call this function right before the next screen repaint"
function WheelSpeedIndicator({
  indicator,
  value,
}: {
  indicator: WheelSpeedIndicatorConfig;
  value: number | undefined;
}): ReactElement {
  const hasData = value !== undefined;
  const [displayMs, setDisplayMs] = useState<number>(value ?? 0);
  const animRef = useRef<number | undefined>(undefined);
  const prevMsRef = useRef<number>(value ?? 0);

  useEffect(() => {
    if (value === undefined) return;
    const from = prevMsRef.current;
    const to = value;
    const duration = 300; // ms
    const start = performance.now(); // capture when animation begins
    if (animRef.current !== undefined) {
      cancelAnimationFrame(animRef.current); // cancel any ongoing animation to start fresh
    }
    const animate = (now: number) => {
      const elapsed = now - start; // how many ms(miliseconds) have passed since animation started
      const progress = Math.min(elapsed / duration, 1); // 0.0 → 1.0, clamped so it never exceeds 1
      // ease-out cubic easing function for a smoother transition (starts fast, ends slow)
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayMs(from + (to - from) * eased);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate); // schedule next frame
      } else {
        prevMsRef.current = to;
      }
    };
    animRef.current = requestAnimationFrame(animate); // start the animation loop
    return () => {
      if (animRef.current !== undefined) cancelAnimationFrame(animRef.current); // clean up on unmount or before next animation
    };
  }, [value]);

  const displayKmh = displayMs * 3.6; // derive km/h from animated m/s

  const color = !hasData
    ? "#8a8f98" // Gray ( no data )
    : value! > 0
      ? "#4CAF50" // Green ( positive speed )
      : value! < 0
        ? "#EF5350" //  Red ( negative speed, if ever happens )
        : "#8a8f98"; // Gray ( zero speed)

  return (
    <div
      style={{
        position: "absolute",
        left: `${indicator.left}%`,
        top: `${indicator.top}%`,
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        zIndex: 2,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 700,
          lineHeight: 1,
          color,
          transition: "color 0.3s ease", // For smooth color transition
        }}
      >
        {hasData ? `${displayKmh.toFixed(1)} km/h (${displayMs.toFixed(1)} m/s)` : "— km/h"}
      </div>
    </div>
  );
}

function SpringIndicator({
  indicator,
  value,
}: {
  indicator: SpringIndicatorConfig;
  value: number | undefined;
}): ReactElement {
  const MAX = 100;
  const mm = value ?? 0;
  const hasData = value !== undefined;
  const pct = Math.min(Math.abs(mm) / MAX, 1) * 50; // 50% = half the bar
  // If negative fills from center to the top
  // If positive fills from center to the bottom

  const labelLeft = indicator.left + (indicator.labelOffsetX ?? 0);
  const labelTop = indicator.top + (indicator.labelOffsetY ?? 0);

  const fillColor = !hasData ? "#8a8f98" : mm < 0 ? "#EF5350" : "#4CAF50";

  return (
    <>
      {/* Bar */}
      <div
        title={`${indicator.label}: ${hasData ? `${mm.toFixed(1)} mm` : "No data"}`}
        style={{
          position: "absolute",
          left: `${indicator.left}%`,
          top: `${indicator.top}%`,
          transform: "translate(-50%, -50%) rotate(90deg)",
          pointerEvents: "auto",
          zIndex: 2,
          width: "100px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
        }}
      >
        {/* Value readout */}
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: hasData ? fillColor : "#8a8f98",
            lineHeight: 1,
          }}
        >
          {hasData ? `${mm > 0 ? "+" : ""}${mm.toFixed(1)} mm` : "— mm"}
        </div>

        {/* Track */}
        <div
          style={{
            width: "100%",
            height: "30px",
            // borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Negative fill (left half) */}
          <div
            style={{
              position: "absolute",
              right: "50%",
              top: 0,
              height: "100%",
              width: mm < 0 ? `${pct}%` : "0%",
              backgroundColor: fillColor,
              // borderRadius: "999px 0 0 999px",
              transition: "width 0.5s ease",
            }}
          />
          {/* Positive fill (right half) */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              height: "100%",
              width: mm > 0 ? `${pct}%` : "0%",
              backgroundColor: fillColor,
              // borderRadius: "0 999px 999px 0",
              transition: "width 0.5s ease", // to Transit smoothly 
            }}
          />
          {/* Center line */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              width: "2px",
              height: "100%",
              backgroundColor: "rgba(255,255,255,0.5)",
              transform: "translateX(-50%)",
            }}
          />
        </div>
      </div>

      {/* Label */}
      <div
        style={{
          position: "absolute",
          left: `${labelLeft}%`,
          top: `${labelTop}%`,
          transform: "translate(-50%, -50%)",
          padding: "3px 8px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.2)",
          backgroundColor: "rgba(18, 18, 18, 0.76)",
          color: "white",
          fontSize: "12px",
          fontWeight: 800,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        {indicator.label}
      </div>
    </>
  );
}

function T26DynamicsPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [latestMessages, setLatestMessages] = useState<Record<string, unknown>>({});
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const frameHostRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [state, setState] = useState<PanelState>(() => {
    const saved = context.initialState as Partial<PanelState> | undefined;
    return {
      springPaths: normalizePaths(SPRING_INDICATORS, saved?.springPaths),
      wheelSpeedPaths: normalizePaths(WHEEL_SPEED_INDICATORS, saved?.wheelSpeedPaths),
    };
  });

  useEffect(() => {
    const springFields: Record<string, { label: string; input: "messagepath"; value: string | undefined }> = {};
    for (const indicator of SPRING_INDICATORS) {
      springFields[indicator.id] = {
        label: indicator.label,
        input: "messagepath",
        value: state.springPaths[indicator.id],
      };
    }

    const wheelSpeedFields: Record<string, { label: string; input: "messagepath"; value: string | undefined }> = {};
    for (const indicator of WHEEL_SPEED_INDICATORS) {
      wheelSpeedFields[indicator.id] = {
        label: indicator.id,
        input: "messagepath",
        value: state.wheelSpeedPaths[indicator.id],
      };
    }

    context.updatePanelSettingsEditor({
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action !== "update") {
          return;
        }

        const [section, indicatorId] = action.payload.path;
        if (typeof indicatorId !== "string") {
          return;
        }

        const value = normalizePathValue(action.payload.value);

        if (section === "springs") {
          const key = indicatorId as SpringIndicatorKey;
          if (!SPRING_INDICATOR_IDS.has(key)) return;
          setState((prev) => ({
            ...prev,
            springPaths: { ...prev.springPaths, [key]: value },
          }));
        } else if (section === "wheelSpeeds") {
          const key = indicatorId as WheelSpeedIndicatorKey;
          if (!WHEEL_SPEED_INDICATOR_IDS.has(key)) return;
          setState((prev) => ({
            ...prev,
            wheelSpeedPaths: { ...prev.wheelSpeedPaths, [key]: value },
          }));
        }
      },
      nodes: {
        springs: {
          label: "Spring Paths",
          fields: springFields,
        },
        wheelSpeeds: {
          label: "Wheel Speed Paths",
          fields: wheelSpeedFields,
        },
      },
    });
  }, [context, state.springPaths, state.wheelSpeedPaths]);

  useEffect(() => {
    context.saveState(state);
  }, [context, state]);

  useEffect(() => {
    context.saveState(state);
  }, [context, state]);

  useLayoutEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      const currentFrame = renderState.currentFrame;
      if (!currentFrame || currentFrame.length === 0) {
        return;
      }

      setLatestMessages((prev) => {
        const next = { ...prev };
        for (const message of currentFrame) {
          next[message.topic] = message.message;
        }
        return next;
      });
    };

    context.watch("currentFrame");
  }, [context]);

  useLayoutEffect(() => {
    const topics = new Set<string>();

    for (const indicator of SPRING_INDICATORS) {
      const topic = parseMessagePath(state.springPaths[indicator.id])?.topic;
      if (topic) topics.add(topic);
    }

    for (const indicator of WHEEL_SPEED_INDICATORS) {
      const topic = parseMessagePath(state.wheelSpeedPaths[indicator.id])?.topic;
      if (topic) topics.add(topic);
    }

    context.subscribe(Array.from(topics, (topic) => ({ topic })));
  }, [context, state.springPaths, state.wheelSpeedPaths]);

  useLayoutEffect(() => {
    const frameHost = frameHostRef.current;
    if (!frameHost) {
      return;
    }

    const updateFrameSize = () => {
      const { width: availableWidth, height: availableHeight } = frameHost.getBoundingClientRect();
      if (availableWidth <= 0 || availableHeight <= 0) {
        return;
      }

      const nextScale = Math.min(availableWidth / STAGE_WIDTH, availableHeight / STAGE_HEIGHT);
      setStageScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
    };

    updateFrameSize();

    const resizeObserver = new ResizeObserver(updateFrameSize);
    resizeObserver.observe(frameHost);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    // Foxglove expects done() after each render callback cycle.
    renderDone?.();
  }, [renderDone]);

  const scaledStageWidth = STAGE_WIDTH * stageScale;
  const scaledStageHeight = STAGE_HEIGHT * stageScale;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        padding: "clamp(0.25rem, 1vw, 0.75rem)",
        boxSizing: "border-box",
        backgroundColor: "var(--panel-background, transparent)",
      }}
    >
      <div
        ref={frameHostRef}
        style={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: `${scaledStageWidth}px`,
            height: `${scaledStageHeight}px`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              width: `${STAGE_WIDTH}px`,
              height: `${STAGE_HEIGHT}px`,
              transform: `scale(${stageScale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `${STAGE_PADDING_X}px`,
                top: `${STAGE_PADDING_Y}px`,
                width: `${CAR_IMAGE_WIDTH}px`,
                height: `${CAR_IMAGE_HEIGHT}px`,
                overflow: "visible",
              }}
            >
              <img
                src={carImage}
                alt="T26"
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  transform: "scale(-1, -1)",
                }}
              />

              {SPRING_INDICATORS.map((indicator) => {
                const messagePath = parseMessagePath(state.springPaths[indicator.id]);
                const value = messagePath
                  ? readNumericValue(latestMessages[messagePath.topic], messagePath.dataPath)
                  : undefined;

                return <SpringIndicator key={indicator.id} indicator={indicator} value={value} />;
              })}

              {WHEEL_SPEED_INDICATORS.map((indicator) => {
                const messagePath = parseMessagePath(state.wheelSpeedPaths[indicator.id]);
                const value = messagePath
                  ? readNumericValue(latestMessages[messagePath.topic], messagePath.dataPath)
                  : undefined;

                return <WheelSpeedIndicator key={indicator.id} indicator={indicator} value={value} />;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function initT26DynamicsPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<T26DynamicsPanel context={context} />);

  return () => {
    root.unmount();
  };
}
