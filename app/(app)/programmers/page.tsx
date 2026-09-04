import type { Metadata } from "next"
import Link from "next/link"
import {
  CheckCircle2,
  Chrome,
  CircleAlert,
  ExternalLink,
  KeyRound,
  MonitorSmartphone,
  MousePointerClick,
  Pin,
  Puzzle,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ExtensionBrowserStatusPanel, RegisteredExtensionDevicesBadge } from "@/components/extension-browser-connection"

export const metadata: Metadata = {
  title: "프로그래머스 연동 방법 | SolveSync",
  description: "SolveSync Chrome 확장 프로그램을 설치하고 프로그래머스 풀이를 자동으로 기록하는 방법입니다.",
}

const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/solvesync/dgghaooaokpafdhjgieajelgbilacmkd?hl=ko&utm_source=ext_sidebar"

const installSteps = [
  {
    icon: ExternalLink,
    title: "Chrome 웹 스토어 열기",
    description: "위 ‘Chrome 웹 스토어에서 설치’ 버튼을 눌러 SolveSync 확장 프로그램 페이지를 여세요.",
  },
  {
    icon: MousePointerClick,
    title: "Chrome에 추가",
    description: "웹 스토어 페이지 오른쪽 위에 있는 ‘Chrome에 추가’ 버튼을 누르세요.",
  },
  {
    icon: ShieldCheck,
    title: "설치 권한 확인",
    description: "확인 창에서 안내된 권한을 확인한 다음 ‘확장 프로그램 추가’를 누르세요.",
  },
  {
    icon: Pin,
    title: "SolveSync 고정하기",
    description: "설치가 끝나면 Chrome 오른쪽 위 퍼즐 아이콘을 누르고 SolveSync 옆 고정 아이콘을 선택하세요.",
  },
]

const connectSteps = [
  {
    icon: Puzzle,
    title: "SolveSync 확장 프로그램 열기",
    description: "Chrome 도구 모음에 고정한 SolveSync 아이콘을 눌러 확장 프로그램을 여세요.",
  },
  {
    icon: KeyRound,
    title: "SolveSync 계정 연결",
    description: "SolveSync 아이콘을 열고 ‘SolveSync 계정 연결’을 누르세요. 서버 통신 권한을 묻는 창이 나오면 허용해 주세요.",
  },
  {
    icon: ShieldCheck,
    title: "로그인하고 이 기기 승인",
    description: "연결 화면에서 Google로 로그인한 다음 ‘이 기기 연결 승인’을 누르세요. 토큰을 직접 복사하거나 붙여 넣을 필요는 없습니다.",
  },
  {
    icon: CheckCircle2,
    title: "연동 상태 확인",
    description: "확장 프로그램을 다시 열었을 때 ‘계정과 연동되어 있습니다.’가 표시되면 연결이 끝난 것입니다.",
  },
]

function StepList({ steps }: { steps: typeof installSteps }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3 rounded-2xl bg-muted/55 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <step.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="font-medium">{step.title}</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function ProgrammersGuidePage() {
  return (
    <div className="page-container max-w-4xl">
      <section className="overflow-hidden rounded-3xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.025),0_14px_40px_rgba(15,23,42,0.045)] ring-1 ring-foreground/[0.055]">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <RegisteredExtensionDevicesBadge />
            <Badge variant="outline">데스크톱 Chrome</Badge>
          </div>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Chrome className="size-6" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">프로그래머스 풀이 자동 기록 연결하기</h1>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Chrome 확장 프로그램이 프로그래머스의 정답 제출을 감지해 SolveSync로 자동 전송합니다.
              </p>
            </div>
            <Button
              render={<a href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer" />}
              nativeButton={false}
              size="lg"
              className="shrink-0"
            >
              <ExternalLink />
              Chrome 웹 스토어에서 설치
            </Button>
          </div>
          <div className="mt-5 rounded-2xl bg-muted/45 p-3">
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">등록된 기기에는 다른 브라우저에서 연결한 기기도 포함됩니다. 지금 사용하는 브라우저의 연결 상태는 아래에서 확인하세요.</p>
            <ExtensionBrowserStatusPanel />
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Chrome className="size-5 text-primary" />1. Chrome 웹 스토어에서 설치</CardTitle>
          <CardDescription>개발자 모드나 별도 파일 다운로드 없이 웹 스토어에서 바로 설치합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StepList steps={installSteps} />
          <div className="flex items-start gap-3 rounded-2xl bg-accent/45 p-4 text-xs leading-relaxed">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p><strong className="font-medium">이미 설치되어 있다면 다시 설치할 필요가 없습니다.</strong> Chrome 도구 모음에서 SolveSync를 열고 아래 계정 연결 단계부터 진행하세요.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-primary" />2. SolveSync 계정 연결</CardTitle>
          <CardDescription>이 Chrome에서 수집한 풀이를 현재 계정으로 보낼 수 있도록 승인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StepList steps={connectSteps} />
          <div className="flex items-start gap-3 rounded-2xl bg-primary/[0.065] p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p>기기마다 별도의 연결 키가 발급되며 Google 비밀번호는 확장 프로그램에 전달되지 않습니다. 여러 PC를 사용한다면 각 PC에서 이 과정을 한 번씩 진행하세요.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" />3. 첫 풀이로 동작 확인</CardTitle>
          <CardDescription>설치와 연결이 끝났다면 실제 정답 기록이 들어오는지 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span><p className="text-sm leading-relaxed">Chrome에서 프로그래머스에 로그인하고 문제를 하나 제출해 <strong className="font-medium">정답</strong> 판정을 받으세요.</p></li>
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span><p className="text-sm leading-relaxed">SolveSync 확장 프로그램을 열어 <strong className="font-medium">동기화 대기 0건</strong>과 마지막 동기화 시각을 확인하세요.</p></li>
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span><p className="text-sm leading-relaxed">SolveSync 대시보드를 새로고침하면 최근 풀이와 잔디에 기록이 반영됩니다.</p></li>
          </ol>
          <Button render={<Link href="/" />} nativeButton={false} variant="outline" className="mt-5">
            대시보드에서 확인하기
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.055] sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">계정에 등록된 기기는 마이페이지에서 관리할 수 있어요.</p>
            <p className="mt-1 text-xs text-muted-foreground">오른쪽 위 프로필 사진을 누르면 기기별 마지막 동기화 시각을 확인하거나 연결을 해제할 수 있습니다.</p>
          </div>
        </div>
        <Button render={<a href={CHROME_WEB_STORE_URL} target="_blank" rel="noreferrer" />} nativeButton={false} variant="ghost" size="sm">
          Chrome 웹 스토어 열기 <ExternalLink />
        </Button>
      </div>
    </div>
  )
}
