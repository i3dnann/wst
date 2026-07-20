module.exports = {
  apps: [
    {
      name: "mafia-api",
      cwd: __dirname,
      script: "dist/server.js",
      instances: 2,
      exec_mode: "cluster",
      env_production: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 200,
      merge_logs: true,
      time: true,
    },
  ],
};
