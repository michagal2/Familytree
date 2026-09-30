# Familytree

A plain HTML, CSS and JavaScript family tree app. No build step or package install is required.

## Upload to GitHub Pages

1. Unzip this bundle on your computer.
2. Open your **Familytree** repository on GitHub.
3. Choose **Add file > Upload files**. Upload the extracted files, not the ZIP. Put `index.html`, `style.css`, `app.js` and `config.js` directly in the repository root. Upload `supabase-setup.sql` and this README too. Do not upload family backups or personal photos into the public repository.
4. Commit the files to `main` (or your repository's default branch).
5. Open **Settings > Pages**. Under Source, choose **Deploy from a branch**, select your uploaded branch and **/(root)**, then Save.
6. Wait for GitHub's deployment to finish. Open the site URL shown in Settings > Pages. Publication can take up to 10 minutes.

GitHub Pages is free with a public repository on GitHub Free. If you do not want the source public, check your plan's private-repository Pages availability before publishing. The app's family records are in Supabase, not in the repository.

## Set up Supabase

Use a dedicated Supabase project on the free plan. No paid plan, secret key, service-role key or database password is needed in the app.

1. In your Supabase project's **SQL Editor**, create a new query, paste the full contents of `supabase-setup.sql`, and run it once. It creates one table and three functions. Do not re-run the setup in a project where these objects already exist.
2. In the project **Connect** dialog or **Settings > API Keys**, find your project URL and the browser-safe **publishable key** (`sb_publishable_...`).
3. Edit `config.js`: put the project's HTTPS URL into `supabaseUrl` and its publishable key into `publishableKey`. A publishable key is intended for browser use. Never substitute a secret key or `service_role` key.
4. Commit the updated `config.js` to GitHub. Wait for Pages to redeploy.
5. Open your site, add a person and a portrait, then select **Create share link**. Copy the complete link, including the `#edit=` part. Open it in a different browser and confirm the portrait loads and edits sync.

**Status of this bundle:** the browser UI, local portrait uploads and local persistence have been checked. Supabase live integration has not been verified against your project yet. The URL and key in `config.js` are intentionally empty. Shared editing will not work until the SQL and settings above are completed. A mocked backend test is not a substitute for step 5.

## Using the app

- Add a person, then tap their circle to edit name, years and notes.
- Upload JPG, PNG, WebP or GIF portraits up to 15 MB. Each portrait is center-cropped and compressed to a 240 x 240 JPEG. Animated GIFs become a still portrait. Initials appear when no portrait exists.
- Add a partner, child or parent from the person's editor. Pick the other parent when adding a child to a couple.
- Before sharing, edits and portraits are saved on the current browser. Browser storage can be cleared or unavailable, so export backups regularly.
- After sharing, the tree and portraits are stored together in Supabase. Everyone with the complete tree link can view, edit and remove records and portraits. This is link-based access, not individual login or a list of authorized family members. Keep links private.
- **Export backup** includes uploaded portraits. **Import backup** restores a backup into an empty local tree. To start with an empty local tree, clear this site's browser storage after exporting what you need.
- Shared edits save after each change, and refresh when you return to the page. If someone else saves first, your save is blocked instead of overwriting their work. Export your edits, then reload and reconcile them. **Retry save** retries a failed network save, but never overrides a conflict.

## Limits and privacy

The project publishable key alone cannot list or read trees. Direct table access is denied with Row Level Security and revoked grants. The three database functions check the random tree edit token before reading or saving. The token is stored as a hash; the full token stays in the share link's URL fragment. Anyone with that complete link has edit access. There are no per-person accounts, access revocation screen, server-side backups or encryption of family records beyond the service's normal protections. Do not put highly sensitive information into this prototype.

Each tree is limited to approximately 5 MB, including its compressed portraits. This is intended for small family projects, not an unlimited photo archive. Free Supabase projects are subject to usage quotas and may be paused. Export backups and review current free-plan limits in your own account. The app does not enable billing or auto-upgrades.

The database functions permit anonymous creation of new trees. This is appropriate for a small link-based prototype, not a public high-traffic service. Production use should add authenticated membership, abuse controls and operational monitoring.

Old ExtendsClass share links are not automatically migrated. Export your old tree and import its JSON backup here. Previous externally stored portrait references do not migrate automatically; re-upload those portraits.

## References

- GitHub Pages publishing: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Supabase publishable keys: https://supabase.com/docs/guides/api/api-keys
- Supabase SQL functions: https://supabase.com/docs/guides/database/functions
