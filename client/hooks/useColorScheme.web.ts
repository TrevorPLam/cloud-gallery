// AI-META-BEGIN
// AI-META: Web-specific color scheme hook with hydration handling for SSR/SSG
// OWNERSHIP: client/hooks (platform detection - web)
// ENTRYPOINTS: Imported by useTheme on web builds
// DEPENDENCIES: react-native (via .web.ts suffix)
// DANGER: Returns "light" until hydrated to prevent SSR mismatch; hydration critical
// CHANGE-SAFETY: Risky - hydration pattern required for web static rendering
// TESTS: Test SSR/SSG builds, verify hydration timing, check light mode default
// AI-META-END

import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

/**
 * AI-NOTE: Web static rendering requires returning fixed value until client hydrates;
 * prevents React hydration mismatches between server and client render.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return "light";
}
