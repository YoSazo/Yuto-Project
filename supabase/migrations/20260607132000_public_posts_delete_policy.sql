-- Allow users to delete their own public posts

drop policy if exists "Users can delete own public posts" on public_posts;
create policy "Users can delete own public posts"
  on public_posts
  for delete
  using (auth.uid() = user_id);

