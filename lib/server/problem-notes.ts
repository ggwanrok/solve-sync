import type { SupabaseClient } from "@supabase/supabase-js"
import type { SolvedProblemNote } from "@/lib/problem-memo"

// 오래된 풀이에서 지정한 복습 문제도 빠지지 않도록 DB 응답 제한보다 작은 단위로 조회한다.
export async function loadProblemNotes(supabase: SupabaseClient, userId: string): Promise<SolvedProblemNote[]> {
  const problems: SolvedProblemNote[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data: solves, error: solveError } = await supabase.from("solve_events")
      .select("id,problem_id,title,url,language,problem_type,difficulty,accepted_at")
      .eq("user_id", userId).eq("platform", "programmers")
      .order("accepted_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (solveError) throw new Error("풀이 목록을 불러오지 못했습니다.", { cause: solveError })
    if (!solves?.length) break

    const problemIds = solves.map((solve) => solve.problem_id)
    const [memos, reviews] = await Promise.all([
      supabase.from("problem_memos")
        .select("problem_id,algorithm_tags,approach,solution_code,difficulty_reason,learnings,updated_at")
        .eq("user_id", userId).eq("platform", "programmers").in("problem_id", problemIds),
      supabase.from("problem_reviews").select("problem_id")
        .eq("user_id", userId).eq("platform", "programmers").in("problem_id", problemIds),
    ])
    if (memos.error || reviews.error) {
      throw new Error("문제 메모와 복습 지정을 불러오지 못했습니다.", { cause: memos.error || reviews.error })
    }
    const memoByProblem = new Map((memos.data || []).map((memo) => [memo.problem_id, memo]))
    const reviewIds = new Set((reviews.data || []).map((review) => review.problem_id))
    for (const solve of solves) {
      const memo = memoByProblem.get(solve.problem_id)
      problems.push({
        id: solve.id,
        problemId: solve.problem_id,
        title: solve.title || `문제 ${solve.problem_id}`,
        url: solve.url,
        language: solve.language,
        problemType: solve.problem_type,
        difficulty: solve.difficulty,
        acceptedAt: solve.accepted_at,
        needsReview: reviewIds.has(solve.problem_id),
        memo: memo ? {
          algorithmTags: memo.algorithm_tags,
          approach: memo.approach,
          solutionCode: memo.solution_code,
          difficultyReason: memo.difficulty_reason,
          learnings: memo.learnings,
          updatedAt: memo.updated_at,
        } : null,
      })
    }
    if (solves.length < pageSize) break
  }
  return problems
}
