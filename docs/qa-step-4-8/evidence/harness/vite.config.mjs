import original from '../../../../frontend/vite.config.ts';
export default async (context) => ({
  ...await original(context),
  cacheDir: process.env.QA_RUN_DIR + '/vite-cache',
});
