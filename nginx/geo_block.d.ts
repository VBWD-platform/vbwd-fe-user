// S120.1 — type surface for the njs geo-block handler (geo_block.js), so the
// vitest spec type-checks under vue-tsc without a suppression. Only the members
// the handler actually touches on the njs request object are declared.
export interface GeoBlockRequest {
  method: string
  uri: string
  args: Record<string, string>
  headersIn: Record<string, string>
  headersOut: Record<string, string>
  variables: Record<string, string>
  return(code: number, location?: string): void
  internalRedirect(name: string): void
  log(message?: string): void
  warn(message?: string): void
  error(message?: string): void
}

export interface GeoBlockTestRuntime {
  readConfigRaw?: () => string
  nowMs?: () => number
  devTestEnabled?: () => boolean
}

// njs requires a single `export default { ... }`; every member (the njs entry
// point plus the unit-test surface) hangs off it.
declare const geoModule: {
  handle: (request: GeoBlockRequest) => void
  mintBypassToken: (secret: string, expSeconds: number) => string
  verifyBypassToken: (secret: string, token: string, nowSeconds: number) => boolean
  __setRuntimeForTest: (overrides: GeoBlockTestRuntime) => void
  __resetRuntimeForTest: () => void
}
export default geoModule
