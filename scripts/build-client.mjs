/** Historical build entry forwards to the current shared panel/console generator. */
if (!process.argv.includes('--community')) process.argv.push('--community')
await import('../packages/purge-panel/scripts/build.mjs')
