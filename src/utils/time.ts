/**
 * Time utilities
 */

/**
 * Format a timestamp as relative time (e.g., "2m ago", "1h ago")
 */
export function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) {
    return 'Just now'
  } else if (diffMin < 60) {
    return `${diffMin}m ago`
  } else if (diffHour < 24) {
    return `${diffHour}h ago`
  } else if (diffDay === 1) {
    return 'Yesterday'
  } else if (diffDay < 7) {
    return `${diffDay}d ago`
  } else {
    return then.toLocaleDateString()
  }
}
