let lastSeenAt: string | null = null

export function markAnnouncementsSeen() {
  lastSeenAt = new Date().toISOString()
}

export function hasUnreadAnnouncements(announcements: { createdAt: string }[]): boolean {
  if (announcements.length === 0) return false
  if (lastSeenAt === null) return true
  return announcements.some((a) => a.createdAt > lastSeenAt!)
}
