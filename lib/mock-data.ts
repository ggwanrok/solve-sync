// Mock data for the SolveSync (솔브싱크) algorithm study platform.
// All data here is placeholder content for building out the UI.

export type Difficulty = "Lv.1" | "Lv.2" | "Lv.3" | "Lv.4" | "Lv.5"

export type Solve = {
  id: string
  title: string
  difficulty: Difficulty
  language: string
  solvedAt: string // ISO
  platform: "프로그래머스"
}

export type User = {
  id: string
  name: string
  handle: string
  avatar: string
  tier: string
  solvedTotal: number
  streak: number
  extensionConnected: boolean
  programmersConnected: boolean
  lastSync: string
}

export type Friend = {
  id: string
  name: string
  handle: string
  avatar: string
  tier: string
  status: "online" | "solving" | "offline"
  todaySolved: number
  streak: number
}

export type FriendRequest = {
  id: string
  name: string
  handle: string
  avatar: string
  mutual: number
}

export type ActivityItem = {
  id: string
  userId: string
  name: string
  avatar: string
  type: "solve" | "streak" | "join" | "goal"
  problem?: string
  difficulty?: Difficulty
  detail?: string
  time: string
}

export type StudyMember = {
  id: string
  name: string
  handle: string
  avatar: string
  role: "리더" | "멤버"
  solvedThisWeek: number
  goal: number
  streak: number
  lastActive: string
  statusMessage?: string
}

export type StudyComment = {
  id: string
  name: string
  avatar: string
  message: string
  time: string
}

export type StudyRoom = {
  id: string
  name: string
  description: string
  emoji: string
  ruleUnit: "일" | "주"
  ruleCount: number
  memberCount: number
  maxMembers: number
  achievedRate: number // 0-100 for current period
  role: "리더" | "멤버"
  tags: string[]
  members: StudyMember[]
  comments: StudyComment[]
}

export const currentUser: User = {
  id: "u0",
  name: "김도현",
  handle: "@dohyeon",
  avatar: "/avatars/avatar-1.png",
  tier: "Gold III",
  solvedTotal: 312,
  streak: 14,
  extensionConnected: true,
  programmersConnected: true,
  lastSync: "방금 전",
}

export const recentSolves: Solve[] = [
  { id: "s1", title: "표 편집", difficulty: "Lv.5", language: "Python", solvedAt: "2026-07-27T09:12:00", platform: "프로그래머스" },
  { id: "s2", title: "양과 늑대", difficulty: "Lv.3", language: "Python", solvedAt: "2026-07-27T08:40:00", platform: "프로그래머스" },
  { id: "s3", title: "택배 배달과 수거하기", difficulty: "Lv.2", language: "JavaScript", solvedAt: "2026-07-26T22:05:00", platform: "프로그래머스" },
  { id: "s4", title: "이모티콘 할인행사", difficulty: "Lv.2", language: "Python", solvedAt: "2026-07-26T14:30:00", platform: "프로그래머스" },
  { id: "s5", title: "가장 먼 노드", difficulty: "Lv.3", language: "Java", solvedAt: "2026-07-25T20:18:00", platform: "프로그래머스" },
  { id: "s6", title: "단어 변환", difficulty: "Lv.3", language: "Python", solvedAt: "2026-07-25T11:02:00", platform: "프로그래머스" },
]

// 52 weeks x 7 days contribution counts (0-4 intensity based on count)
export function generateContributions(seed = 7): number[] {
  const days = 52 * 7
  const out: number[] = []
  let s = seed
  for (let i = 0; i < days; i++) {
    s = (s * 9301 + 49297) % 233280
    const r = s / 233280
    // weight toward 0-2 with occasional bursts
    let v = 0
    if (r > 0.55) v = 1
    if (r > 0.72) v = 2
    if (r > 0.86) v = 3
    if (r > 0.95) v = 4
    out.push(v)
  }
  return out
}

export const weeklyProgress = {
  goal: 10,
  done: 7,
  perDay: [
    { day: "월", count: 2 },
    { day: "화", count: 1 },
    { day: "수", count: 0 },
    { day: "목", count: 2 },
    { day: "금", count: 1 },
    { day: "토", count: 1 },
    { day: "일", count: 0 },
  ],
}

export const difficultyBreakdown = [
  { level: "Lv.1", solved: 88, total: 90 },
  { level: "Lv.2", solved: 104, total: 140 },
  { level: "Lv.3", solved: 82, total: 160 },
  { level: "Lv.4", solved: 28, total: 95 },
  { level: "Lv.5", solved: 10, total: 70 },
]

export const friends: Friend[] = [
  { id: "f1", name: "이서연", handle: "@seoyeon", avatar: "/avatars/avatar-2.png", tier: "Platinum V", status: "solving", todaySolved: 3, streak: 22 },
  { id: "f2", name: "박준호", handle: "@junho", avatar: "/avatars/avatar-3.png", tier: "Gold I", status: "online", todaySolved: 1, streak: 5 },
  { id: "f3", name: "최민지", handle: "@minji", avatar: "/avatars/avatar-4.png", tier: "Gold IV", status: "offline", todaySolved: 0, streak: 0 },
  { id: "f4", name: "정우성", handle: "@woosung", avatar: "/avatars/avatar-5.png", tier: "Silver I", status: "online", todaySolved: 2, streak: 8 },
  { id: "f5", name: "한지민", handle: "@jimin", avatar: "/avatars/avatar-6.png", tier: "Platinum III", status: "solving", todaySolved: 4, streak: 31 },
]

export const friendRequests: FriendRequest[] = [
  { id: "r1", name: "강태오", handle: "@taeoh", avatar: "/avatars/avatar-7.png", mutual: 3 },
  { id: "r2", name: "윤아름", handle: "@areum", avatar: "/avatars/avatar-8.png", mutual: 1 },
]

export const activityFeed: ActivityItem[] = [
  { id: "a1", userId: "f5", name: "한지민", avatar: "/avatars/avatar-6.png", type: "streak", detail: "31일 연속 풀이 달성", time: "10분 전" },
  { id: "a2", userId: "f1", name: "이서연", avatar: "/avatars/avatar-2.png", type: "solve", problem: "네트워크", difficulty: "Lv.3", time: "24분 전" },
  { id: "a3", userId: "f4", name: "정우성", avatar: "/avatars/avatar-5.png", type: "solve", problem: "완주하지 못한 선수", difficulty: "Lv.1", time: "1시간 전" },
  { id: "a4", userId: "f2", name: "박준호", avatar: "/avatars/avatar-3.png", type: "goal", detail: "'코테 마스터' 스터디 주간 목표 달성", time: "2시간 전" },
  { id: "a5", userId: "f1", name: "이서연", avatar: "/avatars/avatar-2.png", type: "solve", problem: "베스트앨범", difficulty: "Lv.3", time: "3시간 전" },
  { id: "a6", userId: "f5", name: "한지민", avatar: "/avatars/avatar-6.png", type: "join", detail: "'주말 알고리즘' 스터디에 참여", time: "5시간 전" },
]

const buildMembers = (): StudyMember[] => [
  { id: "u0", name: "김도현", handle: "@dohyeon", avatar: "/avatars/avatar-1.png", role: "리더", solvedThisWeek: 7, goal: 10, streak: 14, lastActive: "방금 전", statusMessage: "이번 주 DP 집중 공략 중" },
  { id: "f1", name: "이서연", handle: "@seoyeon", avatar: "/avatars/avatar-2.png", role: "멤버", solvedThisWeek: 12, goal: 10, streak: 22, lastActive: "12분 전", statusMessage: "목표 초과 달성!" },
  { id: "f5", name: "한지민", handle: "@jimin", avatar: "/avatars/avatar-6.png", role: "멤버", solvedThisWeek: 10, goal: 10, streak: 31, lastActive: "8분 전" },
  { id: "f4", name: "정우성", handle: "@woosung", avatar: "/avatars/avatar-5.png", role: "멤버", solvedThisWeek: 5, goal: 10, streak: 8, lastActive: "1시간 전", statusMessage: "주말에 몰아서 풀 예정" },
  { id: "f2", name: "박준호", handle: "@junho", avatar: "/avatars/avatar-3.png", role: "멤버", solvedThisWeek: 3, goal: 10, streak: 2, lastActive: "어제" },
  { id: "f3", name: "최민지", handle: "@minji", avatar: "/avatars/avatar-4.png", role: "멤버", solvedThisWeek: 0, goal: 10, streak: 0, lastActive: "3일 전" },
]

export const studyRooms: StudyRoom[] = [
  {
    id: "coding-master",
    name: "코테 마스터",
    description: "대기업 코딩테스트 대비, 매일 꾸준히 함께 풀어요.",
    emoji: "🎯",
    ruleUnit: "주",
    ruleCount: 10,
    memberCount: 6,
    maxMembers: 8,
    achievedRate: 50,
    role: "리더",
    tags: ["코딩테스트", "데일리", "Python"],
    members: buildMembers(),
    comments: [
      { id: "c1", name: "이서연", avatar: "/avatars/avatar-2.png", message: "이번 주 그래프 문제 너무 어렵네요 ㅠㅠ 같이 리뷰해요!", time: "30분 전" },
      { id: "c2", name: "정우성", avatar: "/avatars/avatar-5.png", message: "주말에 카페에서 오프라인 모각코 하실 분?", time: "1시간 전" },
      { id: "c3", name: "김도현", avatar: "/avatars/avatar-1.png", message: "다들 화이팅! 이번 주 목표 꼭 채워봅시다 💪", time: "2시간 전" },
    ],
  },
  {
    id: "weekend-algo",
    name: "주말 알고리즘",
    description: "주말마다 모여서 DP/그래프 심화 문제 풀이.",
    emoji: "🌱",
    ruleUnit: "주",
    ruleCount: 5,
    memberCount: 4,
    maxMembers: 6,
    achievedRate: 75,
    role: "멤버",
    tags: ["심화", "주말", "그래프"],
    members: buildMembers().slice(0, 4),
    comments: [
      { id: "c1", name: "한지민", avatar: "/avatars/avatar-6.png", message: "이번 주 세그먼트 트리 정리 노션에 올렸어요!", time: "45분 전" },
    ],
  },
  {
    id: "daily-one",
    name: "하루 한 문제",
    description: "부담 없이 매일 한 문제씩. 습관 만들기 프로젝트.",
    emoji: "☀️",
    ruleUnit: "일",
    ruleCount: 1,
    memberCount: 5,
    maxMembers: 10,
    achievedRate: 60,
    role: "멤버",
    tags: ["습관", "입문", "데일리"],
    members: buildMembers().slice(0, 5),
    comments: [],
  },
]

export function getStudyRoom(id: string) {
  return studyRooms.find((r) => r.id === id)
}
