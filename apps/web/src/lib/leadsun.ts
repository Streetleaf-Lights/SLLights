// The Leadsun matching helpers now live in @sllights/shared so the mobile
// pole screen's remote control uses the same rules. Re-exported here so
// existing `@/lib/leadsun` imports keep working.
export {
  findLeadsunGroupForProduct,
  findLeadsunProduct,
  hasLeadsunProducts,
  isLampOn,
} from "@sllights/shared/leadsun";
