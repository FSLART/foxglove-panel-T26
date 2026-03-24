import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { ReactElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { carImage } from "./carImage";

const CAR_IMAGE_WIDTH = 1096;
const CAR_IMAGE_HEIGHT = 681;
const STAGE_PADDING_X = 56;
const STAGE_PADDING_Y = 24;
const STAGE_WIDTH = CAR_IMAGE_WIDTH + STAGE_PADDING_X * 2;
const STAGE_HEIGHT = CAR_IMAGE_HEIGHT + STAGE_PADDING_Y * 2;

type ShutdownIndicatorKey =
  | "RES"
  | "botsShutdown"
  | "inertiaSwitch"
  | "emergencyPushCockpit"
  | "rightEmergencyButton"
  | "sidePanelInterlock"
  | "leftEmergencyButton"
  | "junctionBoxInterlock"
  | "ACU";

type ShutdownPaths = Record<ShutdownIndicatorKey, string | undefined>;
type PanelState = { paths: ShutdownPaths };

type ShutdownIndicatorConfig = {
  id: ShutdownIndicatorKey;
  label: string;
  left: number;
  top: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
};

// In case of removing or adding shutdowns, update this list and the ShutdownIndicatorKey type above accordingly.
const SHUTDOWN_INDICATORS: ShutdownIndicatorConfig[] = [
  {
    id: "RES",
    label: "1 - RES",
    left: 63.0,
    top: 59.0,
    labelOffsetX: 4.0,
  },
  {
    id: "botsShutdown",
    label: "2 - BOTS",
    left: 14.5,
    top: 48.5,
    labelOffsetY: -4.2,
  },
  {
    id: "inertiaSwitch",
    label: "3 - Inertia Switch",
    left: 37.0,
    top: 42.5,
    labelOffsetY: -4.2,
  },
  {
    id: "emergencyPushCockpit",
    label: "4 - Emergency Cockpit",
    left: 42.5,
    top: 57.0,
    labelOffsetX: -8.0,
  },
  { 
    id: "rightEmergencyButton",
    label: "5 - Right Emergency Button",
    left: 59.5,
    top: 34.0,
    labelOffsetY: -4.2,
  },
  {
    id: "sidePanelInterlock",
    label: "6 -  Side Panel Interlock",
    left: 66.0,
    top: 38.0,
    labelOffsetX: 8.3,
  },
  {
    id: "leftEmergencyButton",
    label: "7 -  Left Emergency Button",
    left: 59.5,
    top: 65.0,
    labelOffsetX: -9.0,
  },
  {
    id: "junctionBoxInterlock",
    label: "8 - Junction Box Interlock",
    left: 70.5,
    top: 49.0,
    labelOffsetX: 8.8,
  },
  {
    id: "ACU",
    label: "9 - ACU",
    left: 63.0,
    top: 53.5,
    labelOffsetX: -4.0,
  },
];

const INDICATOR_IDS = new Set<ShutdownIndicatorKey>(
  SHUTDOWN_INDICATORS.map((indicator) => indicator.id),
);

function normalizePathValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizePaths(savedPaths?: Partial<ShutdownPaths>): ShutdownPaths {
  const normalized = {} as ShutdownPaths;
  for (const indicator of SHUTDOWN_INDICATORS) {
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

function ShutdownIndicator({
  indicator,
  value,
}: {
  indicator: ShutdownIndicatorConfig;
  value: number | undefined;
}): ReactElement {
  const isOpen = value === 1;
  const labelLeft = indicator.left + (indicator.labelOffsetX ?? 0);
  const labelTop = indicator.top + (indicator.labelOffsetY ?? 0);

  return (
    <>
      <div
        title={`${indicator.label}: ${isOpen ? "Circuit opened" : "Inactive or no data"}`}
        style={{
          position: "absolute",
          left: `${indicator.left}%`,
          top: `${indicator.top}%`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "999px",
            border: "2px solid rgba(255, 255, 255, 0.85)",
            boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.35)",
            backgroundColor: isOpen ? "#22c55e" : "#8a8f98",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: `${labelLeft}%`,
          top: `${labelTop}%`,
          transform: "translate(-50%, -50%)",
          padding: "3px 8px",
          borderRadius: "999px",
          backgroundColor: "rgba(18, 18, 18, 0.76)",
          color: "white",
          fontSize: "12px",
          fontWeight: 600,
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

function T26Panel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [latestMessages, setLatestMessages] = useState<Record<string, unknown>>({});
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const frameHostRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [state, setState] = useState<PanelState>(() => {
    const savedPaths = (context.initialState as Partial<PanelState> | undefined)?.paths;
    return { paths: normalizePaths(savedPaths) };
  });

  useEffect(() => {
    const fields: Record<
      string,
      {
        label: string;
        input: "messagepath";
        value: string | undefined;
      }
    > = {};

    for (const indicator of SHUTDOWN_INDICATORS) {
      fields[indicator.id] = {
        label: indicator.label,
        input: "messagepath",
        value: state.paths[indicator.id],
      };
    }

    context.updatePanelSettingsEditor({
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action !== "update" || action.payload.path[0] !== "general") {
          return;
        }

        // Path shape here is: ["general", "<indicator-id>"].
        const indicatorId = action.payload.path[1];
        if (typeof indicatorId !== "string") {
          return;
        }

        const indicatorKey = indicatorId as ShutdownIndicatorKey;
        if (!INDICATOR_IDS.has(indicatorKey)) {
          return;
        }

        const value = normalizePathValue(action.payload.value);
        setState((prev) => ({
          ...prev,
          paths: {
            ...prev.paths,
            [indicatorKey]: value,
          },
        }));
      },
      nodes: {
        general: {
          label: "Shutdown Paths",
          fields,
        },
      },
    });
  }, [context, state.paths]);

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
    // Subscribe once per unique topic even if multiple indicators use it.
    const topics = new Set<string>();
    for (const indicator of SHUTDOWN_INDICATORS) {
      const topic = parseMessagePath(state.paths[indicator.id])?.topic;
      if (topic) {
        topics.add(topic);
      }
    }
    context.subscribe(Array.from(topics, (topic) => ({ topic })));
  }, [context, state.paths]);

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

              {SHUTDOWN_INDICATORS.map((indicator) => {
                const messagePath = parseMessagePath(state.paths[indicator.id]);
                const value = messagePath
                  ? readNumericValue(latestMessages[messagePath.topic], messagePath.dataPath)
                  : undefined;

                return <ShutdownIndicator key={indicator.id} indicator={indicator} value={value} />;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function initT26Panel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<T26Panel context={context} />);

  return () => {
    root.unmount();
  };
}
