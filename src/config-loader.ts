import { readFileSync } from 'node:fs';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { z } from 'zod';
import { type Config, ConfigSchema, type PartialConfig, PartialConfigSchema } from './schemas/config.schema';
import { PathUtil } from './utils/path.util';

export class ConfigLoader {
  private config: Config = this.defaultConfig;

  get defaultConfig(): Config {
    return ConfigSchema.parse({});
  }

  isEnabled(key: keyof Config): boolean {
    const section = this.config[key];
    return typeof section === 'object' && section !== null && 'enabled' in section ? Boolean((section as { enabled?: boolean }).enabled) : false;
  }

  getAutoSessionName(): Config['auto_session_name'] {
    return this.config.auto_session_name;
  }

  getModelSelect(): Config['model_select'] {
    return this.config.model_select;
  }

  initializeConfig(ctx: ExtensionContext): { success: boolean; error?: string } {
    let merged: Config = this.defaultConfig;

    const globalRes = PathUtil.findExtensionConfig({ type: 'global' });
    if (globalRes.exists) {
      const loaded = this.loadConfig(globalRes.path);
      if (!loaded.success) return { success: false, error: `at path => ${globalRes.path}\n${loaded.error}` };
      merged = this.mergeConfig(merged, loaded.data);
    }

    if (ctx.isProjectTrusted()) {
      const projectRes = PathUtil.findExtensionConfig({ type: 'project', cwd: ctx.cwd });
      if (projectRes.exists) {
        const loaded = this.loadConfig(projectRes.path);
        if (!loaded.success) return { success: false, error: `at path => ${projectRes.path}\n${loaded.error}` };
        merged = this.mergeConfig(merged, loaded.data);
      }
    }

    const parsed = ConfigSchema.safeParse(merged);
    if (!parsed.success) return { success: false, error: z.prettifyError(parsed.error) };

    this.config = parsed.data;
    return { success: true };
  }

  private mergeConfig(base: Config, partial: PartialConfig): Config {
    const next = { ...base } as Record<string, unknown>;

    for (const [key, value] of Object.entries(partial)) {
      if (key === '$schema' || value === undefined) continue;

      const baseValue = next[key];
      next[key] = this.isPlainObject(baseValue) && this.isPlainObject(value) ? { ...baseValue, ...value } : value;
    }

    return ConfigSchema.parse(next);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private loadConfig(path: string): { success: true; data: PartialConfig } | { success: false; error: string } {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      const parsed = PartialConfigSchema.safeParse(raw);
      if (!parsed.success) return { success: false, error: z.prettifyError(parsed.error) };
      return { success: true, data: parsed.data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
