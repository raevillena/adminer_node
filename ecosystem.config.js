module.exports = {
  apps: [{
    name: 'adminer-backend',
    script: './backend/dist/index.js',
    cwd: '/var/www/adminer-node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
