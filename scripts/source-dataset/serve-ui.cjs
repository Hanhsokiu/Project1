"use strict";
const path=require("node:path"),{spawn}=require("node:child_process"),{root}=require("./sources.cjs");
const child=spawn(process.execPath,[path.join(root,"frontend/node_modules/vite/bin/vite.js"),"--host","127.0.0.1","--port","5183","--strictPort"],{cwd:path.join(root,"frontend"),windowsHide:true,stdio:"inherit",env:{...process.env,DATN_PREVIEW_API_TARGET:"http://127.0.0.1:3011",VITE_AUTH_API:"true",VITE_DEMO_MODE:"false",VITE_API_URL:"/api"}});
child.on("error",()=>{console.error("UI startup failed.");process.exitCode=1;});child.on("exit",code=>{process.exitCode=code||0;});
