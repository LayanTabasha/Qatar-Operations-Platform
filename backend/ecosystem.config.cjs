/* global __dirname */

module.exports = {
  apps: [
    {
      name: "qatar-operations-api",
      cwd: __dirname,
      script: "src/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
