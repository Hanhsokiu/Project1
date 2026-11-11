"""Execute local offline checks only, recording new evidence, never DB CLI writes."""
from pathlib import Path
import importlib.util
import json
import os
import subprocess
import sys

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('uc_chain',HERE/'prepare-uc17-24.py')
chain=importlib.util.module_from_spec(spec);spec.loader.exec_module(chain)
ROOT=chain.ROOT
OUT=ROOT/'backend/prisma/deployment/uc17-24/evidence'
OUT.mkdir(parents=True,exist_ok=True)
chain.verify()
stages=[chain.stage(uc) for uc in range(16,25)]
env=dict(os.environ)
env.update(DATABASE_URL='postgresql://offline:offline@invalid.invalid:1/offline',DIRECT_URL='postgresql://offline:offline@invalid.invalid:1/offline',CHECKPOINT_DISABLE='1',PRISMA_HIDE_UPDATE_MESSAGE='1',VITE_AUTH_API='true',VITE_DEMO_MODE='false',VITE_API_URL='/api')
backend=ROOT/'backend';frontend=ROOT/'frontend';shared=ROOT/'shared'
checks=[
 ('migration-tool-tests',ROOT,[sys.executable,str(HERE/'prepare-uc17-24.check.py')]),
 ('existing-db-tool-unit-tests',backend,['node','--test','scripts/database-test.check.cjs','scripts/shared-database.check.cjs']),
 ('shared-build',shared,['node',str(shared/'node_modules/typescript/bin/tsc')]),
 ('backend-typecheck',backend,['node',str(backend/'node_modules/typescript/bin/tsc'),'--noEmit']),
 ('frontend-typecheck',frontend,['node',str(frontend/'node_modules/typescript/bin/tsc'),'--noEmit']),
 ('backend-lint',backend,['node',str(backend/'node_modules/eslint/bin/eslint.js'),'src','--ext','.ts']),
 ('frontend-lint',frontend,['node',str(frontend/'node_modules/eslint/bin/eslint.js'),'src','--ext','.ts,.tsx']),
 ('backend-build',backend,['node',str(backend/'node_modules/@nestjs/cli/bin/nest.js'),'build']),
 ('frontend-build',frontend,['node',str(frontend/'node_modules/vite/bin/vite.js'),'build']),
 ('prisma-validate',stages[-1],['node',str(backend/'node_modules/prisma/build/index.js'),'validate','--schema',str(stages[-1]/'schema.prisma')]),
 ('prisma-deploy-help-only',stages[-1],['node',str(backend/'node_modules/prisma/build/index.js'),'migrate','deploy','--help']),
 ('diff-check',ROOT,['git','diff','--check']),
]
results=[]
for name,cwd,args in checks:
    done=subprocess.run(args,cwd=cwd,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
    (OUT/f'{name}.txt').write_text(done.stdout+done.stderr,encoding='utf-8')
    results.append({'check':name,'exitCode':done.returncode,'status':'PASS' if done.returncode==0 else 'FAIL','command':args,'cwd':str(cwd)})
    (OUT/'offline-checks.json').write_text(json.dumps({'checks':results,'postgresqlRehearsal':'BLOCKED_NO_APPROVED_ENVIRONMENT','databaseConnected':False},indent=2)+'\n',encoding='utf-8')
    print(name,done.returncode,flush=True)
if any(x['exitCode'] for x in results):raise SystemExit(1)
