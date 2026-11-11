"""Offline promotion/staging only. No DB driver, .env, subprocess or network.
SQL starts from authenticated review v2 entries; explicitly recorded unapplied
candidate fixes from real rehearsal are separately pinned in rehearsal-fixes.json.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
from urllib.parse import urlsplit, parse_qsl, unquote
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ZIP_NAME = 'DATN-UC18-UC25-database-review-v2.zip'
ZIP_SHA = '6F4F8808B8B37C9B72FA3444734E78C8E67943B2CB794E80AE224167201E38F6'
FOLDERS = ['final-defense','defense-eligibility','defense-committee','defense-reviewers','defense-scheduling','defense-reviewer-grading','defense-committee-grading','defense-final-results']
SUFFIXES = ['final_defense','defense_eligibility','defense_committee','defense_reviewers','defense_scheduling','defense_reviewer_grading','defense_committee_grading','defense_final_results']
NAMES = [f'20261109{i:04}_uc{uc}_{suffix}' for i,(uc,suffix) in enumerate(zip(range(17,25),SUFFIXES),1)]
ATTRIBUTES = ('# Preserve reviewed SQL bytes across Git checkouts; baseline migrations unaffected.\n'+'\n'.join(n+'/migration.sql -text' for n in NAMES)+'\n').encode()
MANIFEST = 'backend/prisma/uc17-24-chain.json'
DEPLOY = 'backend/prisma/deployment/uc17-24'
RELEASE_TAIL = {
    '20261109150000_uc24_uc25_rbac_permissions': '1D309BE4A0A43FD782594BACECC31D489FF06E6CFF68C2CBACD27F0C0070A082',
    '202611110001_uc24_fr_guard_forward_fix': 'A7E0384E8C821925E8C0B034DB38AD793440FE3A907FA7DD23B4598E121AC3E7',
}

def sha(data): return hashlib.sha256(data).hexdigest().upper()
def sql_literal(value): return "'"+str(value).replace("'","''")+"'"
def migration_names(root):
    base=root/'backend/prisma/migrations'
    return sorted(p.name for p in base.iterdir() if p.is_dir() and (p/'migration.sql').is_file())

def pinned_inputs(root):
    data=(root/ZIP_NAME).read_bytes()
    if sha(data)!=ZIP_SHA: raise ValueError('Review v2 ZIP checksum mismatch')
    with zipfile.ZipFile(root/ZIP_NAME) as archive:
        manifest=json.loads(archive.read('PACKAGE-MANIFEST.json'))
        entries={x['path']:x for x in manifest['files']}
        result=[]
        for uc,folder,name in zip(range(17,25),FOLDERS,NAMES):
            source=f'migrations/{folder}/migration.sql'; content=archive.read(source)
            if sha(content)!=entries[source]['sha256']: raise ValueError('ZIP SQL mismatch')
            result.append({'uc':uc,'name':name,'source':source,'sha256':sha(content),'bytes':content})
        baseline={n.removeprefix('reference/b1-b8-migrations/'):archive.read(n) for n in archive.namelist() if n.startswith('reference/b1-b8-migrations/') and not n.endswith('/')}
    ledger=root/DEPLOY/'rehearsal-fixes.json'
    if ledger.exists():
        patches=json.loads(ledger.read_text(encoding='utf-8'))['unappliedCandidateFixes']
        seen=set()
        for patch in patches:
            if patch['uc'] in seen: raise ValueError('Duplicate candidate patch')
            seen.add(patch['uc'])
            item=next(x for x in result if x['uc']==patch['uc'])
            if item['sha256']!=patch['reviewedSha256']: raise ValueError('Candidate patch original pin mismatch')
            content=(root/'backend/prisma/migrations'/item['name']/'migration.sql').read_bytes()
            if sha(content)!=patch['candidateSha256']: raise ValueError('Candidate patch bytes mismatch')
            item['reviewedSha256']=item['sha256'];item['sha256']=sha(content);item['bytes']=content
    return result,baseline

def safe_write(path,data):
    if path.is_symlink() or any(p.is_symlink() for p in path.parents): raise ValueError('Symlink refused')
    if path.exists():
        if not path.is_file() or path.read_bytes()!=data: raise ValueError(f'Refusing overwrite: {path.name}')
        return
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)

def install(root=ROOT):
    targets,baseline=pinned_inputs(root)
    base=root/'backend/prisma/migrations'
    expected_baseline=sorted(n.split('/')[0] for n in baseline if n.endswith('/migration.sql'))
    if len(expected_baseline)!=17: raise ValueError('Expected 17 B1-B8 migrations')
    for name,content in baseline.items():
        if (base/name).read_bytes()!=content: raise ValueError('Baseline bytes changed: '+name)
    names=migration_names(root)
    if set(names)-set(expected_baseline)-set(NAMES): raise ValueError('Unknown migration directory; stop')
    # Validate every destination before any installation; never overwrite edits.
    for item in targets:
        dest=base/item['name']
        if dest.exists() and (not (dest/'migration.sql').is_file() or (dest/'migration.sql').read_bytes()!=item['bytes'] or set(p.name for p in dest.iterdir())!={'migration.sql'}):
            raise ValueError('Migration destination collision: '+item['name'])
    for item in targets: safe_write(base/item['name']/'migration.sql',item['bytes'])
    safe_write(base/'.gitattributes',ATTRIBUTES)
    evidence={'sourceZip':ZIP_NAME,'sourceZipSha256':ZIP_SHA,'baseline':[{'name':n,'sha256':sha(baseline[n+'/migration.sql'])} for n in expected_baseline],
      'migrations':[{k:v for k,v in item.items() if k!='bytes'}|{'dependsOn':expected_baseline[-1] if i==0 else targets[i-1]['name']} for i,item in enumerate(targets)],
      'migrationLockSha256':sha(baseline['migration_lock.toml']),'schemaSha256':sha((root/'backend/prisma/schema.prisma').read_bytes()),
      'postgresqlRehearsal':'BLOCKED_NO_APPROVED_ENVIRONMENT','databaseConnected':False,'writeFlagsChanged':False}
    safe_write(root/MANIFEST,(json.dumps(evidence,indent=2)+'\n').encode())
    return verify(root)

def verify(root=ROOT):
    evidence=json.loads((root/MANIFEST).read_text(encoding='utf-8'))
    names=migration_names(root)
    expected=[x['name'] for x in evidence['baseline']]+NAMES
    release = names == expected + list(RELEASE_TAIL)
    if release:
        # Promotion is finished. A clean release checkout must verify the pinned
        # official source without shipping the historical/private review ZIP.
        base=root/'backend/prisma/migrations'
        baseline={x['name']+'/migration.sql':(base/x['name']/'migration.sql').read_bytes() for x in evidence['baseline']}
        baseline['migration_lock.toml']=(base/'migration_lock.toml').read_bytes()
        targets=[dict(x,bytes=(base/x['name']/'migration.sql').read_bytes()) for x in evidence['migrations']]
        if len(targets)!=8: raise ValueError('Expected eight promoted UC migrations')
        for i,item in enumerate(targets):
            if item['name']!=NAMES[i] or item['uc']!=17+i or item['source']!=f'migrations/{FOLDERS[i]}/migration.sql':
                raise ValueError('Promoted manifest identity drift')
        for name,checksum in RELEASE_TAIL.items():
            if sha((base/name/'migration.sql').read_bytes())!=checksum: raise ValueError('Applied release SQL changed: '+name)
        lines=[x.strip() for x in (base/'.gitattributes').read_text().splitlines() if x.strip() and not x.startswith('#')]
        if lines!=['0_init/migration.sql text eol=crlf']+[n+'/migration.sql -text' for n in NAMES+list(RELEASE_TAIL)]:
            raise ValueError('Applied SQL checkout byte rules changed')
    else:
        targets,baseline=pinned_inputs(root)
        if names!=expected or len(names)!=25: raise ValueError('Exact 17+8 ordered migration chain required')
        if (root/'backend/prisma/migrations/.gitattributes').read_bytes()!=ATTRIBUTES: raise ValueError('Reviewed SQL byte preservation attributes changed')
    for rel,content in baseline.items():
        if (root/'backend/prisma/migrations'/rel).read_bytes()!=content: raise ValueError('Baseline mismatch')
    for i,item in enumerate(targets):
        if (root/'backend/prisma/migrations'/item['name']/'migration.sql').read_bytes()!=item['bytes']: raise ValueError('Official SQL differs from ZIP')
        record=evidence['migrations'][i]
        if sha(item['bytes'])!=record['sha256']: raise ValueError('Official SQL checksum drift')
        if record['name']!=item['name'] or record['sha256']!=item['sha256'] or record['source']!=item['source'] or record['uc']!=item['uc']: raise ValueError('Manifest drift')
        if record.get('reviewedSha256')!=item.get('reviewedSha256'): raise ValueError('Reviewed candidate pin drift')
        if record['dependsOn']!=expected[16+i]: raise ValueError('Dependency order mismatch')
    if evidence['baseline']!=[{'name':n,'sha256':sha(baseline[n+'/migration.sql'])} for n in expected[:17]]: raise ValueError('Baseline manifest drift')
    if evidence['migrationLockSha256']!=sha(baseline['migration_lock.toml']): raise ValueError('Migration lock drift')
    if evidence['sourceZipSha256']!=ZIP_SHA: raise ValueError('Source pin drift')
    schema=(root/'backend/prisma/schema.prisma').read_bytes()
    schema_pins={sha(schema)}
    if release:
        # Datamodel text can be checked out as LF on Linux. This does not relax
        # any SQL checksum: only equivalent Prisma-schema line endings qualify.
        schema_pins.add(sha(schema.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')))
    if evidence['schemaSha256'] not in schema_pins: raise ValueError('Schema changed after staging; review first')
    return evidence

def stage(through,root=ROOT):
    if through not in range(16,25): raise ValueError('Only B1-B8 baseline or UC17-UC24 checkpoints')
    evidence=verify(root)
    label='b1-b8' if through==16 else f'uc{through}'
    stage_root=root/f'.cache/uc17-24-deploy/{label}/prisma'
    if (stage_root/'.env').exists() or (stage_root.parent/'.env').exists(): raise ValueError('Unexpected environment file in stage')
    wanted=evidence['baseline']+evidence['migrations'][:through-16]
    dest=stage_root/'migrations'
    if dest.exists():
        existing={p.name for p in dest.iterdir()}
        if existing-({x['name'] for x in wanted}|{'migration_lock.toml'}): raise ValueError('Stage contains future/unknown migrations')
    for item in wanted:
        output=dest/item['name']/'migration.sql'
        content=(root/'backend/prisma/migrations'/item['name']/'migration.sql').read_bytes()
        if output.exists() and not output.is_symlink() and item.get('reviewedSha256') and sha(output.read_bytes())==item['reviewedSha256']:
            output.write_bytes(content)  # only the pinned old staged artifact of an explicitly recorded unapplied fix
        else: safe_write(output,content)
    safe_write(dest/'migration_lock.toml',(root/'backend/prisma/migrations/migration_lock.toml').read_bytes())
    safe_write(stage_root/'schema.prisma',(root/'backend/prisma/schema.prisma').read_bytes())
    if migration_names_stage(dest)!=[x['name'] for x in wanted]: raise ValueError('Staged chain mismatch')
    return stage_root

def migration_names_stage(dest):
    return sorted(p.name for p in dest.iterdir() if p.is_dir() and (p/'migration.sql').is_file())

def objects(sql):
    out={'columns':[],'constraints':[],'functions':[],'triggers':[],'indexes':[]}
    for match in re.finditer(r'ALTER TABLE public\."([^"]+)"(.*?);',sql,re.S):
        table,body=match.groups()
        out['columns'] += [(table,n) for n in re.findall(r'ADD COLUMN (\w+)',body)]
        out['constraints'] += [(table,n) for n in re.findall(r'ADD CONSTRAINT (\w+)',body)]
    if 'CREATE TABLE public."DEFENSE_COMMITTEE_ASSIGNMENT"' in sql:
        out['constraints'].append(('DEFENSE_COMMITTEE_ASSIGNMENT','cca_provenance_valid'))
    for m in re.finditer(r'CREATE FUNCTION public\.(\w+)\(.*?AS \$\$(.*?)\$\$;',sql,re.S):
        out['functions'].append((m[1],m[2], 'SET row_security=off' in m[0].split('AS $$')[0]))
    for m in re.finditer(r'CREATE (CONSTRAINT )?TRIGGER (\w+) (.*?) ON public\."([^"]+)"(.*?)EXECUTE FUNCTION public\.(\w+)\(.*?\);',sql,re.S):
        _,name,events,table,tail,fn=m.groups()
        bits=(1 if 'FOR EACH ROW' in tail else 0)+(2 if events.startswith('BEFORE ') else 0)+sum(bit for event,bit in [('INSERT',4),('DELETE',8),('UPDATE',16)] if re.search(r'\b'+event+r'\b',events))
        out['triggers'].append((table,name,fn,bits,bool(m[1])))
    for m in re.finditer(r'CREATE (UNIQUE )?INDEX "([^"]+)" ON public\."([^"]+)"',sql): out['indexes'].append((m[3],m[2],bool(m[1])))
    return out

def assertion(expression,message):
    # PG16/17 psql \quit does not accept a failure exit code. A deliberate
    # SELECT error plus ON_ERROR_STOP makes a failed assertion exit nonzero.
    return f"SELECT ({expression}) AS uc_ok \\gset\n\\if :uc_ok\n\\else\n\\echo {message}\nSELECT 1/0 AS uc_checkpoint_failed;\n\\endif\n"

def checkpoints(root=ROOT,refresh=False):
    evidence=verify(root)
    records=evidence['baseline']+evidence['migrations']
    cumulative=[]
    for item in evidence['migrations']:
        cumulative.append(objects((root/'backend/prisma/migrations'/item['name']/'migration.sql').read_bytes().decode('utf-8')))
        uc=item['uc']
        for phase,count in [('preflight',uc),('postflight',uc+1)]:
            # baseline17 + UC17 first => before UC17 has17, after has18.
            prefix=records[:count]
            script="-- Prepared for psql only; NOT EXECUTED. Metadata SELECTs in READ ONLY.\n\\set ON_ERROR_STOP on\nBEGIN READ ONLY;\n"
            script+=assertion("current_database()=:'expected_database' AND current_user=:'expected_role' AND current_setting('server_version_num')::integer/10000=:'expected_pg_major'::integer AND current_setting('standard_conforming_strings')='on'",'STOP_target_identity_mismatch')
            script+="SELECT current_database(),current_user,current_setting('server_version'),current_setting('transaction_read_only');\n"
            values=',\n'.join('('+sql_literal(x['name'])+','+sql_literal(x['sha256'].lower())+')' for x in prefix)
            script+=assertion(f'''NOT EXISTS(SELECT 1 FROM (VALUES {values}) e(name,sha)
 LEFT JOIN public."_prisma_migrations" m ON m.migration_name=e.name
 WHERE m.migration_name IS NULL OR m.checksum IS DISTINCT FROM e.sha OR m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL)
 AND (SELECT count(*) FROM public."_prisma_migrations")={len(prefix)}''','STOP_history_checksum_or_prefix_mismatch')
            # Validate prerequisite objects before next UC and current objects after.
            active=cumulative if phase=='postflight' else cumulative[:-1]
            for group in active:
                for table,col in group['columns']:
                    script+=assertion(f"EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name={sql_literal(table)} AND column_name={sql_literal(col)})",'STOP_column_missing')
                for table,name in group['constraints']:
                    script+=assertion(f"EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass({sql_literal('public.\"'+table+'\"')}) AND conname={sql_literal(name)} AND convalidated)",'STOP_constraint_missing_or_unvalidated')
                for name,body,row_off in group['functions']:
                    expected=body.replace('\r\n','\n')
                    config=" AND p.proconfig @> ARRAY['row_security=off']" if row_off else ''
                    script+=assertion(f"EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname={sql_literal(name)} AND NOT p.prosecdef AND p.provolatile='v'{config} AND EXISTS(SELECT 1 FROM unnest(p.proconfig) cfg WHERE replace(cfg,' ','')='search_path=pg_catalog,public') AND replace(p.prosrc,E'\\r\\n',E'\\n')={sql_literal(expected)})",'STOP_function_body_or_config_mismatch')
                for table,name,fn,bits,deferred in group['triggers']:
                    script+=assertion(f"EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid=to_regclass({sql_literal('public.\"'+table+'\"')}) AND t.tgname={sql_literal(name)} AND t.tgtype::integer={bits} AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname={sql_literal(fn)} AND t.tgdeferrable={str(deferred).lower()} AND t.tginitdeferred={str(deferred).lower()})",'STOP_trigger_binding_or_timing_mismatch')
                for table,name,unique in group['indexes']:
                    script+=assertion(f"EXISTS(SELECT 1 FROM pg_index WHERE indrelid=to_regclass({sql_literal('public.\"'+table+'\"')}) AND indexrelid=to_regclass({sql_literal('public.\"'+name+'\"')}) AND indisvalid AND indisready AND indisunique={str(unique).lower()})",'STOP_index_invalid')
            if (phase=='postflight' and uc>=19) or (phase=='preflight' and uc>=20):
                script+=assertion('''EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND relrowsecurity)
 AND (SELECT count(*) FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_COMMITTEE_ASSIGNMENT"') AND contype='f' AND convalidated)=6''','STOP_UC19_new_table_RLS_or_FK_mismatch')
            if active:
                script+=assertion('''EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public."FINAL_REPORT_VERSION"') AND relrowsecurity)
 AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."DEFENSE_CONFIRMATION"') AND conname='final_confirmation_version_fk' AND contype='f' AND convalidated)
 AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public."SCORE_ENTRY"') AND conname='advisor_score_version_fk' AND contype='f' AND convalidated)''','STOP_UC17_RLS_or_FK_mismatch')
            script+="COMMIT;\n\\echo PASS_metadata_checkpoint_only_behavioral_rehearsal_still_required\n"
            output=root/DEPLOY/f'uc{uc}-{phase}.sql'
            if refresh and output.exists() and not output.is_symlink() and output.read_bytes().startswith(b'-- Prepared for psql only; NOT EXECUTED.'):
                output.write_bytes(script.encode())
            else: safe_write(output,script.encode())
    return len(evidence['migrations'])*2

def target(env,host,port,database,user):
    """Compare endpoints in memory. No secret output, file or connection."""
    expected=(host,str(port),database,user)
    if not all(expected) or not (1<=int(port)<=65535) or str(port)=='6543': raise ValueError('Invalid/session-pooler target required')
    if any(env.get(k) for k in ['PGSERVICE','PGSERVICEFILE','PGOPTIONS']): raise ValueError('Libpq target override is not allowed')
    pg=(env.get('PGHOST'),env.get('PGPORT'),env.get('PGDATABASE'),env.get('PGUSER'))
    if pg!=expected: raise ValueError('PG endpoint does not match explicit approved target')
    remote=host not in ('127.0.0.1','localhost','::1')
    if remote and env.get('PGSSLMODE')!='require': raise ValueError('Remote PGSSLMODE=require required')
    credentials=[]
    for key in ['DATABASE_URL','DIRECT_URL']:
        try:
            value=urlsplit(env.get(key,''))
            got=(value.hostname,str(value.port or 5432),unquote(value.path.lstrip('/')),unquote(value.username or ''))
            query=parse_qsl(value.query,keep_blank_values=True)
            if value.scheme not in ('postgresql','postgres') or value.fragment or got!=expected: raise ValueError()
            if len({k for k,v in query})!=len(query): raise ValueError()
            options=dict(query)
            if set(options)-{'schema','sslmode','connection_limit','pool_timeout','connect_timeout'}: raise ValueError()
            if options.get('schema','public')!='public': raise ValueError()
            if remote and options.get('sslmode')!='require': raise ValueError()
            credentials.append(unquote(value.password or ''))
        except (ValueError,TypeError): raise ValueError('Prisma endpoint/options do not match approved target') from None
    if not credentials[0] or credentials[0]!=credentials[1]: raise ValueError('Prisma credentials must target the same migration login')
    if env.get('PGPASSWORD') and env['PGPASSWORD']!=credentials[0]: raise ValueError('PGPASSWORD differs from Prisma login')
    return True

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['install','verify','stage','checkpoints','target'])
    parser.add_argument('--through',type=int,choices=range(16,25),help='16 means the unchanged 17-migration B1-B8 prerequisite only')
    parser.add_argument('--host');parser.add_argument('--port',type=int)
    parser.add_argument('--database');parser.add_argument('--user')
    parser.add_argument('--refresh-generated',action='store_true',help='Regenerate prepared read-only checkpoints after an explicitly recorded unapplied candidate fix')
    args=parser.parse_args()
    if args.action=='install': install(); print('PASS: pinned review SQL and recorded unapplied candidate fixes installed; 17 baseline migrations unchanged; this command accessed no database')
    elif args.action=='verify':
        evidence=verify(); print('PASS: 25 ordered migrations, pinned review/candidate hashes and dependency; this command accessed no database')
        for x in evidence['migrations']: print(x['name'],x['sha256'])
    elif args.action=='stage':
        if args.through is None: parser.error('--through required')
        print(stage(args.through))
    elif args.action=='checkpoints': print(f'Prepared {checkpoints(refresh=args.refresh_generated)} read-only psql checkpoints; none executed')
    else:
        if not all([args.host,args.port,args.database,args.user]): parser.error('Explicit approved --host --port --database --user required')
        target(os.environ,args.host,args.port,args.database,args.user)
        print('PASS: libpq and Prisma endpoint settings match explicit target; no database connected; approval/backup/rehearsal still required')

if __name__=='__main__': main()
