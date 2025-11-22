import { colors } from "@/theme/tokens"

export const getRoleDisplay = (role: string): string => {
  const roleMap: Record<string, string> = {
    vendor_owner: 'Owner',
    vendor_admin: 'Admin',
    location_manager: 'Location Manager',
    pos_staff: 'POS Staff',
    inventory_staff: 'Inventory',
    readonly: 'Read Only',
  }
  return roleMap[role] || role
}

export const getRoleBadgeColor = (role: string): string => {
  const roleColors: Record<string, string> = {
    vendor_owner: '#FF3B30',    // Red for Owner
    vendor_admin: '#FF3B30',    // Red for Admin
    location_manager: '#FF9500', // Orange for Location Manager
    pos_staff: '#34C759',       // Green for POS Staff
    inventory_staff: '#007AFF',  // Blue for Inventory
    readonly: colors.text.quaternary, // Gray for Read Only
  }
  return roleColors[role] || colors.text.quaternary
}
