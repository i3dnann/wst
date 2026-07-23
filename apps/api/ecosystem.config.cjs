module.exports = {
  apps: [
    {
      name: "worldstar-api",
      cwd: __dirname,
      script: "dist/server.js",
      // Live tournament draws are held in process memory. Keep one authoritative
      // worker until this state is moved to a shared store such as Redis.
      instances: 1,
      exec_mode: "cluster",
      env_production: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 200,
      merge_logs: true,
      time: true,
    },
  ],
};
