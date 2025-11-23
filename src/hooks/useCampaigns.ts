/**
 * TEMPORARY STUB - To be refactored into Zustand store
 * Use loyalty-campaigns.store.ts instead
 */

export function useCampaigns() {
  return {
    campaigns: [],
    isLoading: false,
    reload: () => Promise.resolve(),
    createCampaign: () => Promise.resolve({} as any),
    updateCampaign: () => Promise.resolve({} as any),
    deleteCampaign: () => Promise.resolve(),
  }
}
