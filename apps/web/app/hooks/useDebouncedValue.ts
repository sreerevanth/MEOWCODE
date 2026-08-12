"use client";

import { useDeferredValue } from "react";

export function useDebouncedValue<T>(value: T, _delayMs = 300): T {
  // ponytail: native platform feature covers this
  return useDeferredValue(value);
}
