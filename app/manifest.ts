import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SolveSync",
    short_name: "SolveSync",
    description: "친구와 함께 목표를 이어가는 코딩테스트 스터디 플랫폼",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a269",
    icons: [
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  }
}
