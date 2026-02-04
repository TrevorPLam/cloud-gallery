// AI-META-BEGIN
// AI-META: Expo entry point that registers the root App component
// OWNERSHIP: client/root
// ENTRYPOINTS: entry point specified in package.json "main" field
// DEPENDENCIES: expo, App.tsx
// DANGER: changing registerRootComponent breaks Expo initialization
// CHANGE-SAFETY: do not modify; this is boilerplate required by Expo
// TESTS: expo:dev to verify app launches
// AI-META-END

// AI-NOTE: Expo registerRootComponent wraps App with error boundaries and enables Fast Refresh
import { registerRootComponent } from "expo";

import App from "@/App";

registerRootComponent(App);
