/**
 * Isolate tests from the developer's real pi agent directory.
 *
 * Code paths that fall back to `SettingsManager.create()` read global settings from the agent dir,
 * so pin it to a temp dir with deterministic settings. `cacheWarming` is set explicitly because
 * pi >= 1.5.2 defaults it to "idle", which disables the context-view silent probe.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const agentDir = mkdtempSync(join(tmpdir(), 'pi-qol-test-agent-'));
writeFileSync(join(agentDir, 'settings.json'), JSON.stringify({ cacheWarming: 'off' }));
process.env.PI_CODING_AGENT_DIR = agentDir;
