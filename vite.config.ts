import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
export default defineConfig(({mode}) => {
 const configured=process.env.APP_ORIGIN||loadEnv(mode,process.cwd(),'APP_ORIGIN').APP_ORIGIN||'http://localhost:5173';
 const canonical=new URL(configured);
 const mobileCert=process.env.MOBILE_TLS_CERT;
 const mobileKey=process.env.MOBILE_TLS_KEY;
 const tailnetMode=process.env.TAILNET_MODE==='1';
 if (Boolean(mobileCert) !== Boolean(mobileKey)) throw new Error('Both mobile TLS files are required.');
 return {
  plugins: [react(), {
    name:'canonical-local-address',
    configureServer(server){
      server.middlewares.use((req,res,next)=>{
        // Redirect documents, never replay a write or weaken the API origin check.
        const alias=req.headers.host==='127.0.0.1:'+canonical.port;
        if(canonical.hostname==='localhost'&&alias&&req.method==='GET'&&req.headers.accept?.includes('text/html')){
          res.statusCode=302;res.setHeader('Location',canonical.origin+(req.url||'/'));res.end();return;
        }
        next();
      });
    }
  }],
  server: {
    port: 5173,
    strictPort: true,
    host: mobileCert ? '0.0.0.0' : '127.0.0.1',
    ...(tailnetMode ? { allowedHosts: [canonical.hostname] } : {}),
    ...(mobileCert && mobileKey ? { https: { cert: readFileSync(mobileCert), key: readFileSync(mobileKey) } } : {}),
    proxy: { "/api": "http://127.0.0.1:4100" },
  },
}; });
