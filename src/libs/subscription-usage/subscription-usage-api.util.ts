import { readFileSync } from 'node:fs';
import { PathUtil } from '../../utils/path.util';
import { RawDataParser } from '../../utils/raw-data-parser.util';

export type ProviderAuth = {
  token: string;
  accountId?: string;
};

export type SubscriptionProvider = 'anthropic' | 'openai-codex';
type SubscriptionAuthconfig = Partial<Record<SubscriptionProvider, Record<string, unknown>>>;

export type RateWindow = {
  label: string;
  usedPercent: number;
  resetAt?: Date;
};

export type FetchUsageResponse = {
  label: string;
  rateWindow: RateWindow[];
};

export interface SubscriptionUsageStrategy {
  readonly provider: SubscriptionProvider;
  readonly label: string;
  fetchUsage(auth: ProviderAuth): Promise<RateWindow[] | undefined>;
}

export class SubscriptionUsageApi {
  async fetchUsage(strategy: SubscriptionUsageStrategy): Promise<FetchUsageResponse | undefined> {
    const auth = this.getOauthProviderAuth(strategy.provider);
    if (!auth) return;
    const rateWindow = await strategy.fetchUsage(auth);
    if (!rateWindow) return;
    return {
      label: strategy.label,
      rateWindow,
    };
  }

  formatResetDescription(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    if (diffMs <= 0) return 'now';

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
  }

  private getOauthProviderAuth(provider: SubscriptionProvider): ProviderAuth | undefined {
    const auth = this.loadAuthConfig();
    if (!auth) return;

    const providerAuth = auth[provider];
    const access = RawDataParser.stringValue(providerAuth?.access);
    if (!access) return;

    return {
      token: access,
      accountId: RawDataParser.stringValue(providerAuth?.accountId),
    };
  }

  private loadAuthConfig(): SubscriptionAuthconfig | undefined {
    const authJson = PathUtil.findPiAuthConfig();
    if (!authJson.exists) return undefined;

    return RawDataParser.asRecord(JSON.parse(readFileSync(authJson.path, 'utf-8'))) as SubscriptionAuthconfig | undefined;
  }
}
