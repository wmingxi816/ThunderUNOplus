module.exports = {
  apps: [
    {
      name: "game-server",
      cwd: "/www/wwwroot/ThunderUNOplus",
      script: "apps/game-server/dist/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 8787
      }
    }
  ]
};
