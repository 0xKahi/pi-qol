import { existsSync } from 'node:fs';
import path from 'node:path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { EXTENSION_ID } from '../constants';

export type FileSearchResult = {
  exists: boolean;
  path: string;
};

type FindConfigInput = { type: 'global' } | { type: 'project'; cwd: string };

export class PathUtil {
  static findFile(filePath: string): FileSearchResult {
    if (existsSync(filePath)) {
      return { exists: true, path: filePath };
    }
    return { exists: false, path: filePath };
  }

  static findExtensionConfig(input: { type: 'global' }): FileSearchResult;
  static findExtensionConfig(input: { type: 'project'; cwd: string }): FileSearchResult;
  static findExtensionConfig(input: FindConfigInput): FileSearchResult {
    switch (input.type) {
      case 'global': {
        return PathUtil.findFile(PathUtil.getExtensionConfig([getAgentDir()]));
      }
      case 'project': {
        return PathUtil.findFile(PathUtil.getExtensionConfig([input.cwd, '.pi']));
      }
    }
  }

  private static getExtensionConfig(paths: string[]): string {
    return path.join(...paths, 'extensions', EXTENSION_ID, 'config.json');
  }
}
