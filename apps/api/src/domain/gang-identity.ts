export function archivedGangIdentity(id: string): {
  slug: string;
  tag: string;
} {
  return {
    slug: `archived-${id}`,
    tag: `ARCHIVED-${id}`,
  };
}
