import pongProto from "./pong-academie-espion-renaissance.json";
import breakoutProto from "./breakout-academie-espion-renaissance.json";
import marioProto from "./mario-academie-espion-renaissance.json";
import spaceInvadersProto from "./space-invaders-academie-espion-renaissance.json";
import donkeyKongProto from "./donkey-kong-academie-espion-renaissance.json";
import tetrisProto from "./tetris-academie-espion-renaissance.json";
import qbertProto from "./qbert-academie-espion-renaissance.json";
import lodeRunnerProto from "./loderunner-academie-espion-renaissance.json";
import type { ProtoMeta } from "@/lib/types/proto";

export const PROTOTYPE_CATALOG: ProtoMeta[] = [
  pongProto as ProtoMeta,
  breakoutProto as ProtoMeta,
  marioProto as ProtoMeta,
  spaceInvadersProto as ProtoMeta,
  donkeyKongProto as ProtoMeta,
  tetrisProto as ProtoMeta,
  qbertProto as ProtoMeta,
  lodeRunnerProto as ProtoMeta,
];

export function getAllPrototypes(): ProtoMeta[] {
  return PROTOTYPE_CATALOG;
}

export function getPrototypeBySlug(slug: string): ProtoMeta | null {
  return PROTOTYPE_CATALOG.find((proto) => proto.slug === slug) ?? null;
}
