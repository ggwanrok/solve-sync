import type { Metadata } from "next"
import {
  ArrowLeft,
  Cookie,
  Database,
  ExternalLink,
  Github,
  KeyRound,
  ShieldCheck,
  Users,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "서비스 소개 및 개인정보 처리방침 | Solve-Sync",
  description: "Solve-Sync 서비스 소개와 개인정보의 수집, 이용, 보관 및 보호 방법을 안내합니다.",
}

const effectiveDate = "2026년 8월 26일"
const contactEmail = process.env.PRIVACY_CONTACT_EMAIL

const sections = [
  ["overview", "처리 목적"],
  ["collection", "수집하는 정보"],
  ["retention", "보유 및 파기"],
  ["services", "외부 서비스"],
  ["rights", "이용자 권리"],
  ["safety", "안전성 확보"],
  ["cookies", "쿠키 및 자동 수집"],
  ["contact", "문의 및 권익침해 구제"],
] as const

function PolicySection({
  id,
  number,
  title,
  children,
}: {
  id: string
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-10 first:border-0 first:pt-0">
      <p className="text-xs font-semibold text-primary">{String(number).padStart(2, "0")}</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  )
}

function DataItem({ title, items, purpose }: { title: string; items: string; purpose: string }) {
  return (
    <div className="grid gap-2 border-b py-5 last:border-0 md:grid-cols-[9rem_1fr_1fr] md:gap-6">
      <h3 className="font-medium text-foreground">{title}</h3>
      <div>
        <p className="mb-1 text-xs font-medium text-foreground md:hidden">처리 항목</p>
        <p>{items}</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-foreground md:hidden">이용 목적</p>
        <p>{purpose}</p>
      </div>
    </div>
  )
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/55 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center px-5 md:px-8">
          <Link href="/" aria-label="Solve-Sync 홈으로 이동">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              <ArrowLeft className="size-4" />
              서비스로 돌아가기
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border/55">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                About Solve-Sync
              </span>
              <h1 className="mt-6 text-balance text-4xl font-bold tracking-[-0.05em] md:text-5xl">
                풀이 기록은 편리하게,
                <br />
                개인정보는 투명하게.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-base leading-8 text-muted-foreground md:text-lg">
                Solve-Sync는 프로그래머스 풀이 기록을 자동으로 모으고 친구, 스터디 멤버와 목표를 이어가는
                알고리즘 학습 서비스입니다. 어떤 정보를 왜 처리하는지 아래에서 확인할 수 있습니다.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.055]">
                <KeyRound className="size-5 text-primary" />
                <p className="mt-4 font-semibold">Google 계정으로 로그인</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Google 계정 비밀번호를 수집하지 않고 인증 세션을 안전하게 관리합니다.</p>
              </div>
              <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.055]">
                <Database className="size-5 text-primary" />
                <p className="mt-4 font-semibold">학습에 필요한 정보만</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">풀이 기록과 친구·스터디 활동을 서비스 제공 목적으로만 처리합니다.</p>
              </div>
              <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.055]">
                <ShieldCheck className="size-5 text-primary" />
                <p className="mt-4 font-semibold">언제든 계정 삭제</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">마이페이지에서 계정과 연결된 서비스 데이터를 직접 삭제할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 md:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-20">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">개인정보 처리방침</p>
            <p className="mt-2 text-sm font-medium">시행일 {effectiveDate}</p>
            <nav className="mt-6 hidden flex-col gap-1 lg:flex" aria-label="개인정보 처리방침 목차">
              {sections.map(([id, label], index) => (
                <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {index + 1}. {label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 space-y-12">
            <div className="rounded-2xl bg-primary/[0.065] p-5 text-sm leading-7">
              Solve-Sync 운영자(이하 “운영자”)는 개인정보 보호법 등 관련 법령을 준수하며, 이용자의 개인정보를
              필요한 범위에서 안전하고 투명하게 처리합니다.
            </div>

            <PolicySection id="overview" number={1} title="개인정보의 처리 목적">
              <p>운영자는 다음 목적을 위해 개인정보를 처리하며, 목적이 변경되는 경우 필요한 안내와 동의 절차를 거칩니다.</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                <li>Google OAuth를 통한 회원 식별, 로그인 및 인증 세션 관리</li>
                <li>고유 닉네임, 프로필과 대시보드 제공</li>
                <li>프로그래머스 풀이 기록 수집 및 학습 통계 제공</li>
                <li>친구 요청, 스터디룸 참여, 목표 진행도, 댓글 및 선택형 푸시 알림 기능 제공</li>
                <li>부정 이용 방지, 보안 유지, 오류 분석과 서비스 개선</li>
              </ul>
            </PolicySection>

            <PolicySection id="collection" number={2} title="처리하는 개인정보 항목과 수집 방법">
              <div className="overflow-hidden rounded-2xl bg-card px-5 shadow-sm ring-1 ring-foreground/[0.055]">
                <div className="hidden grid-cols-[9rem_1fr_1fr] gap-6 border-b py-3 text-xs font-semibold text-foreground md:grid">
                  <span>구분</span><span>처리 항목</span><span>이용 목적</span>
                </div>
                <DataItem title="회원·프로필" items="Google 계정 식별자, 이메일, 이름, 프로필 이미지, 고유 닉네임, 한 줄 소개" purpose="회원 식별, 로그인, 서비스 내 프로필 표시" />
                <DataItem title="풀이 연동" items="문제 ID·제목·URL, 언어, 풀이 시작·정답 시각, 소요 시간, 기기 이름, 기기별 연동 토큰의 해시값과 마지막 통신 시각" purpose="풀이 자동 기록, 다중 기기 연결, 대시보드와 스터디 진행도 제공" />
                <DataItem title="친구·스터디" items="친구 요청 및 관계, 스터디 가입·탈퇴 이력, 방 정보·목표·접근 확인, 작성한 댓글" purpose="친구 및 스터디 협업 기능 제공" />
                <DataItem title="푸시 알림" items="스터디별 알림 동의, 브라우저 푸시 구독 주소와 암호화 키, 브라우저 정보, 목표 알림 및 콕 찌르기 발송 기록" purpose="목표 마감 및 스터디 구성원 독려 알림 전달, 중복·과도한 발송 방지" />
                <DataItem title="자동 생성 정보" items="인증 쿠키, IP 주소, 접속 일시, 브라우저·기기 정보, 이용 및 오류 기록" purpose="세션 유지, 보안, 장애 대응 및 서비스 개선" />
              </div>
              <p>회원 정보는 Google 로그인과 온보딩 과정에서, 풀이 정보는 이용자가 연결한 Chrome 확장 프로그램에서, 활동 정보는 서비스 기능을 이용하는 과정에서 수집됩니다.</p>
              <p>고유 닉네임, 프로필 이미지와 한 줄 소개는 랭킹, 친구 검색 및 스터디 활동 과정에서 다른 로그인 이용자에게 표시될 수 있으며, 스터디 댓글과 진행도는 해당 스터디 구성원에게 제공됩니다.</p>
            </PolicySection>

            <PolicySection id="retention" number={3} title="보유기간 및 파기 방법">
              <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                <li><strong className="font-medium text-foreground">회원·풀이·친구·스터디 정보:</strong> 회원 탈퇴 시까지</li>
                <li><strong className="font-medium text-foreground">연동 정보:</strong> 연동 해제, 토큰 재발급 또는 회원 탈퇴 시까지</li>
                <li><strong className="font-medium text-foreground">푸시 구독·발송 기록:</strong> 구독 만료·알림 해제 또는 회원 탈퇴 시까지. 만료된 구독은 발송 과정에서 확인되는 즉시 삭제</li>
                <li><strong className="font-medium text-foreground">인증 쿠키:</strong> 로그아웃 또는 세션 만료 시까지</li>
                <li><strong className="font-medium text-foreground">접속·오류 기록:</strong> 보안과 장애 대응에 필요한 기간 또는 관계 법령과 인프라 제공자의 정책에 따른 기간</li>
              </ul>
              <p>회원 탈퇴 시 인증 계정과 연결된 프로필, 풀이, 친구, 스터디, 댓글 및 연동 정보를 데이터베이스에서 삭제합니다. 전자적 파일은 복구하기 어려운 방법으로 삭제하며, 법령상 보존 의무가 있는 정보는 별도로 분리해 정해진 기간 후 파기합니다.</p>
            </PolicySection>

            <PolicySection id="services" number={4} title="제3자 제공 및 외부 서비스 이용">
              <p>운영자는 이용자의 개인정보를 원칙적으로 제3자에게 판매하거나 제공하지 않습니다. 다만 서비스 운영을 위해 아래 외부 서비스를 이용하며, 각 제공자의 인프라 위치에 따라 정보가 국외에서 처리될 수 있습니다.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Google", "OAuth 로그인 및 본인 인증", "https://policies.google.com/privacy"],
                  ["Supabase", "인증, 데이터베이스 및 실시간 기능", "https://supabase.com/privacy"],
                  ["Vercel", "웹 서비스 호스팅 및 이용 분석", "https://vercel.com/legal/privacy-policy"],
                ].map(([name, purpose, href]) => (
                  <a key={name} href={href} target="_blank" rel="noreferrer" className="group rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.055] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">{name}<ExternalLink className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" /></span>
                    <span className="mt-2 block text-xs leading-5">{purpose}</span>
                  </a>
                ))}
              </div>
              <p>웹 푸시 알림을 허용하면 이용 중인 브라우저 제공자의 푸시 전송 서비스가 구독 주소와 알림 전달 정보를 처리할 수 있으며, 해당 처리는 브라우저 및 운영체제 제공자의 정책을 따릅니다.</p>
              <p>법령에 근거가 있거나 이용자가 별도로 동의한 경우에는 고지된 범위 안에서 개인정보를 제공할 수 있습니다.</p>
            </PolicySection>

            <PolicySection id="rights" number={5} title="이용자의 권리와 행사 방법">
              <p>이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지 및 동의 철회를 요구할 수 있습니다. 마이페이지에서 로그아웃과 회원 탈퇴를 직접 처리할 수 있으며, 연동 해제 등 그 밖의 요청은 아래 개인정보 문의 창구로 접수할 수 있습니다.</p>
              <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.055]">
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">회원 탈퇴 전 확인해 주세요</p>
                    <p className="mt-1 text-sm">탈퇴하면 계정과 연결된 풀이·친구·스터디 데이터가 삭제되며 복구할 수 없습니다.</p>
                  </div>
                </div>
              </div>
            </PolicySection>

            <PolicySection id="safety" number={6} title="개인정보의 안전성 확보 조치">
              <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                <li>HTTPS 암호화 통신과 보안 속성이 적용된 인증 쿠키 사용</li>
                <li>데이터베이스 Row Level Security를 통한 사용자별 접근 제한</li>
                <li>프로그래머스 기기별 연동 토큰과 비공개방 비밀번호를 원문이 아닌 해시값으로 저장</li>
                <li>서버 전용 비밀키와 브라우저 공개키 분리, 최소 권한에 따른 접근 제어</li>
              </ul>
            </PolicySection>

            <PolicySection id="cookies" number={7} title="쿠키 및 자동 수집 장치">
              <div className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.055]">
                <Cookie className="mt-0.5 size-5 shrink-0 text-primary" />
                <p>서비스는 로그인 상태와 보안을 유지하기 위해 필수 인증 쿠키를 사용합니다. 테마 설정은 이용자의 브라우저에 저장될 수 있으며, 현재 자체 광고 목적의 추적 쿠키는 사용하지 않습니다.</p>
              </div>
              <p>브라우저 설정에서 쿠키를 삭제하거나 차단할 수 있지만, 필수 쿠키를 차단하면 로그인과 일부 기능을 이용하지 못할 수 있습니다.</p>
            </PolicySection>

            <PolicySection id="contact" number={8} title="개인정보 보호책임자 및 권익침해 구제">
              <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.055]">
                <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-xs font-medium">개인정보 보호책임자</dt>
                  <dd className="text-foreground">Solve-Sync 운영자</dd>
                  <dt className="text-xs font-medium">문의 창구</dt>
                  <dd>
                    {contactEmail ? (
                      <a className="font-medium text-primary underline-offset-4 hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>
                    ) : (
                      <a className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline" href="https://github.com/ggwanrok/solve-sync/issues" target="_blank" rel="noreferrer">
                        <Github className="size-4" /> GitHub 문의 창구
                      </a>
                    )}
                  </dd>
                </dl>
                {!contactEmail && <p className="mt-4 border-t pt-4 text-xs">공개 이슈에는 이메일, 토큰 등 민감한 개인정보를 작성하지 마세요. 운영 환경에 문의 이메일이 설정되면 해당 이메일이 이곳에 표시됩니다.</p>}
              </div>
              <p>개인정보 침해에 대한 상담이나 구제가 필요한 경우 개인정보침해 신고센터(국번 없이 118), 개인정보분쟁조정위원회(1833-6972), 경찰청 사이버범죄 신고시스템(국번 없이 182)을 이용할 수 있습니다.</p>
            </PolicySection>

            <section className="border-t pt-10">
              <p className="text-xs font-semibold text-primary">09</p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">처리방침의 변경</h2>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">법령, 서비스 또는 개인정보 처리 방식이 변경되면 이 페이지를 통해 변경 내용과 시행일을 안내합니다. 중요한 변경은 시행 전에 서비스 내에서 별도로 알립니다.</p>
              <p className="mt-4 text-sm font-medium">공고 및 시행일: {effectiveDate}</p>
            </section>
          </article>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
          <span>© {new Date().getFullYear()} Solve-Sync</span>
          <span>개인정보 처리방침 · {effectiveDate} 시행</span>
        </div>
      </footer>
    </div>
  )
}
