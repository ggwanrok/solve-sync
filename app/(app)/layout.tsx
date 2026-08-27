import { AppShell } from "@/components/app-shell"
import { type ContributionDay } from "@/components/contribution-graph"
import { redirect } from "next/navigation"
import { addCalendarDays, dayKey } from "@/lib/calendar"
import { getPendingFriendRequestCount, getViewer, getViewerExtensions, getViewerProfile, getViewerSidebarSolves } from "@/lib/server/viewer"

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, profile, extensions, pendingFriendRequestCount, sidebarSolves] = await Promise.all([
    getViewer(),
    getViewerProfile(),
    getViewerExtensions(),
    getPendingFriendRequestCount(),
    getViewerSidebarSolves(),
  ])
  if (!user) redirect("/login")
  if (!profile?.handle) redirect("/onboarding")

  const today = dayKey(new Date())
  const firstDate = addCalendarDays(today, -111)
  const problemsByDay = new Map<string, ContributionDay["problems"]>()
  sidebarSolves.forEach((solve) => {
    const date = dayKey(new Date(solve.accepted_at))
    const problems = problemsByDay.get(date) || []
    problems.push({
      title: solve.title || `문제 ${solve.problem_id}`,
      language: solve.language,
      difficulty: solve.difficulty,
    })
    problemsByDay.set(date, problems)
  })
  const sidebarContributions: ContributionDay[] = []
  let contributionDate = firstDate
  while (contributionDate <= today) {
    sidebarContributions.push({ date: contributionDate, problems: problemsByDay.get(contributionDate) || [] })
    contributionDate = addCalendarDays(contributionDate, 1)
  }

  return <AppShell user={{
    id: user.id,
    name: profile.nickname || profile.handle,
    handle: profile.handle,
    bio: profile.bio || "",
    avatarUrl: profile.avatar_url,
    pendingFriendRequestCount,
    extensionDevices: extensions.map((device) => ({
      installationId: device.installation_id,
      deviceName: device.device_name,
      connectedAt: device.created_at,
      lastSeenAt: device.last_seen_at,
    })),
  }} contributions={sidebarContributions}>{children}</AppShell>
}
