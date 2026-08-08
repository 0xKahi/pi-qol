import type { ImageContent, TextContent } from '@earendil-works/pi-ai';

export function parseAgentContentToPrompt(content: string | (TextContent | ImageContent)[]): string {
  if (typeof content === 'string') return content;

  return content
    .filter((block): block is TextContent => block.type === 'text')
    .map(block => block.text)
    .join('');
}
