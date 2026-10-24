export function onboardingCacheKey(userId: string) {
  return `onboarded:${userId}`;
}

export function isOnboardedCached(userId: string) {
  try {
    return window.sessionStorage.getItem(onboardingCacheKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function cacheOnboarded(userId: string) {
  try {
    window.sessionStorage.setItem(onboardingCacheKey(userId), "1");
  } catch {
    // Ignore session storage errors.
  }
}
