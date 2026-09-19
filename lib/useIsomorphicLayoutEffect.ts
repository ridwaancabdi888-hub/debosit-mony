import { useEffect, useLayoutEffect } from "react";

/**
 * useLayoutEffect on the client, useEffect on the server.
 *
 * Providers start from the server-rendered default and correct themselves from
 * localStorage here — running before paint means hydration stays consistent and
 * the user never sees the wrong language or theme flash past.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
