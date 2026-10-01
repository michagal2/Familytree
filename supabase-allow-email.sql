-- Step 2 (run ONLY after you signed in once in the app and saw "Signed in: ..."):
-- replace the address with your Google email, in lowercase. Add more emails with more rows.
insert into public.familytree_allowed_emails (email) values ('your.name@gmail.com')
on conflict do nothing;
