import {
  Immutable,
  MessageEvent,
  PanelExtensionContext,
  SettingsTreeAction,
  Topic,
} from "@foxglove/extension";
import { ReactElement, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface PanelState {
  topics?: Array<string | undefined>;
}

function T26Panel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [topics, setTopics] = useState<undefined | Immutable<Topic[]>>();
  const [messages, setMessages] = useState<undefined | Immutable<MessageEvent[]>>();
  const [latestMessages, setLatestMessages] = useState<Record<string, unknown>>({});

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const [state, setState] = useState<PanelState>(() => {
    const saved = context.initialState as PanelState;
    return {
      topics: saved?.topics ?? [],
    };
  });

  const actionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action === "perform-node-action") {
      const { id } = action.payload;
      if (id === "add-topic") {
        setState((prev) => ({ ...prev, topics: [...(prev.topics ?? []), undefined] }));
      }
      if (id.startsWith("remove-topic-")) {
        const index = Number(id.replace("remove-topic-", ""));
        setState((prev) => ({
          ...prev,
          topics: (prev.topics ?? []).filter((_, i) => i !== index),
        }));
      }
      return;
    }

    if (action.action !== "update") {
      return;
    }

    const { path, value } = action.payload;
    if (path[0] === "general" && path[1] === "topics" && path[3] === "topic") {
      const index = Number(String(path[2]).replace("topic-", ""));
      if (!Number.isNaN(index)) {
        setState((prev) => {
          const next = [...(prev.topics ?? [])];
          next[index] = value ? (value as string) : undefined;
          return { ...prev, topics: next };
        });
      }
    }
  }, []);

  useEffect(() => {
    context.saveState(state);

    const topicOptions = (topics ?? []).map((topic) => ({
      value: topic.name,
      label: topic.name,
    }));
    const topicSelectOptions = [{ value: undefined, label: "(none)" }, ...topicOptions];
    const topicNodes: Record<string, any> = {};

    (state.topics ?? []).forEach((topic, index) => {
      topicNodes[`topic-${index}`] = {
        label: `Topic ${index + 1}`,
        actions: [
          {
            type: "action",
            id: `remove-topic-${index}`,
            label: "Remove",
          },
        ],
        fields: {
          topic: {
            label: "Topic",
            input: "select",
            options: topicSelectOptions,
            value: topic,
          },
        },
      };
    });

    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        general: {
          label: "General",
          actions: [
            {
              type: "action",
              id: "add-topic",
              label: "Add topic",
            },
          ],
          children: {
            topics: {
              label: "Topics",
              children: topicNodes,
            },
          },
        },
      },
    });
  }, [actionHandler, context, state, topics]);

  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {
    // The render handler is run by the broader Foxglove system during playback when your panel
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // You can only setup one render handler - usually early on in setting up your panel.
    //
    // Without a render handler your panel will never receive updates.
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    context.onRender = (renderState, done) => {
      // render functions receive a _done_ callback. You MUST call this callback to indicate your panel has finished rendering.
      // Your panel will not receive another render callback until _done_ is called from a prior render. If your panel is not done
      // rendering before the next render call, Foxglove shows a notification to the user that your panel is delayed.
      //
      // Set the done callback into a state variable to trigger a re-render.
      setRenderDone(() => done);

      // We may have new topics - since we are also watching for messages in the current frame, topics may not have changed
      // It is up to you to determine the correct action when state has not changed.
      setTopics(renderState.topics);

      // currentFrame has messages on subscribed topics since the last render call
      setMessages(renderState.currentFrame);
    };

    // After adding a render handler, you must indicate which fields from RenderState will trigger updates.
    // If you do not watch any fields then your panel will never render since the panel context will assume you do not want any updates.

    // tell the panel context that we care about any update to the _topic_ field of RenderState
    context.watch("topics");

    // tell the panel context we want messages for the current frame for topics we've subscribed to
    // This corresponds to the _currentFrame_ field of render state.
    context.watch("currentFrame");
  }, [context]);

  useLayoutEffect(() => {
    const activeTopics = (state.topics ?? []).filter((topic): topic is string => Boolean(topic));
    if (activeTopics.length > 0) {
      context.subscribe(activeTopics.map((topic) => ({ topic })));
    } else {
      context.subscribe([]);
    }
  }, [context, state.topics]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  useEffect(() => {
    if (!messages || messages.length === 0) {
      return;
    }

    setLatestMessages((prev) => {
      const next = { ...prev };
      for (const message of messages) {
        next[message.topic] = message.message;
      }
      return next;
    });
  }, [messages]);

  return (
    <div style={{ padding: "1rem", height: "100%", boxSizing: "border-box" }}>
      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "1rem",
          display: "grid",
          gap: "0.5rem",
        }}
      >
        <div style={{ fontWeight: 600 }}>Topics</div>
        {(state.topics ?? []).some((topic) => Boolean(topic)) ? (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {(state.topics ?? [])
              .filter((topic): topic is string => Boolean(topic))
              .map((topic) => {
              const displayValue = latestMessages[topic]
                ? JSON.stringify(latestMessages[topic])
                : "No data";
              return (
                <div key={topic} style={{ display: "grid", gap: "0.25rem" }}>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    {topic}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {displayValue}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "#888" }}>Choose topics in the settings.</div>
        )}
      </div>
    </div>
  );
}

export function initT26Panel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<T26Panel context={context} />);

  // Return a function to run when the panel is removed
  return () => {
    root.unmount();
  };
}
