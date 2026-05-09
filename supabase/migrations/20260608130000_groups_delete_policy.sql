create policy "Creators can delete groups" on groups
  for delete using (created_by = auth.uid());
