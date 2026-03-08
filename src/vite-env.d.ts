/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_API_KEY: string
  readonly VITE_CESIUM_ION_TOKEN?: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyN2U1ZGYxZC1jY2NhLTRhMzctODAzYi0zYzBlZjFlOGE5YTIiLCJpZCI6NDAwMDA4LCJpYXQiOjE3NzI5MjU1Nzh9.Mq11O-s9BDYo1uaPGxpf_hUtj-TZsHo6EhFZhar3dbI
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
