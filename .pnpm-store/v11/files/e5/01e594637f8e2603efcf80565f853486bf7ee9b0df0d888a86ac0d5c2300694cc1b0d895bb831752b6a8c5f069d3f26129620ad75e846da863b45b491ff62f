import { n as AdapterProps } from "../context-3xaSk51n.js";
import { ReactElement, ReactNode } from "react";
//#region src/adapters/react.d.ts
declare function NuqsAdapter({ children, fullPageNavigationOnShallowFalseUpdates, serverSearch, ...adapterProps }: AdapterProps & {
  children: ReactNode;
  fullPageNavigationOnShallowFalseUpdates?: boolean;
  /**
   * The search string of the request, for server-side rendering where
   * `location` is not available (eg: `Astro.url.search` in Astro SSR,
   * or the request URL's search string in Inertia, Fastify, Hono etc).
   *
   * React reads this value on the server and again on the client
   * during hydration, so both render the same markup.
   * After hydration, the adapter reads `location.search`.
   *
   * Without it, the server renders the parsers' default values,
   * and deep links show default content until the client hydrates.
   * Accepts the search string with or without the leading `?`.
   */
  serverSearch?: string | URLSearchParams;
}): ReactElement;
/**
 * Opt-in to syncing shallow updates of the URL with the useOptimisticSearchParams hook.
 *
 * By default, the useOptimisticSearchParams hook will only react to internal nuqs updates.
 * If third party code updates the History API directly, use this function to
 * enable useOptimisticSearchParams to react to those changes.
 */
declare function enableHistorySync(): void;
//#endregion
export { NuqsAdapter, enableHistorySync };
//# sourceMappingURL=react.d.ts.map