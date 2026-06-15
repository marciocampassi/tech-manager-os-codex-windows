import matter from 'gray-matter';

// gray-matter caches parsed results process-globally (keyed by input string) and
// returns a *shared mutable* object. When code under test mutates that object
// (e.g. addRelation pushing into a frontmatter array), the mutation leaks into any
// other test or suite that parses the same string within the same Jest worker —
// causing order-dependent, parallel-only contamination failures.
//
// Clearing the cache before every test guarantees suite isolation regardless of how
// Jest distributes test files across workers. `clearCache` exists at runtime but is
// absent from gray-matter's type definitions, hence the narrow cast.
beforeEach(() => {
  (matter as unknown as { clearCache?: () => void }).clearCache?.();
});
