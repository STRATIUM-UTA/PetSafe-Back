module.exports = {
  apps: [
    {
      name: 'petsafe-api',
      cwd: __dirname,
      script: 'dist/main.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 5000,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
