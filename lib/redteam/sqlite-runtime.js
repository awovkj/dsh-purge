/** Keep a missing optional SQLite runtime from failing the module import itself. */
import { createRequire } from 'node:module'
import { requireRedteamRuntime } from './runtime-requirements.js'

let NativeDatabase, unavailable
try { requireRedteamRuntime(); NativeDatabase = createRequire(import.meta.url)('node:sqlite').DatabaseSync }
catch (error) { unavailable = error }
export const DatabaseSync = NativeDatabase || class UnsupportedSqliteRuntime {
  constructor() {
    throw Object.assign(new Error(unavailable?.message || 'This Node build has no node:sqlite DatabaseSync'),
      { code: unavailable?.code || 'REDTEAM_SQLITE_UNAVAILABLE', cause: unavailable })
  }
}
