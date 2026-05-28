module.exports = {
  apps: [
    {
      name: "game-server",
      cwd: "/www/wwwroot/ThunderUNOplus/apps/game-server",
      script: "node_modules/.bin/tsx",
      args: "src/dev/runLocalServer.ts",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 8787
      }
    }
  ]
};
