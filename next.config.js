/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // 任何您想在客户端暴露的环境变量都可以在这里配置
    // 但不要包含敏感信息如API密钥
  }
}

module.exports = nextConfig 