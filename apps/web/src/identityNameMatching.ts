export type IdentityMatchingPolicy = {
  enabled: boolean;
  allowPartial: boolean;
  minMatchingTokens: number;
  ignoreCase: boolean;
  ignorePunctuation: boolean;
  allowMissingMiddle: boolean;
  allowTokenOrderVariations: boolean;
};

export const DEFAULT_IDENTITY_MATCHING_POLICY: IdentityMatchingPolicy = {
  enabled: true,
  allowPartial: true,
  minMatchingTokens: 1,
  ignoreCase: true,
  ignorePunctuation: true,
  allowMissingMiddle: true,
  allowTokenOrderVariations: true,
};

function tokens(value: string, policy: IdentityMatchingPolicy): string[] {
  let normalized = value.normalize("NFKC").trim();
  if (policy.ignoreCase) normalized = normalized.toLocaleLowerCase();
  if (policy.ignorePunctuation) normalized = normalized.replace(/[\p{P}\p{S}]+/gu, " ");
  return normalized.split(/\s+/u).filter(Boolean);
}

export function identityNamesMatch(accountName: string, profileName: string, policy = DEFAULT_IDENTITY_MATCHING_POLICY): boolean {
  if (!policy.enabled) return true;
  const account = tokens(accountName, policy);
  const profile = tokens(profileName, policy);
  if (!account.length || !profile.length) return false;
  const shorter = account.length <= profile.length ? account : profile;
  const longer = account.length <= profile.length ? profile : account;
  if (shorter.length < policy.minMatchingTokens) return false;
  if (!policy.allowPartial && shorter.length !== longer.length) return false;
  if (policy.allowTokenOrderVariations) {
    const longSet = new Set(longer);
    return shorter.every(token => longSet.has(token)) &&
      (policy.allowPartial || new Set(account).size === new Set(profile).size);
  }
  if (policy.allowPartial) return shorter.every(token => longer.includes(token));
  return account.join(" ") === profile.join(" ");
}
