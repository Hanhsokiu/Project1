"""Offline tests of promotion/staging/target gates. No database connections."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('uc_chain',Path(__file__).with_name('prepare-uc17-24.py'))
chain=importlib.util.module_from_spec(spec);spec.loader.exec_module(chain)

class ChainTests(unittest.TestCase):
    def setUp(self):
        scratch=chain.ROOT/'.tmp';scratch.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix='uc-chain-test-',dir=scratch)
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        base=self.root/'backend/prisma/migrations';base.mkdir(parents=True)
        (base.parent/'schema.prisma').write_text('datasource db { provider="postgresql" url=env("DATABASE_URL") }')
        lock=b'provider = "postgresql"\n';(base/'migration_lock.toml').write_bytes(lock)
        payload={'reference/b1-b8-migrations/migration_lock.toml':lock}
        for i in range(1,18):
            name=f'20261001{i:04}_baseline';p=base/name/'migration.sql';p.parent.mkdir();p.write_bytes(b'-- baseline\r\nSELECT 1;\r\n')
            payload[f'reference/b1-b8-migrations/{name}/migration.sql']=p.read_bytes()
        for uc,folder in zip(range(17,25),chain.FOLDERS): payload[f'migrations/{folder}/migration.sql']=f'-- approved {uc}\nBEGIN;\nCOMMIT;\n'.encode()
        manifest={'files':[{'path':n,'sha256':chain.sha(data)} for n,data in payload.items()]}
        with zipfile.ZipFile(self.root/chain.ZIP_NAME,'w') as z:
            for n,data in payload.items(): z.writestr(n,data)
            z.writestr('PACKAGE-MANIFEST.json',json.dumps(manifest))
        self.pin=patch.object(chain,'ZIP_SHA',chain.sha((self.root/chain.ZIP_NAME).read_bytes()));self.pin.start();self.addCleanup(self.pin.stop)

    def test_install_exact_17_plus_8_and_idempotent(self):
        first=chain.install(self.root);second=chain.install(self.root)
        self.assertEqual(first,second);self.assertEqual(len(chain.migration_names(self.root)),25)
        targets,_=chain.pinned_inputs(self.root)
        for t in targets: self.assertEqual((self.root/'backend/prisma/migrations'/t['name']/'migration.sql').read_bytes(),t['bytes'])

    def test_baseline_drift_stops_before_copy(self):
        (self.root/'backend/prisma/migrations'/chain.migration_names(self.root)[0]/'migration.sql').write_text('changed')
        with self.assertRaisesRegex(ValueError,'Baseline'):chain.install(self.root)
        self.assertEqual(len(chain.migration_names(self.root)),17)

    def test_destination_collision_preserves_bytes(self):
        dest=self.root/'backend/prisma/migrations'/chain.NAMES[3];dest.mkdir();(dest/'migration.sql').write_text('local edit')
        with self.assertRaisesRegex(ValueError,'collision'):chain.install(self.root)
        self.assertEqual((dest/'migration.sql').read_text(),'local edit')
        self.assertFalse((dest.parent/chain.NAMES[0]).exists())

    def test_unknown_migration_rejected(self):
        p=self.root/'backend/prisma/migrations/202611090000_unknown';p.mkdir();(p/'migration.sql').write_text('SELECT 1;')
        with self.assertRaisesRegex(ValueError,'Unknown'):chain.install(self.root)

    def test_zip_tamper_rejected(self):
        with (self.root/chain.ZIP_NAME).open('ab') as f:f.write(b'changed')
        with self.assertRaisesRegex(ValueError,'ZIP checksum'):chain.install(self.root)

    def test_official_tamper_detected(self):
        chain.install(self.root);p=self.root/'backend/prisma/migrations'/chain.NAMES[0]/'migration.sql';p.write_bytes(b'bad')
        with self.assertRaisesRegex(ValueError,'differs'):chain.verify(self.root)

    def test_release_27_verifies_without_private_zip_and_rejects_drift(self):
        schema=self.root/'backend/prisma/schema.prisma'
        schema.write_bytes(schema.read_bytes()+b'\r\n')
        chain.install(self.root)
        base=self.root/'backend/prisma/migrations'
        tails={name:chain.sha(('synthetic '+name).encode()) for name in chain.RELEASE_TAIL}
        for name in tails:
            folder=base/name;folder.mkdir()
            (folder/'migration.sql').write_bytes(('synthetic '+name).encode())
        (base/'.gitattributes').write_text('0_init/migration.sql text eol=crlf\n'+'\n'.join(n+'/migration.sql -text' for n in chain.NAMES+list(tails))+'\n')
        (self.root/chain.ZIP_NAME).unlink()
        schema.write_bytes(schema.read_bytes().replace(b'\r\n',b'\n'))
        with patch.object(chain,'RELEASE_TAIL',tails):
            self.assertEqual(len(chain.verify(self.root)['migrations']),8)
            target=base/chain.NAMES[0]/'migration.sql'
            target.write_bytes(target.read_bytes()+b'-- unreviewed')
            with self.assertRaisesRegex(ValueError,'checksum drift'):chain.verify(self.root)

    def test_git_byte_attributes_scoped_and_tamper_rejected(self):
        chain.install(self.root)
        p=self.root/'backend/prisma/migrations/.gitattributes'
        self.assertEqual(p.read_bytes().count(b'/migration.sql -text'),8)
        self.assertNotIn(b'baseline/migration.sql',p.read_bytes())
        p.write_bytes(b'*.sql text')
        with self.assertRaisesRegex(ValueError,'attributes'):chain.verify(self.root)

    def test_dependency_tamper_detected(self):
        chain.install(self.root);p=self.root/chain.MANIFEST;x=json.loads(p.read_text());x['migrations'][2]['dependsOn']='wrong';p.write_text(json.dumps(x))
        with self.assertRaisesRegex(ValueError,'Dependency'):chain.verify(self.root)

    def test_explicit_unapplied_patch_keeps_original_zip_pin(self):
        chain.install(self.root)
        manifest=self.root/chain.MANIFEST;x=json.loads(manifest.read_text())
        item=x['migrations'][-1];original=item['sha256']
        sql=self.root/'backend/prisma/migrations'/item['name']/'migration.sql'
        sql.write_bytes(sql.read_bytes()+b'-- explicit rehearsal fix\n')
        item['reviewedSha256']=original;item['sha256']=chain.sha(sql.read_bytes())
        manifest.write_text(json.dumps(x))
        ledger=self.root/chain.DEPLOY/'rehearsal-fixes.json';ledger.parent.mkdir(parents=True)
        ledger.write_text(json.dumps({'unappliedCandidateFixes':[{'uc':24,'reviewedSha256':original,'candidateSha256':item['sha256']}]}))
        self.assertEqual(chain.verify(self.root)['migrations'][-1]['reviewedSha256'],original)
        sql.write_bytes(b'unrecorded change')
        with self.assertRaisesRegex(ValueError,'patch bytes'):chain.verify(self.root)

    def test_all_stages_are_exact_bounded_prefix(self):
        chain.install(self.root)
        for uc in range(16,25):
            p=chain.stage(uc,self.root);self.assertEqual(len(chain.migration_names_stage(p/'migrations')),uc+1)
            self.assertEqual(chain.stage(uc,self.root),p)
            self.assertEqual((p/'schema.prisma').read_bytes(),(self.root/'backend/prisma/schema.prisma').read_bytes())

    def test_future_stage_migration_and_environment_rejected(self):
        chain.install(self.root);p=chain.stage(17,self.root)
        future=p/'migrations'/chain.NAMES[-1];future.mkdir();(future/'migration.sql').write_text('future')
        with self.assertRaisesRegex(ValueError,'future'):chain.stage(17,self.root)
        q=self.root/'.cache/uc17-24-deploy/uc18/prisma';q.mkdir(parents=True);(q/'.env').write_text('FAKE_ONLY=1')
        with self.assertRaisesRegex(ValueError,'environment'):chain.stage(18,self.root)

    def test_preflight_postflight_history_boundaries(self):
        chain.install(self.root);self.assertEqual(chain.checkpoints(self.root),16)
        d=self.root/chain.DEPLOY
        for uc in range(17,25):
            pre=(d/f'uc{uc}-preflight.sql').read_text();post=(d/f'uc{uc}-postflight.sql').read_text()
            self.assertIn(f'"_prisma_migrations")={uc}',pre)
            self.assertIn(f'"_prisma_migrations")={uc+1}',post)
            self.assertIn('BEGIN READ ONLY;',pre)
            self.assertIn('SELECT 1/0 AS uc_checkpoint_failed;',post)
            self.assertNotIn('\\quit',post)
            self.assertIn("current_setting('standard_conforming_strings')='on'",post)

class RealArtifactTests(unittest.TestCase):
    def test_real_promoted_chain_and_source_object_coverage(self):
        evidence=chain.verify();self.assertEqual(len(evidence['migrations']),8)
        objs=[chain.objects((chain.ROOT/'backend/prisma/migrations'/x['name']/'migration.sql').read_bytes().decode()) for x in evidence['migrations']]
        self.assertEqual(sum(len(x['functions']) for x in objs),25)
        self.assertEqual(sum(len(x['triggers']) for x in objs),25)
        self.assertIn(('DEFENSE_SESSION','sc_booking_mutex_guard','sc_booking_mutex_guard',30,False),objs[4]['triggers'])

class TargetTests(unittest.TestCase):
    def env(self):
        url='postgresql://postgres.ref:synthetic-only@qa.example.invalid:5432/postgres?schema=public&sslmode=require'
        return dict(DATABASE_URL=url,DIRECT_URL=url,PGHOST='qa.example.invalid',PGPORT='5432',PGDATABASE='postgres',PGUSER='postgres.ref',PGSSLMODE='require')
    def check(self,env):return chain.target(env,'qa.example.invalid',5432,'postgres','postgres.ref')
    def test_matching_endpoints_only_no_connection(self):self.assertTrue(self.check(self.env()))
    def test_different_prisma_target_rejected(self):
        env=self.env();env['DIRECT_URL']=env['DIRECT_URL'].replace('qa.example.invalid','shared.example.invalid')
        with self.assertRaises(ValueError):self.check(env)
    def test_all_target_options_fail_closed(self):
        for key,val in [('PGHOST','other'),('PGPORT','6543'),('PGDATABASE','other'),('PGUSER','other'),('PGSSLMODE','disable'),('PGOPTIONS','-c role=other'),('PGSERVICE','shared')]:
            with self.subTest(key=key),self.assertRaises(ValueError):self.check(self.env()|{key:val})
    def test_prisma_dangerous_options_rejected(self):
        for extra in ['&host=other','&options=evil','&schema=private','&pgbouncer=true','&sslmode=disable']:
            env=self.env();env['DIRECT_URL']+=extra
            with self.subTest(extra=extra),self.assertRaises(ValueError):self.check(env)
    def test_credential_error_does_not_reveal_secret(self):
        env=self.env();env['PGPASSWORD']='other-synthetic'
        with self.assertRaises(ValueError) as error:self.check(env)
        self.assertNotIn('synthetic',str(error.exception))

if __name__=='__main__':unittest.main(verbosity=2)
