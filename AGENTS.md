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

- Voice suggestions are validated server-side against workspace catalogs and saved only through the existing transaction review dialog; this avoids silent financial writes.
- Voice uploads use authenticated, size-bounded multipart server routes and complete PCM WAV recordings; interpretation uses authenticated server functions and streaming AI SDK Responses.
- Persist provider access denials per user and AI surface, with privileged server writes only, to prevent automatic replay after reloads.
- CSV exports paginate all matching workspace transactions rather than the display's 500-row cache, and escape spreadsheet formulas.
- Leaf page metadata uses the shared pageMeta helper for consistent unique social and description tags.
