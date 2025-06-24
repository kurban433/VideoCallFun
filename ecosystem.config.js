module.exports = {
  apps: [{
    name: 'video-call-app',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*'
    }
  }]
}; 