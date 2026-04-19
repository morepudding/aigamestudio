"use client";

import dynamic from "next/dynamic";
import { useChatPanel } from "./ChatPanelProvider";

const LazyChatPanel = dynamic(
  () => import("./ChatPanel").then((mod) => mod.ChatPanel),
  { ssr: false }
);

export function ChatPanelMount() {
  const { shouldRenderPanel } = useChatPanel();

  if (!shouldRenderPanel) {
    return null;
  }

  return <LazyChatPanel />;
}