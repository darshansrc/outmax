export function onboardingUrlForSite(input: string): string | null {
  const site = input.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(site)) return null;
  return `/onboarding?site=${encodeURIComponent(site)}`;
}
