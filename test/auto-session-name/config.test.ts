import { describe, expect, test } from 'bun:test';
import { ConfigSchema, PartialConfigSchema } from '../../src/schemas/config.schema';

describe('auto session name config', () => {
  test('defaults to disabled with no custom message triggers', () => {
    expect(ConfigSchema.parse({}).auto_session_name).toEqual({ enabled: false, custom_message_whitelist: [] });
    expect(ConfigSchema.parse({ auto_session_name: { enabled: true } }).auto_session_name.custom_message_whitelist).toEqual([]);
  });

  test('partial config preserves omitted fields for merging', () => {
    expect(
      PartialConfigSchema.parse({ auto_session_name: { model: { provider: 'test', modelId: 'test', reasoning: 'low' } } }).auto_session_name,
    ).toEqual({
      model: { provider: 'test', modelId: 'test', reasoning: 'low' },
    });
    expect(PartialConfigSchema.parse({ auto_session_name: { custom_message_whitelist: ['naming'] } }).auto_session_name).toEqual({
      custom_message_whitelist: ['naming'],
    });
  });
});
