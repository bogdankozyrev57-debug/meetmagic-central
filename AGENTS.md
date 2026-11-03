<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Database backups are built server-side and stored in the private `backups` storage bucket, reachable only through the admin-gated `/backup` route — keep the dump text MySQL-compatible so phpMyAdmin can import it without edits, because the user's workflow is opening the project's own copy instead of a hand-made file.

