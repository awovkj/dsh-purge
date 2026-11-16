/** Compatibility console uses the same three-mode components as the current panel. */
import React from "react";
import { __dshPurgeDrill as drill } from "../vendor/drill.js";

export const inject = ["slots"];
export function apply(ctx) {
  const style = document.createElement("style");
  style.textContent = drill.CSS;
  document.head.append(style);
  drill.setUI({ open: drill.isFullWindow() });
  ctx.effect(() => () => style.remove());
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      { name: "shell.overlay", id: "redteam-console", order: 50 },
      () => React.createElement(drill.Panel),
    ),
  );
  for (const [id, order, label, Component] of [
    ["redteam-toggle", 50, "RedTeam", drill.SidebarButton],
    ["redteam-full", 51, "全面浏览", drill.FullButton],
  ])
    ctx.slots.inject("sidebar.footer.action", () =>
      ctx.slots.register(
        { name: "sidebar.footer.action", id, order, label },
        (props) => React.createElement(Component, props),
      ),
    );
  ctx.slots.inject("conversation.session.header.utilities", () =>
    ctx.slots.register(
      {
        name: "conversation.session.header.utilities",
        id: "redteam-header-toggle",
        order: 50,
        label: "RedTeam",
      },
      () => React.createElement(drill.HeaderButton),
    ),
  );
}
