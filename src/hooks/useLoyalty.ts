/**
 * TEMPORARY STUB - To be refactored into Zustand store
 * Use loyalty.store.ts instead
 */

export function useLoyalty() {
  return {
    program: null,
    isLoading: false,
    reload: () => Promise.resolve(),
    updateProgram: () => Promise.resolve({} as any),
  }
}
